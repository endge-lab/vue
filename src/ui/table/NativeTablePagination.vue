<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  pageIndex: number
  pageSize: number
  pageCount: number
  pageSizes: number[]
  lazy?: boolean
}>()

const emit = defineEmits<{
  (event: 'update:page-index', value: number): void
  (event: 'update:page-size', value: number): void
}>()

const canPrevious = computed(() => props.pageIndex > 0)
const canNext = computed(() => props.pageIndex + 1 < props.pageCount)
const pageSizeOptions = computed(() => [...new Set([...props.pageSizes, props.pageSize])]
  .filter(size => Number.isFinite(size) && size > 0)
  .sort((left, right) => left - right))

function setPageSize(event: Event): void {
  const target = event.target
  if (target instanceof HTMLSelectElement)
    emit('update:page-size', Number(target.value))
}
</script>

<template>
  <footer class="endge-native-table-pagination" :data-lazy="lazy ? 'true' : undefined" aria-label="Table pagination">
    <div class="endge-native-table-pagination__controls">
      <label class="endge-native-table-pagination__page-size">
        <span>Rows per page</span>
        <span class="endge-native-table-pagination__select">
          <select :value="pageSize" aria-label="Rows per page" @change="setPageSize">
            <option v-for="size in pageSizeOptions" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
        </span>
      </label>

      <span class="endge-native-table-pagination__label">Page {{ pageIndex + 1 }} of {{ pageCount }}</span>

      <div class="endge-native-table-pagination__buttons">
        <button type="button" aria-label="First page" :disabled="!canPrevious" @click="emit('update:page-index', 0)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m11 18-6-6 6-6M19 18l-6-6 6-6" /></svg>
        </button>
        <button type="button" aria-label="Previous page" :disabled="!canPrevious" @click="emit('update:page-index', pageIndex - 1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button type="button" aria-label="Next page" :disabled="!canNext" @click="emit('update:page-index', pageIndex + 1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
        <button type="button" aria-label="Last page" :disabled="!canNext" @click="emit('update:page-index', pageCount - 1)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 18 6-6-6-6M5 18l6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.endge-native-table-pagination { align-items: center; background: var(--background, #fff); color: var(--foreground, #18181b); display: flex; flex: none; justify-content: flex-end; min-height: 3.25rem; padding: .5rem .45rem 0; }
.endge-native-table-pagination__controls, .endge-native-table-pagination__page-size, .endge-native-table-pagination__buttons { align-items: center; display: flex; }
.endge-native-table-pagination__controls { gap: 2rem; }
.endge-native-table-pagination__page-size { font-size: .8125rem; font-weight: 580; gap: .6rem; white-space: nowrap; }
.endge-native-table-pagination__select { display: inline-grid; position: relative; }
.endge-native-table-pagination__select::after { border-bottom: 1.5px solid var(--muted-foreground, #71717a); border-right: 1.5px solid var(--muted-foreground, #71717a); content: ''; height: .36rem; pointer-events: none; position: absolute; right: .8rem; top: 50%; transform: translateY(-70%) rotate(45deg); width: .36rem; }
.endge-native-table-pagination select { appearance: none; background: var(--background, #fff); border: 1px solid var(--border, #e4e4e7); border-radius: .5rem; color: inherit; cursor: pointer; font: inherit; font-variant-numeric: tabular-nums; height: 2.25rem; min-width: 4.7rem; outline: none; padding: 0 2.1rem 0 .75rem; }
.endge-native-table-pagination__label { font-size: .8125rem; font-variant-numeric: tabular-nums; font-weight: 580; min-width: 5.75rem; text-align: center; white-space: nowrap; }
.endge-native-table-pagination__buttons { border: 1px solid var(--border, #e4e4e7); border-radius: .5rem; overflow: hidden; }
.endge-native-table-pagination button { align-items: center; background: var(--background, #fff); border: 0; color: inherit; cursor: pointer; display: inline-flex; height: 2.25rem; justify-content: center; outline: none; padding: 0; width: 2.25rem; }
.endge-native-table-pagination button + button { border-left: 1px solid var(--border, #e4e4e7); }
.endge-native-table-pagination button:not(:disabled):hover { background: var(--accent, #f4f4f5); }
.endge-native-table-pagination button:disabled { color: var(--muted-foreground, #71717a); cursor: not-allowed; opacity: .48; }
.endge-native-table-pagination button:focus-visible, .endge-native-table-pagination select:focus-visible { box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring, #a1a1aa) 24%, transparent); position: relative; z-index: 2; }
.endge-native-table-pagination svg { fill: none; height: 1rem; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; width: 1rem; }
@container (max-width: 620px) { .endge-native-table-pagination__controls { gap: .75rem; } .endge-native-table-pagination__page-size > span:first-child { display: none; } }
</style>
