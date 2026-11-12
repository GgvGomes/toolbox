---
description: Record where a toolbox tool already lives on this machine (Local Link, never committed)
argument-hint: <slug-or-name> <path>
allowed-tools: Bash(node:*), Bash(ls:*)
---

Record a Local Link: $ARGUMENTS

CLI: `node "${CLAUDE_PLUGIN_ROOT}/bin/toolbox.mjs"`.

1. If the first argument is not an exact slug, find it with `search <name> --json` and confirm the match with the user when ambiguous.
2. If no path was given, ask for it.
3. Run `link <slug> <path>`. It resolves the path and stores it in `~/.config/toolbox/local.json` — outside the repo, so it is never committed or pushed.
4. Report the stored path. Use `links` to show all, `unlink <slug>` to remove.
