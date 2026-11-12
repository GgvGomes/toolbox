---
description: Search the toolbox catalog by keywords, category, kind or tag
argument-hint: <keywords> [--category <id>] [--kind <id>] [--tag <tag>]
allowed-tools: Bash(node:*)
---

Search the toolbox for: $ARGUMENTS

Follow the `toolbox-search` skill. CLI: `node "${CLAUDE_PLUGIN_ROOT}/bin/toolbox.mjs"`.

- Pass any `--category`, `--kind`, `--tag` flags through unchanged.
- Translate free-text keywords to English before searching; retry broader if nothing matches.
- With no arguments, run `taxonomy` and show categories/kinds with counts.
