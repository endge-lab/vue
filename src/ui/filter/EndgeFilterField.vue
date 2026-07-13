<script setup lang="ts">
import type { FilterViewRenderField, SourceFieldOption } from '@endge/core'

import { Endge } from '@endge/core'
import { computed, ref, watch } from 'vue'

import { EndgeFilterControlRenderer } from '@/ui/filter/EndgeFilterControlRenderer'

const props = defineProps<{
  field: FilterViewRenderField
  label?: string
  showLabel?: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{ (event: 'update:value', value: unknown): void }>()
const vocabOptions = ref<SourceFieldOption[]>([])
const vocabLoading = ref(false)
const vocabError = ref<string | null>(null)
const options = computed<SourceFieldOption[]>(() => {
  const source = props.field.vocab ? vocabOptions.value : props.field.options
  return source.map(item => ({
    value: item.value,
    label: item.label ?? String(item.value),
  }))
})

watch(() => props.field.vocab?.identity, () => void loadVocab(), { immediate: true })

async function loadVocab(): Promise<void> {
  const vocab = props.field.vocab
  if (!vocab) {
    vocabOptions.value = []
    vocabError.value = null
    return
  }
  vocabLoading.value = true
  vocabError.value = null
  try {
    const rows = await Endge.vocabs.loadVocab(vocab.identity, { throwOnError: true })
    vocabOptions.value = rows.map(row => {
      const rawValue = readPath(row, vocab.valuePath)
      const value = typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
        ? rawValue
        : String(rawValue ?? '')
      return {
        value,
        label: String(readPath(row, vocab.labelPath) ?? value),
      }
    })
  }
  catch (error) {
    vocabOptions.value = []
    vocabError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    vocabLoading.value = false
  }
}

function readPath(source: unknown, path: string): unknown {
  return String(path ?? '').split('.').filter(Boolean).reduce<any>((value, key) => value?.[key], source as any)
}
</script>

<template>
  <div class="endge-filter-field" :data-loading="vocabLoading ? '' : undefined">
    <span
      v-if="showLabel !== false && field.control.type !== 'Checkbox'"
      class="endge-filter-field__label"
    >
      {{ label || field.key }}
    </span>
    <EndgeFilterControlRenderer
      :field="field"
      :options="options"
      :label="label || field.key"
      :readonly="readonly"
      @update:value="emit('update:value', $event)"
    />
    <small v-if="vocabError" class="endge-filter-field__error">{{ vocabError }}</small>
  </div>
</template>

<style scoped>
.endge-filter-field { display: grid; flex: 0 1 16rem; gap: .35rem; min-width: 12rem; }
.endge-filter-field__label { color: var(--muted-foreground, #64748b); font-size: .75rem; }
.endge-filter-field__error { color: var(--destructive, #ef4444); }
.endge-filter-field[data-loading] { opacity: .72; }
</style>
