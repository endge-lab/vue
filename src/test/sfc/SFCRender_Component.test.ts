import type {
  ComponentSFCProgramPayload,
  ProgramArtifact,
  RComponentSFC_IR_ElementNode,
} from '@endge/core'
import {
  compileComponentSFC,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
} from '@endge/core'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { h, isVNode } from 'vue'

import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'

describe('SFCRender_Component', () => {
  beforeAll(() => {
    if (!Endge.uiRegistry.adapters.has(NativeVueSFCAdapter.id))
      Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  afterEach(() => {
    Endge.program.clear()
  })

  it('renders a compiled child artifact and passes evaluated props', () => {
    Endge.program.beginCompile('test')
    Endge.program.addArtifact(createArtifact('aircraft-tail', `<script setup lang="ts">
defineProps<{ label: string }>()
</script>
<template><Text>{{ label }}</Text></template>`))

    const node: RComponentSFC_IR_ElementNode = {
      id: 'tail-call',
      kind: 'element',
      tag: 'Component',
      props: {
        is: { kind: 'literal', value: 'aircraft-tail' },
        label: {
          kind: 'expression',
          source: 'tail',
          reads: [{ source: 'props', path: ['tail'], raw: 'tail' }],
        },
      },
      directives: {},
      children: [],
    }

    const rendered = renderSFCNode(h, node, createSFCVueRenderContext({ tail: 'RA-89001' }))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.type).toBe('span')
    expect(rendered.children).toEqual(['RA-89001'])
  })

  it('stops recursive component calls with a deterministic placeholder', () => {
    Endge.program.beginCompile('test')
    Endge.program.addArtifact(createArtifact('recursive', '<template><Component is="recursive" /></template>'))
    const node: RComponentSFC_IR_ElementNode = {
      id: 'recursive-call',
      kind: 'element',
      tag: 'Component',
      props: { is: { kind: 'literal', value: 'recursive' } },
      directives: {},
      children: [],
    }

    const rendered = renderSFCNode(h, node, createSFCVueRenderContext({}))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.props?.class).toContain('endge-sfc-component-placeholder')
    expect(String(rendered.children)).toContain('component cycle')
  })
})

function createArtifact(identity: string, source: string): ProgramArtifact<ComponentSFCProgramPayload> {
  const result = compileComponentSFC(source)
  const { diagnostics, metadata, ...payload } = result
  return {
    ref: { entityType: 'component-sfc', id: identity, identity },
    sourceHash: identity,
    compilerVersion: 'test',
    status: diagnostics.some(diagnostic => diagnostic.severity === 'error') ? 'error' : 'valid',
    diagnostics,
    dependencies: [],
    capabilities: ['compilable', 'runnable', 'renderable'],
    metadata,
    payload,
  }
}
