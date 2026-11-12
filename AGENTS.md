# Agent guide

This repo is a **catalog of external tools**. It holds no tool source code, only metadata pointing to tools. Vocabulary is defined in [CONTEXT.md](CONTEXT.md). Use those terms exactly.

## Finding a tool

Fastest option: run the CLI (Node ≥ 20, no install needed):

```bash
node bin/toolbox.mjs search <english keywords> [--category <id>] [--kind <id>] [--tag <tag>] --json
node bin/toolbox.mjs show <slug> --json
node bin/toolbox.mjs taxonomy          # valid category / kind ids
```

Without a shell, read [`catalog.json`](catalog.json). It is a single file with the taxonomy and every tool. [`INDEX.md`](INDEX.md) is the same content grouped by category.

- The catalog is in English, so translate queries first.
- Results may include `localLink`, meaning the tool already exists on this machine at that path. Prefer it over downloading.
- If nothing matches, say so. Don't present tools from memory as if they were cataloged.

## Data model

| File | Role | Edit? |
|---|---|---|
| `tools/<slug>.json` | One **Tool** each | yes |
| `taxonomy.json` | Closed lists of **Categories** and **Kinds** | yes, deliberately |
| `catalog.json`, `INDEX.md`, `schema/tool.schema.json` | Generated | **never by hand**, run `npm run build` |
| `~/.config/toolbox/local.json` | **Local Links** (slug → path), per machine | via `toolbox link` only |
| `~/.config/toolbox/config.json` | Maintainer clone path | via `toolbox config repo` |

## Adding a tool (Maintainers)

Follow [`commands/add.md`](commands/add.md). Rules:

1. One file per Tool: `tools/<slug>.json`, slug = file name, kebab-case.
2. Required fields: `slug, name, description (20–280 chars), reference (http/https), kind, categories (≥1), added (YYYY-MM-DD)`. Optional fields: `tags, install, notes`.
3. Re-check the taxonomy on every addition. Propose a new Category/Kind, or a sharper description, when the existing ones don't fit, and get approval first.
4. **Never commit Local Links or absolute local paths.** They go in `~/.config/toolbox/local.json`.
5. Before committing: `npm run build && npm run check && npm test`.
