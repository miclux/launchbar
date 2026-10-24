export type PanelButton = { id: string; label: string; cmd?: string }
export type Draft = { panel: string; step: 'name' | 'cmd'; name: string } | null

declare module 'claude-code' {
  interface PluginState {
    'launchbar': {
      // Edited button lists while a panel is in edit mode, keyed by the store key of the list.
      buttons: Record<string, PanelButton[]> | null
      // Id of the panel being edited, or null.
      editing: string | null
      draft: Draft
      // Local panels are shown only after the user revealed them in this session.
      revealed: boolean
      // "<panel id>|<button id>" of the button waiting for remove confirmation, or "panel|<panel id>" for a panel.
      confirm: string | null
    }
  }
}
