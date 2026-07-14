import type { ComponentSFCProgramPayload } from '@endge/core'
import { Endge } from '@endge/core'
import { Fragment } from 'vue'

import type { SFCVueRenderContext, SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

/** Рендерит вложенный SFC artifact через тот же renderer-neutral IR pipeline. */
export const SFCRender_Component: SFCVueRenderFunction = SFCRender_Base((input) => {
  const identity = String(input.props.is ?? input.props.identity ?? '').trim()
  if (!identity)
    return renderComponentError(input, 'component identity is empty')

  if (input.context.componentStack.includes(identity))
    return renderComponentError(input, `component cycle: ${[...input.context.componentStack, identity].join(' -> ')}`)

  const artifact = Endge.program.getArtifact<ComponentSFCProgramPayload>('component-sfc', identity)
  if (!artifact?.payload.ir || artifact.status === 'error')
    return renderComponentError(input, `component:${identity}`)

  const childContext: SFCVueRenderContext = {
    props: createChildProps(input.props),
    locals: {},
    iteration: null,
    renderVersion: input.context.renderVersion,
    host: input.context.host,
    runtimeState: input.context.runtimeState,
    componentStack: [...input.context.componentStack, identity],
  }

  return input.h(
    Fragment as any,
    null,
    renderSFCNodes(input.h, artifact.payload.ir.template.roots, childContext),
  )
})

function createChildProps(props: Record<string, unknown>): Record<string, unknown> {
  const childProps = { ...props }
  delete childProps.is
  delete childProps.identity
  return childProps
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
