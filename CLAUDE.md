# sr.xp — notes for Claude Code

Read README.md first: it covers architecture, locked effect settings, breakpoints and production to-dos.

- Plain HTML/CSS/JS, no build step. Preview with `python3 tools/serve.py` (http://localhost:8141, no-cache).
- speedrun brand rules apply: Messina Sans; Condensed = uppercase; brand name lowercase `speedrun` in source; use `--sr-*` tokens, not literals.
- Don't edit `vendor/` (except the marked `sr.xp patch` sections in `vendor/fluid/fluid-header.js`).
- Tuned values are locked in `js/glass-preset.js` and in `frame` / `fluid` inside `js/paint-text.js`. Change them only when asked.
- Test effect changes with `?fx=full` and `?fx=lite`.
- Access control is client-side prototype only: see "Before production" in README.md.
