import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит icon placeholder без зависимости от конкретной icon library. */
export const SFCRender_Icon: SFCVueRenderAdapterFunction = (input) => {
  const name = input.props.name ?? input.props.icon ?? ''

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-icon', input.props.class],
    'aria-label': name ? String(name) : undefined,
    role: 'img',
  }, String(name))
}
