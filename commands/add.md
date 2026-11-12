---
description: (Maintainers) Add a tool to the toolbox from a URL, then validate, commit and push
argument-hint: <url> [local path] [extra context]
allowed-tools: Bash(node:*), Bash(git:*), Bash(ls:*), Read, Write, Edit, WebFetch, WebSearch, AskUserQuestion
---

Add a tool to the toolbox: $ARGUMENTS

Vocabulary: Tool, Reference, Local Link, Category, Kind, Tag — see `CONTEXT.md`.

## 0. Resolve the Maintainer clone

Run `node "${CLAUDE_PLUGIN_ROOT}/bin/toolbox.mjs" config --json` and read `repo`.

- No `repo`: stop. Explain that adding is for Maintainers with a git clone: `git clone <toolbox repo> && node <clone>/bin/toolbox.mjs config repo <clone>`.
- Otherwise set `REPO=<repo>` and from here on run **the clone's** CLI: `node "$REPO/bin/toolbox.mjs"`. Work inside `$REPO`.

Then `git -C "$REPO" pull --rebase`. If the tree is dirty, ask before continuing.

## 1. Reject duplicates

`node "$REPO/bin/toolbox.mjs" exists <url>` — exit 0 means it is already cataloged: show that tool and stop (offer `/toolbox:link` if a local path was given).

## 2. Research the tool

Fetch the URL (and the README for repos). Work out what it does, when to reach for it, and how to install it. Use the canonical Reference: the project's main repo or homepage. Not a fork, not a deep link.

## 3. Review the taxonomy (required every time)

Run `node "$REPO/bin/toolbox.mjs" taxonomy`.

- Pick exactly one **Kind** and 1–3 **Categories** that genuinely describe the tool.
- Ask yourself: do the existing Categories and Kinds still describe this tool well? If none fits, or the tool shows a category's description is too narrow, propose to the user (AskUserQuestion) either a new entry (`id`, `name`, `description`) or a sharper description. Only after the user approves, edit `$REPO/taxonomy.json`.
- Never put a Tool in a category just to fill it.

## 4. Write the Tool

Create `$REPO/tools/<slug>.json`:

```json
{
  "$schema": "../schema/tool.schema.json",
  "slug": "kebab-case-name",
  "name": "Display Name",
  "description": "What it does and when to use it, 20-280 chars, written for search (use the words someone would search with).",
  "reference": "https://canonical-url",
  "kind": "cli",
  "categories": ["security", "ai"],
  "tags": ["scanner", "sast"],
  "install": "npm i -g example",
  "notes": "Optional caveats/tips.",
  "added": "YYYY-MM-DD"
}
```

`install` and `notes` are optional. Tags: lowercase, ≤10, the words a searcher would type that are not already the category/kind.

## 5. Build and verify

```bash
cd "$REPO" && node bin/toolbox.mjs build && node bin/toolbox.mjs validate && node bin/toolbox.mjs bump
```

Fix every error and re-run. `bump` raises the plugin version so installed copies pick up the change.

## 6. Local Link (optional)

If the user gave a local path, or says the tool is already on this machine: `node "$REPO/bin/toolbox.mjs" link <slug> <path>`. That writes to `~/.config/toolbox/local.json` and is never committed. Never put local paths in `tools/*.json`.

## 7. Commit and push

```bash
git -C "$REPO" add tools/ taxonomy.json catalog.json INDEX.md schema/ package.json .claude-plugin/
git -C "$REPO" commit -m "feat(tools): add <slug>"
git -C "$REPO" push
```

Report: slug, Kind, Categories, any taxonomy change, commit hash.
