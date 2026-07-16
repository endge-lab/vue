import {
  compileComponentSFC,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
} from '@endge/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { h, isVNode } from 'vue'

import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

describe('SFC EndgeCSS runtime markers', () => {
  beforeAll(() => {
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  it('normalizes id, class, state, part and attaches a matched generated class', () => {
    const compiled = compileComponentSFC(`<template>
      <Text id="status" class="flight-card" state="delayed selected" part="status">Delayed</Text>
    </template>
    <style scoped lang="endgecss">
      #status.flight-card:state(delayed)::part(status) { color: red; }
    </style>`, { identity: 'flight-board' })
    const ir = compiled.ir!
    const rendered = renderSFCNode(h, ir.template.roots[0], createSFCVueRenderContext({}, 0, null, ir))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.props?.['data-endge-id']).toBe('status')
    expect(rendered.props?.['data-endge-state']).toBe('delayed selected')
    expect(rendered.props?.part).toBe('status')
    expect(rendered.props?.['data-endge-scope-root']).toBe(ir.style?.scopeId)
    expect(String(rendered.props?.class)).toContain('endge-es-')
  })
})
