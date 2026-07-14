import type { EndgeWorkspaceDefinition, RComponentSFC_IR_ElementNode } from '@endge/core'
import { Endge } from '@endge/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { h, isVNode } from 'vue'

import type { SFCVueRenderAdapter } from '@/domain/types/sfc-render.type'
import { EndgeVueModule } from '@/domain/core/endge-vue'
import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

const TEST_WORKSPACE: EndgeWorkspaceDefinition = {
  identity: 'workspace-test',
  displayName: 'Test Workspace',
  vars: [],
  locales: [{ code: 'en', displayName: 'English', shortLabel: 'EN' }],
  defaultLocale: 'en',
  fallbackLocale: 'en',
  defaultAuthProfileIdentity: null,
  sfcAdapterIds: ['native-vue'],
  defaultSfcAdapterId: 'native-vue',
}

describe('EndgeVueModule SFC adapter', () => {
  beforeEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
  })

  afterEach(() => {
    Endge.uiRegistry.adapters.reset()
    Endge.workspace.apply(TEST_WORKSPACE)
  })

  it('registers and activates native-vue for the selected workspace', () => {
    const module = new EndgeVueModule()

    module.setup()
    module.build()

    expect(Endge.uiRegistry.adapters.active?.id).toBe(NativeVueSFCAdapter.id)
  })

  it('fails before runtime start when selected adapter is not registered', () => {
    const module = new EndgeVueModule()
    module.setup()
    Endge.workspace.apply({
      ...TEST_WORKSPACE,
      sfcAdapterIds: ['customer-aodb'],
      defaultSfcAdapterId: 'customer-aodb',
    })

    expect(() => module.build()).toThrow(
      'adapter "customer-aodb" is not registered. Registered adapters: native-vue',
    )
  })

  it('dispatches visual primitives through the selected adapter', () => {
    const module = new EndgeVueModule()
    const customerAdapter: SFCVueRenderAdapter = {
      ...NativeVueSFCAdapter,
      id: 'customer-aodb',
      renderers: {
        ...NativeVueSFCAdapter.renderers,
        Input: input => input.h('customer-input', {
          ...input.attrs,
          value: input.props.value,
        }),
      },
    }
    module.setup()
    Endge.uiRegistry.adapters.register(customerAdapter)
    Endge.workspace.apply({
      ...TEST_WORKSPACE,
      sfcAdapterIds: ['native-vue', 'customer-aodb'],
      defaultSfcAdapterId: 'customer-aodb',
    })
    module.build()

    const node: RComponentSFC_IR_ElementNode = {
      id: 'custom-input',
      kind: 'element',
      tag: 'Input',
      props: {
        value: { kind: 'literal', value: 'SU 1402' },
      },
      directives: {},
      children: [],
    }
    const rendered = renderSFCNode(h, node, createSFCVueRenderContext({}))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.type).toBe('customer-input')
    expect(rendered.props?.value).toBe('SU 1402')
  })
})
