import type { RComponentSFC_IR_ElementNode } from '@endge/core'
import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  Endge,
} from '@endge/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, isVNode } from 'vue'

import { SFC_VUE_RENDER_ADAPTER_REQUIRED_KEYS } from '@/domain/types/sfc-render.type'
import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

describe('SFC intrinsic Events', () => {
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

  it('routes a Text click with renderer-neutral payload and DOM modifiers', () => {
    const boundary = {
      observesChild: vi.fn(() => false),
      routeChild: vi.fn(async () => undefined),
    }
    const context = createSFCVueRenderContext({})
    context.eventBoundary = boundary as any
    const node: RComponentSFC_IR_ElementNode = {
      id: 'title',
      kind: 'element',
      tag: 'Text',
      props: { ref: { kind: 'literal', value: 'title' } },
      directives: {},
      events: [{
        name: 'click',
        modifiers: ['stop', 'prevent'],
        action: { kind: 'action', identity: 'flight.open-details', input: { kind: 'event', path: null } },
      }],
      children: [],
    }
    const rendered = renderSFCNode(h, node, context)
    if (!isVNode(rendered)) throw new Error('Text did not render a VNode')
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()
    const currentTarget = { id: 'title' }

    rendered.props?.onClick({
      type: 'click',
      target: currentTarget,
      currentTarget,
      cancelable: true,
      preventDefault,
      stopPropagation,
      clientX: 12,
      clientY: 24,
      button: 0,
      buttons: 1,
      altKey: true,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
    expect(boundary.routeChild).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: 'title', ref: 'title', componentTag: 'Text' }),
      'click',
      expect.objectContaining({
        type: 'click',
        x: 12,
        y: 24,
        button: 0,
        modifiers: { alt: true, ctrl: false, meta: false, shift: false },
      }),
      node.events,
    )
  })
})
