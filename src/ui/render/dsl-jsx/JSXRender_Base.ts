import type { VNode } from 'vue'
import type { JSXComponentProps, JSXRenderMiddlewareInput } from '@endge/core'
import { JSXRender_Base_IfElse } from '@/ui/render/dsl-jsx/JSXRender_Base_IfElse'
import { JSXRender_Base_Styles } from '@/ui/render/dsl-jsx/JSXRender_Base_Styles'
import { JSXRender_Base_Events } from '@/ui/render/dsl-jsx/JSXRender_Base_Event'
import { JSXRender_Base_Tooltip } from '@/ui/render/dsl-jsx/JSXRender_Base_Tooltip'
import { readForFromNode } from '@/ui/render/dsl-jsx/JSXRender_Base_For'
import { resolveLegacyValue } from '@/ui/render/helpers/legacy-expression-stub'

/** Разделяем middleware по фазам */
const PRE_MIDDLEWARE = [
  JSXRender_Base_IfElse, // решает «рендерить / не рендерить»
  JSXRender_Base_Styles, // готовит props.styles
  JSXRender_Base_Events, // готовит props.handlers
]

const POST_MIDDLEWARE = [
  JSXRender_Base_Tooltip, // оборачивает/дополняет vnode после рендера
]

/**
 * Вспомогательная функция: прогоняет input через указанную цепочку middleware.
 * Возвращает null если цепочка решила «не рендерить».
 */
function runMiddlewareChain(
  chain: Array<(input: JSXRenderMiddlewareInput) => VNode | null>,
  input: JSXRenderMiddlewareInput,
): VNode | null {
  for (const mw of chain) {
    const res = mw(input)
    if (res === null) return null
    input.vnode = res
  }
  return input.vnode
}

/**
 * Выполнить один цикл рендера узла:
 *  1) PRE middleware (могут отменить рендер)
 *  2) renderFn -> vnode
 *  3) POST middleware (могут модифицировать/обернуть vnode)
 */
function renderOnce(
  h: any,
  renderFn: (h: any, props: JSXComponentProps) => VNode,
  props: JSXComponentProps,
): VNode | null {
  // стартовое значение vnode - пустой контейнер (middleware могут его игнорировать)
  let vnode: VNode | null = h('span', null, [])

  // PRE: готовят props/решают if/else. Если решили «не рендерить» - выходим.
  {
    const input: JSXRenderMiddlewareInput = {
      h,
      props,
      node: props.node,
      vnode: vnode!,
    }
    const res = runMiddlewareChain(PRE_MIDDLEWARE, input)
    if (res === null) return null
  }

  // Рендер компонента по готовым props
  vnode = renderFn(h, props)
  if (!vnode) return null

  // POST: работают с уже созданным vnode
  {
    const input: JSXRenderMiddlewareInput = {
      h,
      props,
      node: props.node,
      vnode,
    }
    const res = runMiddlewareChain(POST_MIDDLEWARE, input)
    if (res === null) return null
    vnode = res
  }

  return vnode
}

/**
 * Обёртка для JSX-компонентов, использующая PRE/POST middleware pipeline
 * и корректную обработку v-for. Каждый элемент итерации получает свой
 * scope/comData и проходит полный цикл PRE - render - POST.
 */
export function JSXRender_Base(
  renderFn: (h: any, props: JSXComponentProps) => VNode,
) {
  return (h: any, props: JSXComponentProps): VNode | null => {
    const { node, scope, comData } = props

    // --- 1) Предобработка v-for ДО middleware и ДО рендера компонента ---
    const forInfo = readForFromNode(node)

    if (!forInfo) {
      // Без v-for: один цикл рендера
      return renderOnce(h, renderFn, props)
    }

    // --- v-for: вычисляем источник ---
    const { sourceExpr, valueAlias, keyAlias, indexAlias } = forInfo
    const src: any = resolveLegacyValue(sourceExpr, comData)
    if (src == null) return null

    // --- 2) Итерации: для каждой - свой scope/comData и полный цикл PRE - render - POST ---
    const children: VNode[] = []

    const iterate = (val: any, k: any, i: number) => {
      const iterScope = Object.create(scope || null)
      ;(iterScope as any)[valueAlias] = val
      if (keyAlias) (iterScope as any)[keyAlias] = k
      if (indexAlias) (iterScope as any)[indexAlias] = i

      const iterComData = {
        ...comData,
        [valueAlias]: val,
        ...(keyAlias ? { [keyAlias]: k } : {}),
        ...(indexAlias ? { [indexAlias]: i } : {}),
      }

      const vnode = renderOnce(h, renderFn, {
        ...props,
        scope: iterScope,
        comData: iterComData,
      } as JSXComponentProps)

      if (vnode) children.push(vnode)
    }

    if (Array.isArray(src) || typeof src.length === 'number') {
      const arr = Array.from(src as any[])
      for (let i = 0; i < arr.length; i++) iterate(arr[i], i, i)
    } else if (src && typeof src[Symbol.iterator] === 'function') {
      let i = 0
      for (const val of src as Iterable<any>) iterate(val, i, i++)
    } else if (typeof src === 'object') {
      const entries = Object.entries(src as Record<string, any>)
      for (let i = 0; i < entries.length; i++) {
        const [k, val] = entries[i]
        iterate(val, k, i)
      }
    } else {
      return null
    }

    // --- 3) Контейнер: оборачиваем детей. Тип - нейтральный (span/div) либо
    //     даём хост-рендереру самому оптимизировать. Здесь берём простой span.
    return h('span', { ...props.handlers }, children)
  }
}
