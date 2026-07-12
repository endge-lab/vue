<script setup lang="ts">
import type { EndgeFilterRendererProps } from '@/domain/types/filter-renderer.type'
import type { SourceFieldDefinition } from '@endge/core'

import { computed, onBeforeUnmount, ref, watch } from 'vue'

import EndgeFilterField from '@/ui/filter/EndgeFilterField.vue'

const props = defineProps<EndgeFilterRendererProps>()
const state = ref<Record<string, unknown>>({ ...props.runtime.getState() })
const refresh = () => { state.value = { ...props.runtime.getState() } }
const fields = computed<SourceFieldDefinition[]>(() => {
  const source = props.slice?.fields ?? props.runtime.getFields()
  return source.filter(field => field.type !== 'Object')
})

function bind(runtime: EndgeFilterRendererProps['runtime']): void {
  runtime.on('state:change', refresh)
  runtime.on('output:change', refresh)
  refresh()
}

function unbind(runtime: EndgeFilterRendererProps['runtime']): void {
  runtime.off('state:change', refresh)
  runtime.off('output:change', refresh)
}

watch(() => props.runtime, (next, previous) => {
  if (previous)
    unbind(previous)
  bind(next)
}, { immediate: true })
onBeforeUnmount(() => unbind(props.runtime))

async function updateField(key: string, value: unknown): Promise<void> {
  if (props.readonly)
    return
  await props.runtime.command('patch').run({ [key]: value })
}
</script>

<template>
  <div class="endge-filter-renderer" :aria-readonly="readonly === true">
    <EndgeFilterField
      v-for="field in fields"
      :key="field.key"
      :runtime="runtime"
      :field="field"
      :model-value="state[field.key]"
      :readonly="readonly"
      @update:model-value="updateField(field.key, $event)"
    />
  </div>
</template>

<style scoped>
.endge-filter-renderer { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; min-width: 0; }
</style>
