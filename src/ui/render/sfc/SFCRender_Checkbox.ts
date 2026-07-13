import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

/** Рендерит display-only checkbox с необязательной подписью. */
export const SFCRender_Checkbox: SFCVueRenderFunction = SFCRender_Base((input) => {
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
})
