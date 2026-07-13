import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит текстовый SFC primitive. */
export const SFCRender_Text: SFCVueRenderAdapterFunction = (input) => {
  const content = input.props.value == null
    ? input.children
    : String(input.props.value)

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-text', input.props.class],
  }, content)
}
