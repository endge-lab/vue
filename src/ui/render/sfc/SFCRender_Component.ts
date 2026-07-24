import type { ComponentSFCProgramPayload } from '@endge/core'
import { Endge } from '@endge/core'

import type { SFCVueRenderContext, SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'

/** Рендерит вложенный SFC artifact через тот же renderer-neutral IR pipeline. */
export const SFCRender_Component: SFCVueRenderFunction = SFCRender_Base((input) => {
  const identity = String(input.props.is ?? input.props.identity ?? '').trim()
  if (!identity)
    return renderComponentError(input, 'component identity is empty')

  if (input.context.componentStack.includes(identity))
    return renderComponentError(input, `component cycle: ${[...input.context.componentStack, identity].join(' -> ')}`)

  const artifacts = input.context.host?.getArtifactReader() ?? Endge.program
  const artifact = artifacts.getArtifact<ComponentSFCProgramPayload>('component-sfc', identity)
  if (!artifact?.payload.ir || !artifact.capabilities.includes('renderable'))
    return renderComponentError(input, `component:${identity}`)

  const childBoundary = input.context.eventBoundary?.createChild(identity, artifact.payload.ir.script.ports, {
    nodeId: input.node.id,
    ref: literalString(input.node.props.ref),
    componentIdentity: identity,
    componentTag: input.node.componentTag ?? 'Component',
  }, input.node.events ?? []) ?? null
  const childContext: SFCVueRenderContext = createSFCVueRenderContext(
    createChildProps(input.props),
    input.context.renderVersion,
    input.context.host,
    artifact.payload.ir,
    [...input.context.componentStack, identity],
    `${input.context.consumerScope}/component:${input.node.id}:${identity}`,
    input.context.styleArtifacts,
    childBoundary,
    input.context.inspection,
  )
  childContext.styleParent = input.context.styleParent
  childContext.inspectionParentId = input.context.inspectionParentId

  const children = renderSFCNodes(
    input.h,
    artifact.payload.ir.template.roots,
    childContext,
  )

  if (children.length === 0) return null
  if (children.length === 1) return children[0]!

  // RevoGrid cell templates provide a DOM hyperscript function that accepts
  // string tags, but not Vue's Symbol-based Fragment. `display: contents`
  // keeps a multi-root authored component layout-neutral in both renderers.
  return input.h('span', {
    style: { display: 'contents' },
  }, children)
})

function createChildProps(props: Record<string, unknown>): Record<string, unknown> {
  const childProps = { ...props }
  delete childProps.is
  delete childProps.identity
  return childProps
}

function literalString(value: { kind: string, value?: unknown } | undefined): string | undefined {
  return value?.kind === 'literal' && typeof value.value === 'string' && value.value.trim() ? value.value.trim() : undefined
}

function renderComponentError(
  input: Parameters<SFCVueRenderFunction>[0],
  message: string,
) {
  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-component-placeholder', input.props.class],
    'data-component': String(input.props.is ?? input.props.identity ?? ''),
  }, message)
}
