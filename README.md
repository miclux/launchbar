# Launchbar

Command buttons above the Claude Code prompt. Click a button, your command starts (detached, no terminal needed).

- Up to **two panels**. Each is either **global** (shown in every session, one shared button list) or **local** (one button list per project; a project is a folder with `.git` or a `.launchbar` file).
- A new session shows only the global panel. A slim "▸ Projekt-Panel" button reveals the local panels.
- Press the gear (⚙) to edit: add buttons with `+` (name, then command), remove with `−`, switch a panel between "Global" and "Lokal", add or remove the second panel. Press ✓ to save.
- Buttons run `powershell -NoProfile -Command <your command>` in the project folder (Windows).

## Install

```
/plugin marketplace add miclux/launchbar
/plugin install launchbar@launchbar
```

In the Claude Desktop app, mods load per session through hot reloading: copy the plugin folder to `~/.claude/dev-mods/<session-id>/launchbar/` and confirm "Enable hot reloading for this session".

## Develop

`hooks/register.tsx` is the mod, `hooks/register.test.ts` its tests, `IMPLEMENTATION.md` the design log.

MIT licensed.
