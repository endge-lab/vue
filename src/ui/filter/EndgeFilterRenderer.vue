<script setup lang="ts">
import type { EndgeFilterRendererProps } from '@/domain/types/filter-renderer.type'
import type { FilterViewBuiltinProps, FilterViewRenderModel } from '@endge/core'

import { Endge } from '@endge/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import EndgeFilterField from '@/ui/filter/EndgeFilterField.vue'

const props = defineProps<EndgeFilterRendererProps>()
const model = ref<FilterViewRenderModel>(props.runtime.getRenderModel())
const adapterVersion = ref(0)
const fields = computed(() => model.value.fields.filter(field => field.type !== 'Object'))
const builtinProps = computed<FilterViewBuiltinProps>(() => {
  const value = model.value.props
  return value && typeof value === 'object' ? value as FilterViewBuiltinProps : {}
})
const showLabels = computed(() => builtinProps.value.showLabels !== false)
const refresh = () => { model.value = props.runtime.getRenderModel() }
const unsubscribeAdapter = Endge.uiRegistry.subscribe(() => {
  adapterVersion.value += 1
})

function bind(runtime: EndgeFilterRendererProps['runtime']): void {
  runtime.on('render:change', refresh)
  refresh()
}

function unbind(runtime: EndgeFilterRendererProps['runtime']): void {
  runtime.off('render:change', refresh)
}

watch(() => props.runtime, (next, previous) => {
  if (previous)
    unbind(previous)
  bind(next)
}, { immediate: true })
onBeforeUnmount(() => {
  unbind(props.runtime)
  unsubscribeAdapter()
})

async function updateField(key: string, value: unknown): Promise<void> {
  if (props.readonly)
    return
  await props.runtime.setValue(key, value)
}

function fieldLabel(key: string): string {
  const label = builtinProps.value.labels?.[key]
  return typeof label === 'string' && label.trim() ? label : key
}
</script>

<template>
  <div
    v-if="model.implementation.kind === 'generated'"
    class="endge-filter-renderer"
    :aria-readonly="readonly === true"
    :data-adapter-version="adapterVersion"
  >
    <EndgeFilterField
      v-for="field in fields"
      :key="`${adapterVersion}:${field.key}`"
      :field="field"
      :label="fieldLabel(field.key)"
      :show-label="showLabels"
      :readonly="readonly"
      @update:value="updateField(field.key, $event)"
    />
  </div>
  <div v-else class="endge-filter-renderer__unsupported">
    {{ `Пользовательский Filter view "${model.implementation.identity}" пока не подключён к renderer-у.` }}
  </div>
</template>

<style scoped>
.endge-filter-renderer { align-items: end; display: flex; flex-wrap: wrap; gap: .75rem; min-width: 0; }
.endge-filter-renderer__unsupported { color: var(--muted-foreground, #64748b); font-size: .875rem; }
</style>
