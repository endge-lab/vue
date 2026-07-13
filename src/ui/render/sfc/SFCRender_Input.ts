import type { SourceFieldType } from '@endge/core'
import { isoToDateInput, isoToDateTimeLocalInput, timeToTimeInput } from '@endge/utils'

import type { SFCVueRenderFunction } from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'

type SFCInputType = Extract<SourceFieldType, 'String' | 'Number' | 'Date' | 'Time' | 'DateTime'>

/** Рендерит однострочный display-only input без обратной связи с runtime. */
export const SFCRender_Input: SFCVueRenderFunction = SFCRender_Base((input) => {
  const inputType = normalizeInputType(input.props.type)

  return input.h('input', {
    ...input.attrs,
    class: ['endge-sfc-input', input.props.class],
    type: toNativeInputType(inputType),
    value: normalizeInputValue(inputType, input.props.value),
    placeholder: toOptionalString(input.props.placeholder),
    min: input.props.min,
    max: input.props.max,
    step: input.props.step,
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  })
})

function normalizeInputType(value: unknown): SFCInputType {
  if (value === 'Number' || value === 'Date' || value === 'Time' || value === 'DateTime')
    return value

  return 'String'
}

function toNativeInputType(type: SFCInputType): string {
  if (type === 'Number')
    return 'number'
  if (type === 'Date')
    return 'date'
  if (type === 'Time')
    return 'time'
  if (type === 'DateTime')
    return 'datetime-local'
  return 'text'
}

function normalizeInputValue(type: SFCInputType, value: unknown): string | number {
  if (value == null)
    return ''
  if (type === 'Number') {
    if (typeof value === 'string' && value.trim() === '')
      return ''
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : ''
  }
  if (type === 'Date')
    return isoToDateInput(value)
  if (type === 'Time')
    return timeToTimeInput(value)
  if (type === 'DateTime')
    return isoToDateTimeLocalInput(value)
  return String(value)
}

function toOptionalString(value: unknown): string | undefined {
  return value == null ? undefined : String(value)
}
