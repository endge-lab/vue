import type { ContextMenuDescriptor, RuntimeActionContext } from '@endge/core'
import { Endge } from '@endge/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  closeEndgeContextMenu,
  executeEndgeContextMenuItem,
  getExecutableContextMenuItems,
  openEndgeContextMenu,
} from '@/ui/overlay/context-menu-manager'

const menu: ContextMenuDescriptor = {
  kind: 'context-menu',
  items: [{ kind: 'item', id: 'test.run', action: 'test.run', label: 'Run' }],
}

describe('context menu Action execution', () => {
  afterEach(() => {
    Endge.runtime.actions.unregister('test.run')
    closeEndgeContextMenu()
  })

  it('filters and executes items through Endge.runtime.actions', async () => {
    const execute = vi.fn()
    const context: RuntimeActionContext = { surface: 'test' }
    Endge.runtime.actions.register({ id: 'test.run', surface: 'test', execute })
    openEndgeContextMenu({ ownerId: 'owner', x: 0, y: 0, menu, context })

    expect(getExecutableContextMenuItems()).toEqual(menu.items)
    await executeEndgeContextMenuItem(menu.items[0] as Extract<typeof menu.items[number], { kind: 'item' }>)

    expect(execute).toHaveBeenCalledWith(context, undefined)
  })
})
