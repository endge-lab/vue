<script setup lang="ts">
import { Endge } from '@endge/core'
import { computed, defineComponent, h, Fragment, onScopeDispose, ref } from 'vue'
import type { SFCVueRenderAdapterProps } from '@/domain/types/sfc-render.type'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

const props = defineProps<SFCVueRenderAdapterProps>()
const adapterVersion = ref(0)

const unsubscribeUIRegistry = Endge.uiRegistry.subscribe(() => {
  adapterVersion.value += 1
})
onScopeDispose(unsubscribeUIRegistry)

const context = computed(() => createSFCVueRenderContext(
  props.props,
  props.renderVersion ?? 0,
  props.host ?? null,
  props.ir,
))

const RenderRoot = defineComponent({
  name: 'SFC_RenderRoot',
  setup() {
    return () => {
      adapterVersion.value
      if (!props.ir) return null

      return h(Fragment, null, renderSFCNodes(
        h,
        props.ir.template.roots,
        context.value,
      ))
    }
  },
})
</script>

<template>
  <RenderRoot />
</template>
