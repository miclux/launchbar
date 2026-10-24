import { expect, test } from 'claude-code/testing'

const PROPS = { hasSurvey: false, maxRows: 12 } as never

// Answers the host beneath the plugin: the session's folder and whether the project probe finds .git / .launchbar.
function host(on: any, root: string, project: boolean) {
  on('session.root', async () => ({ value: root }))
  on('ui.render', async ($: any, e: unknown) => {
    const { Box, Text } = $.ui.resolve(e)
    const h = (globalThis as any).h
    return h(Box, { key: 'bar' }, h(Text, {}, 'bar'))
  })
  on('process.run', async () => ({ value: { exitCode: 0, stdout: project ? 'yes' : 'no', stderr: '' } }))
}

test('the global panel shows everywhere', async ($, on) => {
  host(on, 'C:\work\app', true)
  const ui = await ($ as any).ui.mount({ plugin: 'launchbar', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ key: 'panel-main' })).toBeDefined()
})

test('a local panel shows in a project', async ($, on) => {
  host(on, 'C:\work\app', true)
  await ($ as any).store.set('panels', [{ id: 'main', scope: 'local' }])
  const ui = await ($ as any).ui.mount({ plugin: 'launchbar', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ key: 'panel-main' })).toBeDefined()
})

test('a local panel is hidden outside a project', async ($, on) => {
  host(on, 'C:\work', false)
  await ($ as any).store.set('panels', [{ id: 'main', scope: 'local' }])
  const ui = await ($ as any).ui.mount({ plugin: 'launchbar', surface: 'desktop', component: 'AbovePrompt', props: PROPS })
  expect(await ui.find({ key: 'panel-main' })).toBeUndefined()
})
