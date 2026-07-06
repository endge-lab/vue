<script setup lang="ts">
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { SFCVueRuntimeRendererProps } from '@/domain/types/sfc-render.type'
import { SFCVueRuntimeBridge } from '@/model/render/sfc/SFCVueRuntimeBridge'
import SFC_Renderer from '@/ui/render/sfc/SFC_Renderer.vue'

const props = defineProps<SFCVueRuntimeRendererProps>()

const renderProps = shallowRef<Record<string, unknown>>({})
const renderVersion = ref(0)

let bridge: SFCVueRuntimeBridge | null = null
let bridgeHost: SFCVueRuntimeRendererProps['host'] = null

watch(
  () => [props.host, props.input] as const,
  ([host, input]) => {
    if (bridge && host === bridgeHost) {
      bridge.updateInput(input)
      return
    }

    destroyBridge()

    if (!host) {
      renderProps.value = {}
      renderVersion.value++
      return
    }

    bridge = new SFCVueRuntimeBridge({
      host,
      input,
      onUpdate: (nextProps) => {
        renderProps.value = nextProps
        renderVersion.value++
      },
    })
    bridgeHost = host
    bridge.mount()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  destroyBridge()
})

function destroyBridge(): void {
  bridge?.destroy()
  bridge = null
  bridgeHost = null
}
</script>

<template>
  <SFC_Renderer
    :ir="host?.getIr() ?? null"
    :props="renderProps"
    :render-version="renderVersion"
  />
</template>
