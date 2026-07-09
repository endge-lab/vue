import type {
  ContextMenuDescriptor,
  ContextMenuItemDescriptor,
  ContextMenuNodeDescriptor,
  RuntimeCommandContext,
} from '@endge/core'
import { Endge } from '@endge/core'
import { reactive } from 'vue'

export interface EndgeContextMenuOpenInput<TContext extends RuntimeCommandContext = RuntimeCommandContext> {
  ownerId: string
  x: number
  y: number
  menu: ContextMenuDescriptor
  context: TContext
}

export interface EndgeContextMenuState {
  open: boolean
  ownerId: string | null
  x: number
  y: number
  menu: ContextMenuDescriptor | null
  context: RuntimeCommandContext | null
}

export const endgeContextMenuState = reactive<EndgeContextMenuState>({
  open: false,
  ownerId: null,
  x: 0,
  y: 0,
  menu: null,
  context: null,
})

export function openEndgeContextMenu(input: EndgeContextMenuOpenInput): void {
  endgeContextMenuState.open = true
  endgeContextMenuState.ownerId = input.ownerId
  endgeContextMenuState.x = input.x
  endgeContextMenuState.y = input.y
  endgeContextMenuState.menu = input.menu
  endgeContextMenuState.context = input.context
}

export function closeEndgeContextMenu(ownerId?: string): void {
  if (ownerId && endgeContextMenuState.ownerId !== ownerId)
    return

  endgeContextMenuState.open = false
  endgeContextMenuState.ownerId = null
  endgeContextMenuState.menu = null
  endgeContextMenuState.context = null
}

export function getExecutableContextMenuItems(): ContextMenuNodeDescriptor[] {
  const menu = endgeContextMenuState.menu
  const context = endgeContextMenuState.context
  if (!menu || !context)
    return []

  return compactSeparators(menu.items.filter((item) => {
    if (item.kind === 'separator')
      return true

    return Endge.commands.canExecute(item.command, context)
  }))
}

export async function executeEndgeContextMenuItem(item: ContextMenuItemDescriptor): Promise<void> {
  const context = endgeContextMenuState.context
  if (!context)
    return

  await Endge.commands.execute(item.command, context)
  closeEndgeContextMenu()
}

function compactSeparators(items: ContextMenuNodeDescriptor[]): ContextMenuNodeDescriptor[] {
  const result: ContextMenuNodeDescriptor[] = []

  for (const item of items) {
    if (item.kind !== 'separator') {
      result.push(item)
      continue
    }

    if (result.length === 0 || result[result.length - 1]?.kind === 'separator')
      continue

    result.push(item)
  }

  if (result[result.length - 1]?.kind === 'separator')
    result.pop()

  return result
}
