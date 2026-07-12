#!/usr/bin/env node
// Single-course validator (DCF v1, see docs/SPEC.md).
// Usage: node scripts/validate-course.js <course.html> <course.json>
// Zero dependencies; does not read content.js and has no dependency on this repo's
// structure — safe to distribute standalone to external contributors.

const fs = require('fs');
const path = require('path');

const [, , htmlArg, jsonArg] = process.argv;
if (!htmlArg || !jsonArg) {
  console.error('Usage: node validate-course.js <course.html> <course.json>');
  process.exit(1);
}

const errors = [];
const warns = [];
const err = msg => errors.push(`  ${msg}`);
const warn = msg => warns.push(`  ${msg}`);

if (!fs.existsSync(htmlArg)) { console.error(`✗ HTML file not found: ${htmlArg}`); process.exit(1); }
if (!fs.existsSync(jsonArg)) { console.error(`✗ course.json not found: ${jsonArg}`); process.exit(1); }

const html = fs.readFileSync(htmlArg, 'utf8');
let meta;
try {
  meta = JSON.parse(fs.readFileSync(jsonArg, 'utf8'));
} catch (e) {
  console.error(`✗ course.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

// ---- 1. course.json schema (blocking) ----
const REQUIRED = ['format_version', 'slug', 'topic', 'title', 'summary', 'tag', 'level', 'lang', 'accent', 'author', 'license'];
REQUIRED.forEach(k => {
  if (meta[k] === undefined || meta[k] === null || meta[k] === '') err(`course.json missing field: ${k}`);
});
if (meta.format_version !== 1) err(`format_version should be 1 (number), got: ${JSON.stringify(meta.format_version)}`);
if (meta.slug && !/^[a-z0-9-]+$/.test(meta.slug)) err(`slug must be lowercase letters/digits/hyphens only: "${meta.slug}"`);
if (meta.accent && !/^#[0-9A-Fa-f]{6}$/.test(meta.accent)) err(`accent should be #RRGGBB: "${meta.accent}"`);
if (meta.lang && !/^[a-z]{2}$/.test(meta.lang)) warn(`lang should be a two-letter ISO 639-1 code, got: "${meta.lang}"`);
if (meta.prerequisites !== undefined && meta.prerequisites !== null &&
    typeof meta.prerequisites !== 'string' && !Array.isArray(meta.prerequisites))
  err('prerequisites, if present, should be a string or an array of strings');
if (meta.age_range !== undefined && meta.age_range !== null && typeof meta.age_range !== 'string')
  err('age_range, if present, should be a string, e.g. "10-14"');

// ---- 2. Hard technical requirements (blocking, see SPEC section 2) ----

// unfilled shell placeholders
if (/【【|】】/.test(html)) err('unfilled template placeholder (【【…】】) — fill every placeholder from the shell');

// <html lang> vs metadata lang (primary subtag must match)
const langAttr = (html.match(/<html[^>]*\blang=["']([^"']+)["']/i) || [])[1];
if (!langAttr) warn('<html> tag has no lang attribute');
else if (meta.lang && langAttr.toLowerCase().split('-')[0] !== String(meta.lang).toLowerCase())
  err(`<html lang="${langAttr}"> does not match course.json lang "${meta.lang}"`);

// Fully self-contained: no external <script src> / <link rel=stylesheet href> besides Google Fonts
const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
const linkHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map(m => m[1]);
const allowedHost = u => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u);
scriptSrcs.forEach(src => { if (!allowedHost(src)) err(`not self-contained: external <script src> pointing to ${src} (only the Google Fonts CDN is allowed)`); });
linkHrefs.forEach(href => { if (!allowedHost(href)) err(`not self-contained: external stylesheet ${href} (only the Google Fonts CDN is allowed)`); });

// reduced-motion handling (at least one detection/degradation path)
if (!/prefers-reduced-motion/.test(html)) err('no prefers-reduced-motion handling detected (a CSS media query or JS matchMedia both count)');

// decorative canvas needs aria-hidden (heuristic: any canvas should come with at least one aria-hidden)
if (/<canvas/i.test(html) && !/aria-hidden/i.test(html))
  warn('page has a <canvas> but no aria-hidden anywhere — confirm decorative canvases are marked, and informational ones use aria-label');

// security static checks: no outbound requests/forms/navigation hijacking (a hard requirement for hosting UGC)
const DANGEROUS = [
  [/\bfetch\s*\(/, 'fetch('],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnew\s+WebSocket\s*\(/, 'new WebSocket('],
  [/<form[\s>]/i, '<form>'],
  [/\btop\s*\.\s*location\b/, 'top.location'],
  [/\bwindow\.open\s*\(/, 'window.open('],
];
DANGEROUS.forEach(([re, label]) => {
  if (re.test(html)) err(`security check: suspicious pattern detected — ${label} (a course page must not make outbound requests, submit forms, or hijack navigation)`);
});

// ---- 3. Warnings (non-blocking) ----

// relative references that don't resolve next to the HTML file (broken when
// the course is distributed standalone — e.g. a leftover ../favicon.svg)
const baseDir = path.dirname(path.resolve(htmlArg));
new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)]
  .map(m => m[1])
  .filter(u => !/^(https?:|mailto:|data:|javascript:|#)/i.test(u))
).forEach(u => {
  const clean = u.split(/[?#]/)[0];
  if (clean && !fs.existsSync(path.resolve(baseDir, clean)))
    warn(`relative reference "${u}" does not resolve next to the HTML file — broken when distributed standalone`);
});

if (!/og:image/.test(html)) warn('page is missing an og:image tag');
if (!/<meta[^>]+name=["']viewport["']/i.test(html)) warn('page is missing a viewport meta tag');
if (meta.prerequisites === undefined) warn('course.json does not explicitly set prerequisites (optional — prefer null over omitting it)');
if (meta.age_range === undefined) warn('course.json does not explicitly set age_range (optional — prefer null over omitting it)');

// ---- Output ----
if (errors.length) {
  console.error(`✗ validation failed, ${errors.length} issue(s):\n` + errors.join('\n'));
  process.exit(1);
}
if (warns.length) console.warn(`⚠ ${warns.length} warning(s):\n` + warns.join('\n'));
console.log(`✓ ${path.basename(htmlArg)} passes format validation (DCF v1)`);
