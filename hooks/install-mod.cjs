// SessionStart / UserPromptSubmit: copy this plugin into dev-mods/<session-id>/launchbar so the
// Desktop app hot-loads it (it only loads mods from there, per session). Skips when already there.
const fs = require('fs'), path = require('path'), os = require('os')
let raw = ''
process.stdin.on('data', d => (raw += d))
process.stdin.on('end', () => {
  try {
    const i = JSON.parse(raw || '{}')
    if (!i.session_id) return
    const root = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..')
    const dest = path.join(os.homedir(), '.claude', 'dev-mods', i.session_id, 'launchbar')
    if (fs.existsSync(path.join(dest, 'hooks', 'hooks.json'))) return
    const skip = new Set(['.git', '.in_use', '.orphaned_at', 'node_modules'])
    fs.cpSync(root, dest, { recursive: true, filter: s => !skip.has(path.basename(s)) })
  } catch (e) {
    try { fs.appendFileSync(path.join(os.homedir(), '.claude', 'hooks', 'launchbar-install.log'), `${new Date().toISOString()} ${e}\n`) } catch {}
  }
})
