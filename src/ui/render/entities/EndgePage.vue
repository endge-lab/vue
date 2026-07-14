<script setup lang="ts">
import type { RPage, RuntimeHost } from '@endge/core'

import { Endge } from '@endge/core'
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Identity страницы в домене (RPage). */
    identity: string
    /** Параметры страницы (route params, query). При смене эмитится params-change. */
    params?: Record<string, unknown>
  }>(),
  { params: () => ({}) },
)

const page = computed<RPage | null>(() =>
  Endge.domain.getPage(props.identity) ?? null,
)

const pageRuntime = ref<RuntimeHost | null>(null)
const _prevParams = ref<Record<string, unknown> | undefined>(undefined)

function getResolverOpts() {
  const p = page.value
  if (!p || p.id == null) { return null }
  return {
    ownerType: 'page' as const,
    ownerId: p.id,
    targetType: 'page' as const,
    targetId: p.id,
    environmentId: undefined as number | null | undefined,
  }
}

function emitEvent(eventName: string, payload?: Record<string, unknown>) {
  const opts = getResolverOpts()
  if (!opts) { return }
  if (typeof console !== 'undefined') {
    console.log('[EndgePage] событие жизненного цикла:', eventName, 'page=', props.identity, 'ownerId=', opts.ownerId)
  }
  Endge.configuration.behaviorBindings.runOwnerEvent({
    ...opts,
    eventName,
    payload,
  })
}

/**
 * LIFECYCLE
 * Порядок: before-enter → enter → (создание runtime) → ready → [Vue mount] → mounted.
 * При уходе: before-leave → leave → destroy runtime.
 */

onBeforeMount(() => {
  if (!page.value) { return }
  emitEvent('before-enter', { params: props.params })
  emitEvent('enter', { params: props.params })

  const host = Endge.runtime.execute(page.value, {})
  if (host) {
    pageRuntime.value = host
    emitEvent('ready', { params: props.params, runtimeId: host.id })
  }
})

onMounted(() => {
  if (!page.value) { return }
  nextTick(() => {
    emitEvent('mounted', { params: props.params })
  })
})

watch(
  () => props.params,
  (newVal, oldVal) => {
    if (!page.value) { return }
    if (_prevParams.value === undefined) {
      _prevParams.value = newVal
      return
    }
    emitEvent('params-change', {
      params: newVal,
      prevParams: oldVal,
    })
  },
  { deep: true },
)

onBeforeUnmount(() => {
  if (!page.value) { return }
  emitEvent('before-leave', { params: props.params })
})

onUnmounted(() => {
  emitEvent('leave', { params: props.params })
  if (pageRuntime.value?.id) {
    Endge.runtime.destroyRuntime(pageRuntime.value.id)
    pageRuntime.value = null
  }
})
</script>

<template>
  <div class="endge-page">
    <slot :page="page" :runtime="pageRuntime" />
  </div>
</template>

<style scoped>
.endge-page {
  display: contents;
}
</style>
