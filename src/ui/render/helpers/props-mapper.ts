// src/ui/render/dsl-jsx/shared/prop-mapper.ts
import type { JSXComponentProps } from '@endge/core'
import { resolveLegacyValue } from '@/ui/render/helpers/legacy-expression-stub'

/**
 * Тип для одной Vue-директивы/атрибута (фрагмент AST)
 * Мы используем ровно те поля, что нам нужны.
 */
export interface NodeAttrStatic {
  type: 6
  name: string
  value?: { content: string }
}
export interface NodeAttrBind {
  type: 7
  name: 'bind'
  arg?: { type: 4; content: string }
  exp?: { type: 4; content: string }
}
export type NodeAttr = NodeAttrStatic | NodeAttrBind

/**
 * Контекст выполнения evaluate - можно подменять в тестах.
 */
export type EvalFn = (expr: string, props: JSXComponentProps) => any

export const defaultEval: EvalFn = (expr, props) =>
  resolveLegacyValue(expr, props.comData)

/**
 * Описание одного пропса в спецификации компонента.
 * - coerce:    приведение значения (из строки/любого - к нужному типу)
 * - apply:     как применить значение к целевому объекту (styles/attrs/props)
 * - dynamic:   разрешить принимать динамические значения (:prop / v-bind)
 * - static:    разрешить статический HTML-атрибут без двоеточия
 */
export interface PropSpec<TTarget> {
  coerce?: (v: unknown) => unknown
  apply: (value: unknown, target: TTarget) => void
  dynamic?: boolean
  static?: boolean
}

export type PropSpecMap<TTarget> = Record<string, PropSpec<TTarget>>

/**
 * Универсальный билдер, который возвращает функцию-применитель:
 * (nodeProps, target, ctx) => target
 */
export function createPropApplier<TTarget>(
  spec: PropSpecMap<TTarget>,
  evalFn: EvalFn = defaultEval,
) {
  const allowedStatic = new Set(
    Object.entries(spec)
      .filter(([, s]) => s.static !== false) // по умолчанию статические разрешены
      .map(([k]) => k),
  )
  const allowedDynamic = new Set(
    Object.entries(spec)
      .filter(([, s]) => s.dynamic !== false) // по умолчанию динамические разрешены
      .map(([k]) => k),
  )

  return function applyNodeProps(
    nodeProps: NodeAttr[],
    target: TTarget,
    ctx: JSXComponentProps,
  ): TTarget {
    // 1) статические
    for (const attr of nodeProps) {
      if (attr.type !== 6) continue
      const name = attr.name
      if (!allowedStatic.has(name)) continue
      const def = spec[name]
      const raw = attr.value?.content ?? true
      const val = def.coerce ? def.coerce(raw) : raw
      def.apply(val, target)
    }

    // 2) динамика :prop="expr" и объектное v-bind="expr"
    for (const attr of nodeProps) {
      if (attr.type !== 7 || attr.name !== 'bind') continue

      // кейс :prop="expr"
      if (attr.arg?.type === 4 && attr.exp?.type === 4) {
        const key = attr.arg.content.trim()
        if (!allowedDynamic.has(key)) continue
        const def = spec[key]
        const evaluated = evalFn(attr.exp.content.trim(), ctx)
        const val = def.coerce ? def.coerce(evaluated) : evaluated
        def.apply(val, target)
        continue
      }

      // кейс объектного v-bind: v-bind="expr" / :="expr"
      if (!attr.arg && attr.exp?.type === 4) {
        const obj = evalFn(attr.exp.content.trim(), ctx)
        if (!obj || typeof obj !== 'object') continue
        for (const [key, value] of Object.entries(obj)) {
          if (!allowedDynamic.has(key)) continue
          const def = spec[key]
          const val = def.coerce ? def.coerce(value) : value
          def.apply(val, target)
        }
      }
    }

    return target
  }
}

/**  Общие коэрсеры и мини-хелперы для переиспользования  */

export const coerceBool = (v: unknown) => !!v
export const coerceString = (v: unknown) => (v == null ? undefined : String(v))
export const coerceSize = (v: unknown) => {
  if (v == null) return undefined
  const s = String(v)
  return /^\d+$/.test(s) ? `${s}px` : s
}

/** Утилита для компоновки text-decoration из флагов */
export function setTextDecoration(
  target: Record<string, string>,
  opts: { underline?: boolean; strike?: boolean },
) {
  const parts: string[] = []
  if (opts.underline) parts.push('underline')
  if (opts.strike) parts.push('line-through')
  target['text-decoration'] = parts.join(' ') || ''
}
