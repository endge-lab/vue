import type { ComponentSFCRuntimeHost } from '@endge/core'
import type { SFCVueRenderContext, SFCVueRenderIteration } from '@/domain/types/sfc-render.type'

/** Создает root context для одного render pass SFC renderer adapter. */
export function createSFCVueRenderContext(
  props: Record<string, unknown> | undefined,
  renderVersion = 0,
  host: ComponentSFCRuntimeHost | null = null,
): SFCVueRenderContext {
  return {
    props: props ?? {},
    locals: {},
    iteration: null,
    renderVersion,
    host,
    runtimeState: (host as any)?.runtimeState ?? null,
    componentStack: host?.entityIdentity ? [host.entityIdentity] : [],
  }
}

/** Создает дочерний context с дополнительными локальными значениями. */
export function extendSFCVueRenderContext(
  context: SFCVueRenderContext,
  locals: Record<string, unknown>,
  iteration: SFCVueRenderIteration | null = context.iteration,
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
  }
}
