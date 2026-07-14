import type { VNode } from 'vue'
import type { JSXComponentProps } from '@endge/core'
import { JSXRender_Base } from '@/ui/render/dsl-jsx/JSXRender_Base'
import { resolveLegacyValue } from '@/ui/render/helpers/legacy-expression-stub'
import {
  createPropApplier,
  coerceBool,
  coerceString,
  coerceSize,
  setTextDecoration,
} from '../helpers/props-mapper'

type StyleTarget = Record<string, string>

/**
 * Спецификация «только текстовых» пропсов
 */
const TextSpec = {
  // логические
  bold: {
    coerce: coerceBool,
    apply: (v: boolean, t: StyleTarget) => (t['font-weight'] = v ? 'bold' : ''),
  },
  italic: {
    coerce: coerceBool,
    apply: (v: boolean, t: StyleTarget) =>
      (t['font-style'] = v ? 'italic' : ''),
  },
  underline: {
    coerce: coerceBool,
    apply: (v: boolean, t: StyleTarget) =>
      setTextDecoration(t, {
        underline: v,
        strike: t['text-decoration']?.includes('line-through'),
      }),
  },
  strike: {
    coerce: coerceBool,
    apply: (v: boolean, t: StyleTarget) =>
      setTextDecoration(t, {
        underline: t['text-decoration']?.includes('underline'),
        strike: v,
      }),
  },

  // цвет/фон
  color: {
    coerce: coerceString,
    apply: (v: string | undefined, t: StyleTarget) => {
      if (v == null) return
      t['color'] = v
    },
  },
  bg: {
    coerce: coerceString,
    apply: (v: string | undefined, t: StyleTarget) => {
      if (v == null) return
      t['background-color'] = v
    },
  },

  // размеры/вес/выравнивание
  size: {
    coerce: coerceSize,
    apply: (v: string | undefined, t: StyleTarget) => {
      if (!v) return
      t['font-size'] = v
    },
  },
  weight: {
    coerce: coerceString,
    apply: (v: string | undefined, t: StyleTarget) => {
      if (!v) return
      t['font-weight'] = v
    },
  },
  align: {
    coerce: coerceString,
    apply: (v: string | undefined, t: StyleTarget) => {
      if (!v) return
      t['text-align'] = v
    },
  },

  // регистры
  uppercase: {
    coerce: coerceBool,
    apply: (v: boolean, t: StyleTarget) =>
      v ? (t['text-transform'] = 'uppercase') : (t['text-transform'] = ''),
  },
  lowercase: {
    coerce: coerceBool,
    apply: (v: boolean, t: StyleTarget) =>
      v ? (t['text-transform'] = 'lowercase') : (t['text-transform'] = ''),
  },
  capitalize: {
    coerce: coerceBool,
    apply: (v: boolean, t: StyleTarget) =>
      v ? (t['text-transform'] = 'capitalize') : (t['text-transform'] = ''),
  },
} as const

const applyTextProps = createPropApplier<StyleTarget>(TextSpec)

/**
 * Рендерер Text-компонента, использующий общий проп-движок.
 * Поддерживает:
 *  - статику: bold, italic, underline, strike, color, bg, size, weight, align, uppercase, lowercase, capitalize
 *  - динамику: :prop="...", и объектный v-bind="..."
 */
const fn = (h: (...args: any[]) => VNode, props: JSXComponentProps): VNode => {
  const localStyles: StyleTarget = {}

  // Применяем все текстовые пропсы (статические и динамические)
  applyTextProps(props.node.props as any, localStyles, props)

  // Контент
  const children = props.node.children.map((child) => {
    if (child.type === 2 /* TEXT */) return child.content
    if (child.type === 5 /* INTERPOLATION */) {
      const value = resolveLegacyValue(child.content.content, props.comData)
      return value != null ? String(value) : ''
    }
    return ''
  })

  return h(
    'span',
    {
      style: {
        ...props.styles,
        ...localStyles,
      },
      ...props.handlers,
    },
    children,
  )
}

export default JSXRender_Base(fn)
