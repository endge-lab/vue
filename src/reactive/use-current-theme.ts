import { Endge } from '@endge/core'
import { onScopeDispose, ref } from 'vue'

/**
 * Текущая пользовательская тема из EndgeContext.
 * Каталог и default theme принадлежат активному workspace.
 */
export function useCurrentTheme() {
  const context = Endge.context
  const current = ref<string>(context.currentTheme)

  const off = context.subscribe(() => {
    current.value = context.currentTheme
  })
  onScopeDispose(off)

  return {
    current,
    setCurrent: (theme: string | null) => context.setCurrentTheme(theme),
  }
}
