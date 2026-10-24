# launchbar: implementation log

## Requirement
A Claude Code mod that draws up to two button panels above the prompt; a button starts a user-defined command.
- A panel is **global** (every session, one shared button list) or **local** (shown only in a project, one list per project).
- A project is a folder with `.git` (directory or worktree file) or a `.launchbar` marker file in the session root.
- Global panels are always shown; a local panel is shown in a project and is always drawn above the global one (no collapse/reveal button).
- Published as one GitHub repo that is marketplace and plugin at once (`miclux/launchbar`).

## Files
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (plugin source `./`), `hooks/hooks.json` (one module), `hooks/session-copy.json` (classic hooks, named in `plugin.json` under `hooks`), `hooks/install-mod.cjs`.
- `hooks/register.tsx`: the mod. `hooks/art.ts`: static gradient (`ART_SVG`). `hooks/register.test.ts`: tests. `types/index.d.ts`: `$.state` contract.

## Behaviour
- `ui.render` on `AbovePrompt`. `inspect($)` reads `$.session.root()` and probes `.git` / `.launchbar` through PowerShell (cached per folder).
- Survey in the slot, or nothing to show: `next(e)`. Otherwise a column with the panels, `await next(e)` below.
- Store key `panels` = `[{ id, scope }]`, max 2, default `[{ id: 'main', scope: 'global' }]`. Button lists: `buttons:global:<id>` or `buttons:local:<id>:<root>`; switching the scope keeps both lists.
- State atoms: `buttons` (lists being edited), `editing` (panel id), `confirm` (`<panel>|<button>` or `panel|<panel>`), `draft`.
- Buttons run `powershell -NoProfile -Command <cmd>` via `Start-Process` in the project folder through `$.process.run`, so the child outlives the call; a toast reports start or error.
- Gear: edit mode with `+` (name, then command), `−` with inline confirm, scope switch "Global"/"Lokal", "+ Panel", "Panel −"; the check mark saves.
- Look: ground `#141416`, round border `#2a2a2f`, static gradient from the right, one row per panel.

## Auto-install into each session (0.3.6)
- The Desktop app loads mods only from `~/.claude/dev-mods/<session-id>/<mod>/`, a folder that is new for every session, so an installed plugin never showed the bar.
- `hooks/session-copy.json` runs `hooks/install-mod.cjs` on `SessionStart` and `UserPromptSubmit`. The script reads `session_id` from stdin and copies the plugin root (`CLAUDE_PLUGIN_ROOT`, without `.git`, `.in_use`, `.orphaned_at`, `node_modules`) to `dev-mods/<session-id>/launchbar`, unless `hooks/hooks.json` is already there. The prompt hook covers sessions that were switched to or resumed without a `SessionStart`.
- Errors go to `~/.claude/hooks/launchbar-install.log`. The user still confirms "Enable hot reloading for this session" once per session.
- Not verified: that the Desktop app fires `SessionStart` for a plain switch, and that a plugin `hooks` entry in `plugin.json` is read next to the `modules` file.

## Stumbling blocks
- `claude` is not always on PATH: run `claude plugin validate|test` from the Desktop app's `claude.exe`.
- The validator refuses `$` passed to a function that is not a top-level declaration: helpers are hoisted out of `register`.
- Test mocks answer as `{ value: ... }`; the stand-in for the bar below must return a real tree.
- Desktop app loading: `CLAUDE_CODE_PLUGIN_DIRS` and marketplaces did not show the panel there; only `dev-mods/<session-id>/<mod>/` with hot reloading confirmed works, per session.

## Known limits
- Windows and PowerShell only. Not yet verified in a real Desktop session; the tests have not been run yet.
- Whether the effortless bar sits under the panel depends on hook order.
