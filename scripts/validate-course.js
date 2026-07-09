#!/usr/bin/env node
// 单课程校验器(DCF v1,见 docs/SPEC.md)。
// 用法: node scripts/validate-course.js <course.html> <course.json>
// 零依赖;不读 content.js,不依赖本仓库结构——可独立分发给外部投稿者使用。

const fs = require('fs');
const path = require('path');

const [, , htmlArg, jsonArg] = process.argv;
if (!htmlArg || !jsonArg) {
  console.error('用法: node validate-course.js <course.html> <course.json>');
  process.exit(1);
}

const errors = [];
const warns = [];
const err = msg => errors.push(`  ${msg}`);
const warn = msg => warns.push(`  ${msg}`);

if (!fs.existsSync(htmlArg)) { console.error(`✗ HTML 文件不存在: ${htmlArg}`); process.exit(1); }
if (!fs.existsSync(jsonArg)) { console.error(`✗ course.json 不存在: ${jsonArg}`); process.exit(1); }

const html = fs.readFileSync(htmlArg, 'utf8');
let meta;
try {
  meta = JSON.parse(fs.readFileSync(jsonArg, 'utf8'));
} catch (e) {
  console.error(`✗ course.json 不是合法 JSON: ${e.message}`);
  process.exit(1);
}

// ---- 一、course.json schema(错误级) ----
const REQUIRED = ['format_version', 'slug', 'topic', 'title', 'summary', 'tag', 'level', 'lang', 'accent', 'author', 'license'];
REQUIRED.forEach(k => {
  if (meta[k] === undefined || meta[k] === null || meta[k] === '') err(`course.json 缺字段: ${k}`);
});
if (meta.format_version !== 1) err(`format_version 应为 1(数字),实际: ${JSON.stringify(meta.format_version)}`);
if (meta.slug && !/^[a-z0-9-]+$/.test(meta.slug)) err(`slug 只能是小写字母/数字/连字符: "${meta.slug}"`);
if (meta.accent && !/^#[0-9A-Fa-f]{6}$/.test(meta.accent)) err(`accent 应为 #RRGGBB: "${meta.accent}"`);
if (meta.lang && !/^[a-z]{2}$/.test(meta.lang)) warn(`lang 建议用 ISO 639-1 两位代码,实际: "${meta.lang}"`);
if (meta.prerequisites !== undefined && meta.prerequisites !== null &&
    typeof meta.prerequisites !== 'string' && !Array.isArray(meta.prerequisites))
  err('prerequisites 若提供应为字符串或字符串数组');
if (meta.age_range !== undefined && meta.age_range !== null && typeof meta.age_range !== 'string')
  err('age_range 若提供应为字符串,如 "10-14"');

// ---- 二、硬性技术约定(错误级,见 SPEC 第二节) ----

// 完全自包含:除 Google Fonts 外无外部 <script src> / <link rel=stylesheet href>
const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
const linkHrefs = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi)].map(m => m[1]);
const allowedHost = u => /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u);
scriptSrcs.forEach(src => { if (!allowedHost(src)) err(`非自包含:外部 <script src> 指向 ${src}(仅允许 Google Fonts CDN)`); });
linkHrefs.forEach(href => { if (!allowedHost(href)) err(`非自包含:外部样式表 ${href}(仅允许 Google Fonts CDN)`); });

// reduced-motion 处理(至少出现一次检测/降级)
if (!/prefers-reduced-motion/.test(html)) err('未检测到 prefers-reduced-motion 处理(CSS 媒体查询或 JS matchMedia 均可)');

// 装饰性 canvas 需要 aria-hidden(启发式:有 canvas 就该有至少一处 aria-hidden)
if (/<canvas/i.test(html) && !/aria-hidden/i.test(html))
  warn('页面含 <canvas> 但未见 aria-hidden——确认装饰性画布已标注,信息性画布用了 aria-label');

// 安全静态检查:禁止外联请求/表单/跳转劫持模式(UGC 托管的硬前提)
const DANGEROUS = [
  [/\bfetch\s*\(/, 'fetch('],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnew\s+WebSocket\s*\(/, 'new WebSocket('],
  [/<form[\s>]/i, '<form>'],
  [/\btop\s*\.\s*location\b/, 'top.location'],
  [/\bwindow\.open\s*\(/, 'window.open('],
];
DANGEROUS.forEach(([re, label]) => {
  if (re.test(html)) err(`安全检查:检测到可疑模式 ${label}——课程页不应发起外部请求/表单提交/跳转劫持`);
});

// ---- 三、警告级(不阻塞) ----
if (!/og:image/.test(html)) warn('页面缺 og:image 标签');
if (!/<meta[^>]+name=["']viewport["']/i.test(html)) warn('页面缺 viewport meta 标签');
if (meta.prerequisites === undefined) warn('course.json 未显式提供 prerequisites(可选,建议填 null 而非省略)');
if (meta.age_range === undefined) warn('course.json 未显式提供 age_range(可选,建议填 null 而非省略)');

// ---- 输出 ----
if (errors.length) {
  console.error(`✗ 校验失败,${errors.length} 个问题:\n` + errors.join('\n'));
  process.exit(1);
}
if (warns.length) console.warn(`⚠ ${warns.length} 条警告:\n` + warns.join('\n'));
console.log(`✓ ${path.basename(htmlArg)} 通过格式校验(DCF v1)`);
