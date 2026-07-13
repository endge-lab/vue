import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит display-only checkbox с необязательной подписью. */
export const SFCRender_Checkbox: SFCVueRenderAdapterFunction = (input) => {
  const checkbox = input.h('input', {
    class: 'endge-sfc-checkbox',
    type: 'checkbox',
    checked: input.props.checked === true,
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  })
  const label = input.props.label

  return input.h('label', {
    ...input.attrs,
    class: ['endge-sfc-checkbox-field', input.props.class],
  }, [
    checkbox,
    ...(label == null
      ? []
      : [input.h('span', { class: 'endge-sfc-checkbox-label' }, String(label))]),
  ])
}
