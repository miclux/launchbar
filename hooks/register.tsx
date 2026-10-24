// Launchbar: up to two button panels above the prompt.
// A panel is "global" (shown in every session, one shared button list) or "local" (shown only in a project, own list per project).
// A project is a folder with a .git directory or a .launchbar file. The scope is switched in the panel's settings (gear).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'
import type { Draft, PanelButton } from '../types'
import { ART_SVG } from './art'

type Scope = 'global' | 'local'
type PanelCfg = { id: string; scope: Scope }

const MAX_PANELS = 2
const DEFAULT_PANELS: PanelCfg[] = [{ id: 'main', scope: 'global' }]

// Buttons are edited in the state and saved to the store when the gear is pressed again.
const buttonsAtom = atom({ plugin: 'launchbar', key: 'buttons' } as const, null as Record<string, PanelButton[]> | null)
const editingAtom = atom({ plugin: 'launchbar', key: 'editing' } as const, null as string | null)
const confirmAtom = atom({ plugin: 'launchbar', key: 'confirm' } as const, null as string | null)
const draftAtom = atom({ plugin: 'launchbar', key: 'draft' } as const, null as Draft)


const ps = (text: string) => text.replace(/'/g, "''")

// The folder the last answer was for, and whether it is a project.
let known: { root: string; isProject: boolean } | null = null

async function inspect($: EngineInterface): Promise<{ root: string; isProject: boolean }> {
  const root = await $.session.root()
  if (known && known.root === root) return known
  // A project: a .git directory/file (also in a worktree) or a .launchbar marker file in the root.
  const probe = `if ((Test-Path -LiteralPath '${ps(root)}\\.git') -or (Test-Path -LiteralPath '${ps(root)}\\.launchbar')) { 'yes' } else { 'no' }`
  const isProject =
    (await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', probe], { timeoutMs: 8000 }).then(r => r.stdout.includes('yes'), () => false))
  known = { root, isProject }
  return known
}

// Started detached through Start-Process, so the app outlives the call and is not tied to the session.
async function launch($: EngineInterface, name: string, script: string) {
  const out = await $.process.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 20000 }).catch(
    (err: unknown) => ({ exitCode: 1, stdout: '', stderr: String(err) }),
  )
  $.ui.toast(out.exitCode === 0 ? `${name} started` : `${name} did not start: ${out.stderr.trim().slice(0, 160)}`)
}

// Where a panel's button list lives: one list for a global panel, one per project folder for a local one.
const listKey = (p: PanelCfg, root: string) => (p.scope === 'global' ? `buttons:global:${p.id}` : `buttons:local:${p.id}:${root.toLowerCase()}`)

