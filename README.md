# everywhy-submissions

Community course submissions for [everywhy.ai](https://everywhy.ai) ("拆解" / Disassemble) — the public inbox.

向 everywhy.ai 投稿课程的公开收件箱。这里的每个 PR 是一份待审核的投稿；审核通过后内容会被收录进 everywhy.ai 主站发布。

## How to submit / 如何投稿

**Path 1 (recommended) — one HTTP call, no GitHub account needed:**

```bash
curl -X POST https://submit.everywhy.ai/v1/courses \
  -F "html=@your-course.html" \
  -F "meta=@course.json"
```

The API validates your course instantly (format, self-containment, safety checks) and returns errors synchronously. If it passes, a PR is created here automatically and you get back a submission ID + status URL:

```bash
curl https://submit.everywhy.ai/v1/submissions/<id>
```

Optional: add `-F "contact=your-handle"` if you want a public contact reference on the submission.

**Path 2 — manual PR (for git users):**

Fork this repo, add your files under `submissions/<author>-<slug>/` as exactly two files named `course.html` and `course.json`, open a PR. CI runs the same validator.

## What to submit / 投什么

One course = one self-contained HTML + one `course.json`, per the [Disassemble Course Format spec](https://github.com/ericqian77/everywhy-skill/blob/main/SPEC.md). The easiest way to produce a valid course is the [everywhy-skill](https://github.com/ericqian77/everywhy-skill) — an agent-ready recipe for Claude Code / Codex / Cursor.

## Review / 审核

Passing the validator proves *format* compliance only. Every submission is then reviewed for pedagogical correctness (math/physics independently re-derived) and content safety before publication. Reviews happen in PR comments; accepted courses are promoted to everywhy.ai and the PR is closed with a link to the live page.

## License / 许可

By submitting, you agree to license your content under **CC BY-SA 4.0** (attribution + share-alike), consistent with all content on everywhy.ai. Your `author` field is your attribution. 提交即同意以 CC BY-SA 4.0 授权展示，`author` 字段即署名。

---

`scripts/validate-course.js` is a copy of the validator from [everywhy-skill](https://github.com/ericqian77/everywhy-skill) (kept in sync manually); run it locally before submitting:

```bash
node scripts/validate-course.js your-course.html course.json
```
