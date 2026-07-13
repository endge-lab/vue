import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит многострочный display-only input без обратной связи с runtime. */
export const SFCRender_Textarea: SFCVueRenderAdapterFunction = (input) => {
  return input.h('textarea', {
    ...input.attrs,
    class: ['endge-sfc-textarea', input.props.class],
    value: input.props.value == null ? '' : String(input.props.value),
    placeholder: input.props.placeholder == null ? undefined : String(input.props.placeholder),
    rows: input.props.rows,
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  })
}
