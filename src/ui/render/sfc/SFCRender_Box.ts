import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит базовый блочный контейнер SFC. */
export const SFCRender_Box: SFCVueRenderAdapterFunction = (input) => {
  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-box', input.props.class],
  }, input.children)
}
