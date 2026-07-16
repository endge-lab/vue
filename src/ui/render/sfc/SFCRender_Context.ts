import type { ComponentSFCRuntimeHost, RComponentSFC_IR } from '@endge/core'
import { Endge } from '@endge/core'
import type { SFCVueRenderContext, SFCVueRenderIteration } from '@/domain/types/sfc-render.type'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'

/** Создает root context для одного render pass SFC renderer adapter. */
export function createSFCVueRenderContext(
  props: Record<string, unknown> | undefined,
  renderVersion = 0,
  host: ComponentSFCRuntimeHost | null = null,
  ir: RComponentSFC_IR | null = null,
  componentStack: readonly string[] = host?.entityIdentity ? [host.entityIdentity] : [],
  consumerScope = 'root',
): SFCVueRenderContext {
  const context: SFCVueRenderContext = {
    props: props ?? {},
    locals: {},
    iteration: null,
    renderVersion,
    host,
    runtimeState: (host as any)?.runtimeState ?? null,
    componentStack,
    consumerScope,
  }
  context.locals = evaluatePortLocals(ir, context)
  return context
}

/** Создает дочерний context с дополнительными локальными значениями. */
export function extendSFCVueRenderContext(
  context: SFCVueRenderContext,
  locals: Record<string, unknown>,
  iteration: SFCVueRenderIteration | null = context.iteration,
  consumerScope = context.consumerScope,
): SFCVueRenderContext {
  return {
    props: context.props,
    locals: {
      ...context.locals,
      ...locals,
    },
    iteration,
    renderVersion: context.renderVersion,
    host: context.host,
    runtimeState: context.runtimeState,
    componentStack: context.componentStack,
    consumerScope,
  }
}

function evaluatePortLocals(
  ir: RComponentSFC_IR | null,
  context: SFCVueRenderContext,
): Record<string, unknown> {
  const locals: Record<string, unknown> = {}
  if (!ir) return locals

  for (const call of ir.script.portCalls ?? []) {
    context.locals = locals
    const input = evaluateSFCValue(call.input, context)
    const consumerKey = `${context.consumerScope}:${context.componentStack.join('>')}:${call.port}:${call.local}`
    locals[call.local] = context.host
      ? context.host.getComputationResource(call.defaultIdentity, input, consumerKey, call.port)
      : Endge.runtime.computation.createResource(call.defaultIdentity, input, consumerKey)
  }
  return locals
}
