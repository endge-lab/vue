<script setup lang="ts">
import { Endge } from '@endge/core'
import { computed, defineComponent, h, Fragment, onScopeDispose, ref } from 'vue'
import type { SFCVueRenderAdapterProps } from '@/domain/types/sfc-render.type'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'
import { registerSFCInspectionRoot } from '@/model/render/sfc/SFCVueRenderInspection'

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
  undefined,
  undefined,
  undefined,
  undefined,
  props.inspection ?? null,
))

const RenderRoot = defineComponent({
  name: 'SFC_RenderRoot',
  setup() {
    return () => {
      adapterVersion.value
      if (!props.ir) return null

      const renderContext = context.value
      renderContext.inspectionParentId = renderContext.inspection
        ? registerSFCInspectionRoot(renderContext)
        : null
      return h(Fragment, null, renderSFCNodes(
        h,
        props.ir.template.roots,
        renderContext,
      ))
    }
  },
})
</script>

<template>
  <RenderRoot />
</template>
