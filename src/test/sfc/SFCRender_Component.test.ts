import type {
  ComponentSFCProgramPayload,
  ProgramArtifact,
  RComponentSFC_IR_ElementNode,
  ComputationProgramPayload,
} from '@endge/core'
import {
  compileComponentSFC,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
  compileComputation,
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

  it('evaluates a computation port local and forwards it through a component port', () => {
    Endge.program.beginCompile('test')
    Endge.program.addArtifact(createComputationArtifact('process-state'))
    Endge.program.addArtifact(createArtifact('process-cell', `<script setup lang="ts">
defineProps<{ point?: { value?: string } }>()
</script>
<template><Text>{{ point?.value }}</Text></template>`))

    const owner = compileComponentSFC(`<script setup lang="ts">
interface Input { value?: string }
interface Output { value?: string }
interface CellProps { point?: Output }
const props = defineProps<{ value?: string }>()
const ports = definePorts({
  state: computation<Input, Output>({ default: 'process-state' }),
  cell: component<CellProps>({ tag: 'Process.Cell', default: 'process-cell' }),
})
const state = ports.state({ value: props.value })
</script>
<template><Process.Cell :point="state" /></template>`)
    const ir = owner.ir!

    const firstContext = createSFCVueRenderContext({ value: 'A' }, 0, null, ir, ['owner'])
    const secondContext = createSFCVueRenderContext({ value: 'B' }, 1, null, ir, ['owner'])
    expect(firstContext.locals.state).toEqual({ value: 'A' })
    expect(secondContext.locals.state).toEqual({ value: 'B' })
    expect(firstContext.locals.state).not.toBe(secondContext.locals.state)

    const rendered = renderSFCNode(h, ir.template.roots[0]!, firstContext)
    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.children).toEqual(['A'])
  })

  it('evaluates nested component ports in an isolated child context', () => {
    Endge.program.beginCompile('test')
    Endge.program.addArtifact(createComputationArtifact('process-state'))
    Endge.program.addArtifact(createArtifact('nested-owner', `<script setup lang="ts">
interface Input { value?: string }
interface Output { value?: string }
const props = defineProps<{ value?: string }>()
const ports = definePorts({
  state: computation<Input, Output>({ default: 'process-state' }),
})
const state = ports.state({ value: props.value })
</script>
<template><Text>{{ state.value }}</Text></template>`))

    const node: RComponentSFC_IR_ElementNode = {
      id: 'nested-call',
      kind: 'element',
      tag: 'Component',
      props: {
        is: { kind: 'literal', value: 'nested-owner' },
        value: {
          kind: 'expression',
          source: 'value',
          reads: [{ source: 'props', path: ['value'], raw: 'value' }],
        },
      },
      directives: {},
      children: [],
    }

    const first = renderSFCNode(h, node, createSFCVueRenderContext({ value: 'nested-A' }))
    const second = renderSFCNode(h, node, createSFCVueRenderContext({ value: 'nested-B' }))
    expect(isVNode(first) && first.children).toEqual(['nested-A'])
    expect(isVNode(second) && second.children).toEqual(['nested-B'])
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

function createComputationArtifact(identity: string): ProgramArtifact<ComputationProgramPayload> {
  const compiled = compileComputation({
    implementationKind: 'source',
    sourceLanguage: 'typescript',
    source: 'export default function compute(input: Input): Output { return { value: get(input, \'value\') } }',
    input: { type: 'Input' },
    output: { type: 'Output' },
  })
  return {
    ref: { entityType: 'computation', id: identity, identity },
    sourceHash: identity,
    compilerVersion: 'test',
    status: compiled.diagnostics.some(diagnostic => diagnostic.severity === 'error') ? 'error' : 'valid',
    diagnostics: compiled.diagnostics,
    dependencies: [],
    capabilities: ['compilable', 'runnable'],
    metadata: { self: {}, nodes: [] },
    payload: compiled.payload,
  }
}
