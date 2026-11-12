# toolbox

A personal, curated **catalog of external tools**. Every tool is tagged with a Category, a Kind and Tags, so people and AI agents can find the right one fast.

- 📚 Browse: [INDEX.md](INDEX.md) (by category) · [catalog.json](catalog.json) (machine-readable)
- 🤖 Use from Claude Code: install the plugin and ask "do I have a tool for X?"
- 🧭 Vocabulary: [CONTEXT.md](CONTEXT.md) · Agent instructions: [AGENTS.md](AGENTS.md)

## Model

| Term | Meaning |
|---|---|
| **Tool** | One entry: a public **Reference** (URL) plus a description |
| **Category** | Domain, one or more per tool: `ai`, `security`, `devops`, `frontend`, `backend`, `database`, `productivity`, `testing`, `docs`, `design`, `observability`, `mobile` |
| **Kind** | Format, exactly one per tool: `cli`, `library`, `app`, `service`, `mcp-server`, `claude-plugin`, `extension`, `resource` |
| **Tag** | Free label for finer search (`sast`, `scanner`, …) |
| **Local Link** | Where the tool already lives on *your* machine. Stored in `~/.config/toolbox/local.json` and **never committed** |

Categories and Kinds are closed lists in [`taxonomy.json`](taxonomy.json), and validation rejects typos. Adding one is a one-line change.

## Use as a Claude Code plugin

```text
/plugin marketplace add GgvGomes/toolbox
/plugin install toolbox@toolbox
```

| | |
|---|---|
| *"tem alguma ferramenta pra escanear vulnerabilidades com IA?"* | `toolbox-search` skill triggers automatically |
| `/toolbox:search scanner --category security` | Explicit search with filters |
| `/toolbox:link semgrep ~/softs/semgrep` | Record a Local Link (this machine only) |
| `/toolbox:add <url>` | **Maintainers**: research, catalog, validate, commit and push |

## Use without the plugin

```bash
git clone https://github.com/GgvGomes/toolbox.git && cd toolbox
node bin/toolbox.mjs search vulnerability scanner
node bin/toolbox.mjs search --category ai --kind mcp-server
node bin/toolbox.mjs show <slug>
node bin/toolbox.mjs help
```

Node ≥ 20, zero dependencies. Any AI agent can also just read `catalog.json`.

## Maintainer setup

```bash
git clone https://github.com/GgvGomes/toolbox.git ~/toolbox
node ~/toolbox/bin/toolbox.mjs config repo ~/toolbox
```

`/toolbox:add` then writes to this clone, and searches read the clone's catalog, so they're always current.

### Adding a tool by hand

1. Create `tools/<slug>.json` (the editor autocompletes from `schema/tool.schema.json`):
   ```json
   {
     "$schema": "../schema/tool.schema.json",
     "slug": "semgrep",
     "name": "Semgrep",
     "description": "Fast static analysis that finds bugs and security vulnerabilities across 30+ languages.",
     "reference": "https://github.com/semgrep/semgrep",
     "kind": "cli",
     "categories": ["security"],
     "tags": ["sast", "scanner"],
     "install": "brew install semgrep",
     "added": "2026-11-12"
   }
   ```
2. `npm run build && npm run check && npm test`
3. `node bin/toolbox.mjs bump` (so installed plugins update), then commit and push.

## Layout

```
tools/<slug>.json         one file per Tool (source of truth)
taxonomy.json             categories + kinds (closed lists)
catalog.json, INDEX.md    generated: npm run build
schema/tool.schema.json   generated from taxonomy
bin/toolbox.mjs           CLI      src/lib.mjs   core logic
skills/ commands/         Claude Code plugin    .claude-plugin/  manifests
.github/workflows/        CI: validate + stale-check, weekly link check
```

## License

MIT
