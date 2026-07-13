import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит числовое значение SFC primitive. */
export const SFCRender_Number: SFCVueRenderAdapterFunction = (input) => {
  const value = formatNumber(input.props.value, input.props)

  return input.h('span', {
    ...input.attrs,
    class: ['endge-sfc-number', input.props.class],
  }, value)
}

function formatNumber(value: unknown, props: Record<string, unknown>): string {
  if (value == null) return ''

  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return String(value)

  const minimumFractionDigits = toOptionalNumber(props.minFractionDigits)
  const maximumFractionDigits = toOptionalNumber(props.maxFractionDigits ?? props.decimals)
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numberValue)

  return `${props.prefix ?? ''}${formatted}${props.suffix ?? ''}`
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : undefined
}
