<script setup lang="ts">
import type { ContextMenuItemDescriptor } from '@endge/core'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import {
  closeEndgeContextMenu,
  endgeContextMenuState,
  executeEndgeContextMenuItem,
  getExecutableContextMenuItems,
} from '@/ui/overlay/context-menu-manager'

const menuRef = ref<HTMLElement | null>(null)
const menuItems = computed(() => getExecutableContextMenuItems())
const position = computed(() => ({
  left: `${endgeContextMenuState.x}px`,
  top: `${endgeContextMenuState.y}px`,
}))

watch(
  () => endgeContextMenuState.open,
  async (open) => {
    if (!open) {
      removeGlobalListeners()
      return
    }

    addGlobalListeners()
    await nextTick()
    clampMenuToViewport()
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  removeGlobalListeners()
})

function addGlobalListeners(): void {
  document.addEventListener('mousedown', onDocumentMouseDown, true)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', closeOnWindowChange, { passive: true })
  window.addEventListener('scroll', closeOnWindowChange, { passive: true, capture: true })
}

function removeGlobalListeners(): void {
  document.removeEventListener('mousedown', onDocumentMouseDown, true)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', closeOnWindowChange)
  window.removeEventListener('scroll', closeOnWindowChange, true)
}

function onDocumentMouseDown(event: MouseEvent): void {
  if (menuRef.value?.contains(event.target as Node))
    return

  closeEndgeContextMenu()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape')
    closeEndgeContextMenu()
}

function closeOnWindowChange(): void {
  closeEndgeContextMenu()
}

function clampMenuToViewport(): void {
  const menu = menuRef.value
  if (!menu)
    return

  const rect = menu.getBoundingClientRect()
  const margin = 8
  const nextX = Math.min(endgeContextMenuState.x, window.innerWidth - rect.width - margin)
  const nextY = Math.min(endgeContextMenuState.y, window.innerHeight - rect.height - margin)

  endgeContextMenuState.x = Math.max(margin, nextX)
  endgeContextMenuState.y = Math.max(margin, nextY)
}

async function runItem(item: ContextMenuItemDescriptor): Promise<void> {
  await executeEndgeContextMenuItem(item)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="endgeContextMenuState.open && menuItems.length > 0"
      ref="menuRef"
      role="menu"
      class="endge-context-menu-root"
      :style="position"
      @click.stop
      @contextmenu.prevent.stop
    >
      <template
        v-for="item in menuItems"
        :key="item.id"
      >
        <div
          v-if="item.kind === 'separator'"
          role="separator"
          class="endge-context-menu-root__separator"
        />
        <button
          v-else
          type="button"
          role="menuitem"
          class="endge-context-menu-root__item"
          @click="runItem(item)"
        >
          <span
            v-if="item.icon"
            class="endge-context-menu-root__icon"
          >
            {{ item.icon }}
          </span>
          <span class="endge-context-menu-root__label">{{ item.label }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.endge-context-menu-root {
  position: fixed;
  z-index: 10050;
  min-width: 210px;
  max-width: 320px;
  padding: 4px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  background: #fff;
  color: #111827;
  box-shadow:
    0 18px 45px rgba(15, 23, 42, 0.14),
    0 4px 12px rgba(15, 23, 42, 0.08);
  font-size: 13px;
  line-height: 1.35;
}

.endge-context-menu-root__item {
  display: flex;
  width: 100%;
  min-height: 30px;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 6px 8px;
  text-align: left;
}

.endge-context-menu-root__item:hover,
.endge-context-menu-root__item:focus-visible {
  background: rgba(15, 23, 42, 0.07);
  outline: none;
}

.endge-context-menu-root__icon {
  width: 16px;
  flex: 0 0 16px;
  opacity: 0.72;
  text-align: center;
}

.endge-context-menu-root__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endge-context-menu-root__separator {
  height: 1px;
  margin: 4px 2px;
  background: rgba(15, 23, 42, 0.1);
}
</style>
