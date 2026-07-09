<script setup lang="ts">
import { computed, defineComponent, h, Fragment } from 'vue'
import type { SFCVueRenderAdapterProps } from '@/domain/types/sfc-render.type'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

const props = defineProps<SFCVueRenderAdapterProps>()

const context = computed(() => createSFCVueRenderContext(
  props.props,
  props.renderVersion ?? 0,
  props.host ?? null,
))

const RenderRoot = defineComponent({
  name: 'SFC_RenderRoot',
  setup() {
    return () => {
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
