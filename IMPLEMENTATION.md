# launchbar: implementation log

## Requirement
A Claude Code mod that draws up to two button panels above the prompt; a button starts a user-defined command.
- A panel is **global** (every session, one shared button list) or **local** (shown only in a project, one list per project).
- A project is a folder with `.git` (directory or worktree file) or a `.launchbar` marker file in the session root.
- A new session shows only the global panel; local panels start hidden and are revealed by a slim button.
- Published as one GitHub repo that is marketplace and plugin at once (`miclux/launchbar`).

## Files
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` (plugin source `./`), `hooks/hooks.json` (one module).
- `hooks/register.tsx`: the mod. `hooks/art.ts`: static gradient (`ART_SVG`). `hooks/register.test.ts`: tests. `types/index.d.ts`: `$.state` contract.

## Behaviour
- `ui.render` on `AbovePrompt`. `inspect($)` reads `$.session.root()` and probes `.git` / `.launchbar` through PowerShell (cached per folder).
- Survey in the slot, or nothing to show: `next(e)`. Otherwise a column with the panels, the reveal button and `await next(e)` below.
- Store key `panels` = `[{ id, scope }]`, max 2, default `[{ id: 'main', scope: 'global' }]`. Button lists: `buttons:global:<id>` or `buttons:local:<id>:<root>`; switching the scope keeps both lists.
- State atoms: `buttons` (lists being edited), `editing` (panel id), `confirm` (`<panel>|<button>` or `panel|<panel>`), `draft`, `revealed` (per session, default false).
- Buttons run `powershell -NoProfile -Command <cmd>` via `Start-Process` in the project folder through `$.process.run`, so the child outlives the call; a toast reports start or error.
- Gear: edit mode with `+` (name, then command), `−` with inline confirm, scope switch "Global"/"Lokal", "+ Panel", "Panel −"; the check mark saves. A new panel is put first, so it appears above the existing one.
- Look: ground `#141416`, round border `#2a2a2f`, static gradient from the right, one row per panel.

## Stumbling blocks
- `claude` is not always on PATH: run `claude plugin validate|test` from the Desktop app's `claude.exe`.
- The validator refuses `$` passed to a function that is not a top-level declaration: helpers are hoisted out of `register`.
- Test mocks answer as `{ value: ... }`; the stand-in for the bar below must return a real tree.
- Desktop app loading: `CLAUDE_CODE_PLUGIN_DIRS` and marketplaces did not show the panel there; only `dev-mods/<session-id>/<mod>/` with hot reloading confirmed works, per session.

## Known limits
- Windows and PowerShell only. Not yet verified in a real Desktop session; the tests have not been run yet.
- Whether the effortless bar sits under the panel depends on hook order.
