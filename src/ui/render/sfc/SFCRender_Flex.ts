import type { SFCVueRenderAdapterFunction } from '@/domain/types/sfc-render.type'

/** Рендерит flex-контейнер SFC primitive. */
export const SFCRender_Flex: SFCVueRenderAdapterFunction = (input) => {
  const isColumn = input.props.col === true || input.props.direction === 'column'
  const gap = normalizeGap(input.props.gap)

  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-flex', input.props.class],
    style: {
      ...(input.attrs.style as Record<string, string> | undefined),
      display: 'flex',
      flexDirection: isColumn ? 'column' : 'row',
      gap,
      alignItems: input.props.align == null ? undefined : String(input.props.align),
      justifyContent: input.props.justify == null ? undefined : String(input.props.justify),
      flexWrap: input.props.wrap === true ? 'wrap' : undefined,
    },
  }, input.children)
}

function normalizeGap(value: unknown): string | undefined {
  if (value == null || value === false) return undefined
  if (typeof value === 'number') return `${value * 4}px`

  const source = String(value).trim()
  if (source === '') return undefined
  if (/^-?\d+(\.\d+)?$/.test(source)) return `${Number(source) * 4}px`

  return source
}