async function draw($: EngineInterface, e: any, next: (x: any) => Promise<any>) {
    if (e.props.hasSurvey) return next(e)
    const { root, isProject } = await inspect($)

    const storedPanels = (await $.store.get('panels')) as PanelCfg[] | undefined
    const panels = storedPanels && storedPanels.length ? storedPanels : DEFAULT_PANELS
    // Local panels above, global panels below.
    const visible = [...panels.filter(p => p.scope === 'local' && isProject), ...panels.filter(p => p.scope === 'global')]
    if (!visible.length) return next(e)

    const { Box, Button, Input } = $.ui.resolve(e)
    const r = ps(root)
    const runCustom = (b: PanelButton) => {
      $.ui.toast(`${b.label}: Start …`)
      return launch($, b.label, `Start-Process -FilePath 'powershell' -WorkingDirectory '${r}' -WindowStyle Hidden -ArgumentList '-NoProfile','-Command','${ps(b.cmd ?? '')}'`)
    }

    // Effortless look (Designs/effortless.md): ground #141416, hairline #2a2a2f, text #d4d4d8, dim #8b8b93, one violet accent, faint light on the right.
    const { Svg } = $.ui.resolve(e) as unknown as { Svg?: (p: Record<string, unknown>) => unknown }

    const editing = await read($, editingAtom)
    const draft = await read($, draftAtom)
    const confirm = await read($, confirmAtom)

    const savePanels = (list: PanelCfg[]) => $.store.set('panels', list)
    const setDraft = (d: Draft) => update($, draftAtom, () => d)

    const renderPanel = async (p: PanelCfg) => {
      const key = listKey(p, root)
      const isEditing = editing === p.id
      // The button list: the edited one, else the saved one, else the defaults.
      const stored = (await $.store.get(key)) as PanelButton[] | undefined
      const fallback: PanelButton[] = []
      const load = async () => (await read($, buttonsAtom))?.[key] ?? stored ?? fallback
      const buttons = await load()
      const setButtons = async (list: PanelButton[]) => update($, buttonsAtom, cur => ({ ...(cur ?? {}), [key]: list }))

      // Asks inline in the panel (the minus turns into "✓ ✕"), no dialog and no model involved.
      const remove = async (b: PanelButton) => {
        await setButtons((await load()).filter(x => x.id !== b.id))
        await update($, confirmAtom, () => null)
      }
      const toggleEdit = async () => {
        if (isEditing) {
          await $.store.set(key, await load())
          await setDraft(null)
          await update($, confirmAtom, () => null)
          await update($, editingAtom, () => null)
          $.ui.toast('Buttons gespeichert')
        } else {
          await setButtons(await load())
          await update($, editingAtom, () => p.id)
        }
      }
      const addDraft = async (value: string) => {
        const text = value.trim()
        if (!text || !draft) return
        if (draft.step === 'name') return setDraft({ panel: p.id, step: 'cmd', name: text })
        const list = await load()
        await setButtons([...list, { id: `custom-${await $.clock.now()}`, label: draft.name, cmd: text }])
        await setDraft(null)
      }
      // Global <-> local: the panel keeps its two lists apart; the switch is saved at once.
      const switchScope = async () => {
        const nextScope: Scope = p.scope === 'global' ? 'local' : 'global'
        await setDraft(null)
        await savePanels(panels.map(x => (x.id === p.id ? { ...x, scope: nextScope } : x)))
        $.ui.toast(nextScope === 'global' ? 'Panel ist jetzt global (immer sichtbar)' : 'Panel ist jetzt lokal (nur in Projekten)')
      }
      const addPanel = async () => {
        const id = panels.some(x => x.id === 'second') ? `second-${await $.clock.now()}` : 'second'
        await savePanels([...panels, { id, scope: 'local' }])
        $.ui.toast('Zweites Panel angelegt (lokal)')
      }
      const removePanel = async () => {
        await savePanels(panels.filter(x => x.id !== p.id))
        await update($, confirmAtom, () => null)
        await update($, editingAtom, () => null)
        await setDraft(null)
      }

      const myDraft = draft && draft.panel === p.id ? draft : null
      const row = buttons.map(b => (
        <Box key={`row-${p.id}-${b.id}`} flexDirection="row" alignItems="center">
          <Button key={`bp-${p.id}-${b.id}`} label={b.label} onPress={() => runCustom(b)} />
          {isEditing && confirm !== `${p.id}|${b.id}` ? <Button key={`minus-${p.id}-${b.id}`} label="−" onPress={() => update($, confirmAtom, () => `${p.id}|${b.id}`)} /> : null}
          {isEditing && confirm === `${p.id}|${b.id}` ? (
            <Box key={`ask-${p.id}-${b.id}`} flexDirection="row" alignItems="center" gap={1}>
              <Button key={`yes-${p.id}-${b.id}`} label="✓" onPress={() => remove(b)} />
              <Button key={`no-${p.id}-${b.id}`} label="✕" onPress={() => update($, confirmAtom, () => null)} />
            </Box>
          ) : null}
        </Box>
      ))
      const adder = !isEditing ? null : myDraft ? (
        <Box key={`draft-${p.id}`} flexDirection="row" alignItems="center" gap={1}>
          <Box key={`draft-width-${p.id}`} width={20} flexShrink={0}>
            <Input
              key={`draft-${p.id}-${myDraft.step}`}
              placeholder={myDraft.step === 'name' ? 'Name des Buttons, z. B. Tests' : `Was soll "${myDraft.name}" ausführen? z. B. py tests/test_x.py`}
              submitLabel={myDraft.step === 'name' ? 'weiter' : 'anlegen'}
              autoFocus
              onSubmit={addDraft}
            />
          </Box>
          <Button key={`draft-cancel-${p.id}`} label="✕" onPress={() => setDraft(null)} />
        </Box>
      ) : (
        <Button key={`plus-${p.id}`} label="+" onPress={() => setDraft({ panel: p.id, step: 'name', name: '' })} />
      )

      // Panel settings, only in edit mode: scope switch, add a second panel, remove this panel (when there are two).
      const canAdd = panels.length < MAX_PANELS
      const canRemove = panels.length > 1
      const settings = !isEditing ? null : (
        <Box key={`settings-${p.id}`} flexDirection="row" alignItems="center" gap={1}>
          <Button key={`scope-${p.id}`} label={p.scope === 'global' ? 'Global' : 'Lokal'} onPress={switchScope} />
          {canAdd ? <Button key={`addpanel-${p.id}`} label="+ Panel" onPress={addPanel} /> : null}
          {canRemove && confirm !== `panel|${p.id}` ? <Button key={`rmpanel-${p.id}`} label="Panel −" onPress={() => update($, confirmAtom, () => `panel|${p.id}`)} /> : null}
          {canRemove && confirm === `panel|${p.id}` ? (
            <Box key={`askpanel-${p.id}`} flexDirection="row" alignItems="center" gap={1}>
              <Button key={`yespanel-${p.id}`} label="Panel entfernen ✓" onPress={removePanel} />
              <Button key={`nopanel-${p.id}`} label="✕" onPress={() => update($, confirmAtom, () => null)} />
            </Box>
          ) : null}
        </Box>
      )

      // The gradient art as an absolute background layer over the whole frame; it is the FIRST child so the buttons paint over it.
      const art = Svg ? (
        <Box key={`art-${p.id}`} position="absolute" top={0} bottom={0} left={0} right={0} overflow="hidden" flexDirection="row" justifyContent="flex-end" alignItems="center">
          <Svg source={ART_SVG} alt="Launchbar art" width={1100} height={90} />
        </Box>
      ) : null

      return (
        <Box key={`panel-${p.id}`} flexDirection="row" alignItems="center" borderStyle="round" borderColor="#2a2a2f" backgroundColor="#141416" overflow="hidden">
          {art}
          <Box key={`content-${p.id}`} position="absolute" top={0} bottom={0} left={0} right={0} flexDirection="row" alignItems="center" paddingX={1}>
            <Box flexDirection="row" alignItems="center" gap={2} flexGrow={1} flexShrink={1}>
              {row}
              {adder}
              {settings}
            </Box>
            <Box key={`gear-box-${p.id}`} flexShrink={0}>
              <Button key={`gear-${p.id}`} label={isEditing ? '✓' : '⚙'} onPress={toggleEdit} />
            </Box>
          </Box>
          <Box key={`height-${p.id}`} height={1} />
        </Box>
      )
    }

    const rendered = []
    for (const p of visible) rendered.push(await renderPanel(p))

    // Stacked over whatever the plugins beneath draw (the effortless bar), or alone when they draw nothing.
    const below = await next(e)
    return (
      <Box key="launchbar-stack" flexDirection="column">
        {rendered}
        {below}
      </Box>
    )
  }

export const register: Register = on => {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    try {
    return await draw($, e, next)
    } catch (err) {
      $.ui.toast(`launchbar: ${String(err).slice(0, 200)}`)
      return next(e)
    }
  })

}
