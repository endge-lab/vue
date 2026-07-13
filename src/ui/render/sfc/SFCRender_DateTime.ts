import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит дату или время через базовые форматы SFC v1. */
export const SFCRender_DateTime: SFCVueRenderAdapterFunction = (input) => {
  const value = formatDateTime(input.props.value, input.props.format)

  return input.h('time', {
    ...input.attrs,
    class: ['endge-sfc-datetime', input.props.class],
    datetime: input.props.value == null ? undefined : String(input.props.value),
  }, value)
}

function formatDateTime(value: unknown, format: unknown): string {
  if (value == null) return ''

  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) return String(value)

  if (format === 'HH:mm') {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date)
  }

  if (format === 'date') {
    return new Intl.DateTimeFormat().format(date)
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
