---
name: toolbox-search
description: Search the user's personal toolbox catalog of external tools (CLIs, libraries, services, MCP servers, Claude plugins, extensions, resources) by category, kind and tags. Use whenever the user asks whether they have a tool for something, wants a tool/library/service recommendation, asks "is there something for X", "which tool do I use to Y", "tem alguma ferramenta pra X", or before suggesting a third-party tool from memory.
---

# Toolbox search

The toolbox is a curated catalog. Prefer its entries over recommending tools from memory. If the user has a **Local Link** for a tool, it already exists on their machine — use that path instead of downloading.

Vocabulary: see `CONTEXT.md` at the plugin root (Tool, Reference, Local Link, Category, Kind, Tag).

## How to search

The CLI lives at `${CLAUDE_PLUGIN_ROOT}/bin/toolbox.mjs` (if that variable is empty, it is `../../bin/toolbox.mjs` relative to this skill's base directory).

1. Turn the request into **English keywords** — the catalog is in English. Include 1–2 synonyms (e.g. "escanear vulnerabilidades" → `vulnerability scanner sast`).
2. If the domain is obvious, add an exact filter. List valid ids with `taxonomy`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/toolbox.mjs" taxonomy
   ```
3. Search (every keyword must match, so start broad and narrow if there are too many results):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/toolbox.mjs" search <keywords> [--category <id>] [--kind <id>] [--tag <tag>] --json
   ```
   No hits? Retry with fewer keywords, then with just a `--category` filter.
4. `show <slug> --json` gives install command and notes.

## How to answer

- List the best matches: name, one-line description, Reference URL, install command if present.
- When `localLink` is present: say it is already on this machine, give the path, and flag it if `exists` is false.
- When nothing matches: say the toolbox has no tool for this. If you know a good candidate, offer it as a suggestion the user may add with `/toolbox:add <url>` (maintainers only). Do not claim it is in the toolbox.
