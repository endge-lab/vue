import type { SourceFieldOption } from '@endge/core'

import type { SFCVueRenderAdapterFunction, SFCVueRenderH } from '@/domain/types/sfc-render.type'

/** Рендерит одиночный или множественный display-only select. */
export const SFCRender_Select: SFCVueRenderAdapterFunction = (input) => {
  const multiple = input.props.multiple === true
  const options = normalizeOptions(input.props.options)
  const selectedValues = normalizeSelectedValues(input.props.value, multiple)
  const optionNodes = options.map((option, index) => renderOption(input.h, option, index, selectedValues))

  if (!multiple) {
    const hasSelectedOption = options.some(option => selectedValues.has(String(option.value)))
    if (!hasSelectedOption) {
      optionNodes.unshift(input.h('option', {
        key: 'placeholder',
        value: '',
        disabled: input.props.placeholder != null,
        selected: true,
      }, input.props.placeholder == null ? '' : String(input.props.placeholder)))
    }
  }

  return input.h('select', {
    ...input.attrs,
    class: ['endge-sfc-select', input.props.class],
    multiple,
    readonly: input.props.readonly === true,
    disabled: input.props.disabled === true,
  }, optionNodes)
}

function normalizeOptions(value: unknown): SourceFieldOption[] {
  if (!Array.isArray(value))
    return []

  return value.filter((item): item is SourceFieldOption => {
    if (!item || typeof item !== 'object' || !Object.prototype.hasOwnProperty.call(item, 'value'))
      return false
    const optionValue = (item as SourceFieldOption).value
    return typeof optionValue === 'string' || typeof optionValue === 'number' || typeof optionValue === 'boolean'
  })
}

function normalizeSelectedValues(value: unknown, multiple: boolean): Set<string> {
  const values = multiple
    ? (Array.isArray(value) ? value : [])
    : [value]

  return new Set(values
    .filter(item => item != null)
    .map(item => String(item)))
}

function renderOption(
  h: SFCVueRenderH,
  option: SourceFieldOption,
  index: number,
  selectedValues: Set<string>,
): ReturnType<SFCVueRenderH> {
  const value = String(option.value)

  return h('option', {
    key: `${index}:${value}`,
    value,
    selected: selectedValues.has(value),
  }, option.label ?? value)
}
