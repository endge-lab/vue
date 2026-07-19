import type { RComponentSFC_IR_ElementNode, RComponentSFC_IR_Value } from '@endge/core'
import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  Endge,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h, isVNode, type VNode } from 'vue'

import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'
import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/domain/types/sfc-render.type'
import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'

describe('SFC Table layout', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  afterEach(() => Endge.uiRegistry.adapters.reset())

  it('fills the available height by default', () => {
    const table = renderTable()

    expect(table.props?.['data-endge-layout-fill-height']).toBe('')
    expect(table.props?.style).toMatchObject({
      width: '100%',
      height: '100%',
      minHeight: '180px',
      flex: '1 1 0%',
      overflow: 'hidden',
    })
  })

  it('keeps an explicit height as an opt-out from fill layout', () => {
    const table = renderTable({ height: 420, minHeight: 120 })

    expect(table.props?.['data-endge-layout-fill-height']).toBeUndefined()
    expect(table.props?.style).toMatchObject({
      height: '420px',
      minHeight: '120px',
    })
    expect(table.props?.style?.flex).toBeUndefined()
  })
})

function renderTable(props: Record<string, unknown> = {}): VNode {
  const node: RComponentSFC_IR_ElementNode = {
    id: 'test-table',
    kind: 'element',
    tag: 'Table',
    props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, literal(value)])),
    directives: {},
    children: [],
  }
  const result = renderSFCNode(h, node, createSFCVueRenderContext({}))

  if (!isVNode(result))
    throw new Error('Table did not render a VNode')
  return result
}

function literal(value: unknown): RComponentSFC_IR_Value {
  return { kind: 'literal', value }
}
