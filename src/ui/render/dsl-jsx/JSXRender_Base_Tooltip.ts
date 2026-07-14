import type { ElementNode } from '@vue/compiler-dom'
import { NodeTypes } from '@vue/compiler-dom'
import type { JSXRenderMiddlewareInput } from '@endge/core'
import { Prefix } from '@endge/core'
// import { useTooltipStore } from '@endge/utils'
import { randomString } from '@endge/utils'
import type { VNode } from 'vue'
import { isVNode } from 'vue'
import type { TemplateChildNode } from '@vue/compiler-dom'
import { Endge } from '@endge/core'
import { resolveLegacyValue } from '@/ui/render/helpers/legacy-expression-stub'

/**
 * Middleware: оборачивает VNode тултипом, если указаны tooltip-атрибуты или слот #tooltip
 */
export function JSXRender_Base_Tooltip(
  input: JSXRenderMiddlewareInput,
): VNode | null {
  const { node, vnode, h } = input
  const tooltipAttrs = extractTooltipAttributes(node)
  // const store = useTooltipStore()

  // Если нет ни text, ни id, ни слота - не оборачиваем
  const hasStatic = tooltipAttrs.text || tooltipAttrs.id
  const slotNode = extractTooltipSlot(node)
  if (!hasStatic && !slotNode) return vnode

  // Авто-генерация ID если не указан вручную
  const tooltipId = tooltipAttrs.id || `tooltip-${randomString(6)}`

  // Регистрация текстового тултипа
  if (tooltipAttrs.text) {
    // store.registerTooltip({
    //   id: tooltipId,
    //   content: tooltipAttrs.text,
    //   activator: `[${Prefix.TooltipAttributeId}='${tooltipId}']`,
    //   position: 'top',
    // })
  }

  // Регистрация тултипа через слот
  if (slotNode) {
    // store.registerTooltip({
    //   id: tooltipId,
    //   content: () =>
    //     h(
    //       'div',
    //       {},
    //       slotNode.children.map((child) => createRenderNode(h, child, input)),
    //     ),
    //   activator: `[${Prefix.TooltipAttributeId}='${tooltipId}']`,
    //   position: 'top',
    // })
  }

  return h(
    'div',
    {
      [Prefix.TooltipAttributeId]: tooltipId,
      // onMouseenter: () => store.setActiveTooltipId(tooltipId),
      // onMouseleave: () => store.clearActiveTooltipId(),
      style: {
        display: 'inline-block',
        cursor: 'pointer',
      },
    },
    [vnode],
  )
}

function extractTooltipAttributes(node: ElementNode): Record<string, any> {
  const result: Record<string, any> = {}

  for (const prop of node.props) {
    if (
      prop.type === 7 &&
      prop.name === 'bind' &&
      prop.arg?.type === 4 &&
      prop.exp?.type === 4 &&
      prop.arg.content.startsWith('tooltip:')
    ) {
      const key = prop.arg.content.split(':')[1]
      result[key] = prop.exp.content
    }
    if (prop.type === 6 && prop.name.startsWith('tooltip:')) {
      const key = prop.name.split(':')[1]
      result[key] = prop.value?.content || ''
    }
  }

  return result
}

/**
 * Создаёт функцию рендера DSL-узлов для тултипа или произвольного JSX-контекста.
 */
export function createRenderNode(
  h: any,
  scope: any,
  comData: any,
  allData: any,
): (node: TemplateChildNode) => VNode | string | null {
  return function renderNode(node: TemplateChildNode): VNode | string | null {
    // Элемент DSL (например, <Text>)
    if (node.type === 1 /* ELEMENT */) {
      const tag = node.tag
      const renderer = Endge.uiRegistry.resolveLegacyComponentRenderer({
        componentIdentity: String(tag),
        host: 'view',
      })
      const children = node.children.map(renderNode).filter(Boolean)

      if (renderer) {
        if (renderer.renderType === 'component') {
          return h(renderer.component, {
            node,
            children,
            scope,
            comData,
            allData,
          })
        }

        return renderer.component(h, {
          node,
          children,
          scope,
          comData,
          allData,
        })
      }

      // Обычный HTML тег
      return h(tag, {}, children)
    }

    // Интерполяция {{ someExpr }}
    if (node.type === 5 /* INTERPOLATION */) {
      const value = resolveLegacyValue(node.content.content, comData)
      if (isVNode(value)) return value
      if (typeof value === 'string' || typeof value === 'number') {
        return String(value)
      }
      return value == null ? '' : JSON.stringify(value)
    }

    // Простой текст
    if (node.type === 2 /* TEXT */) {
      return node.content
    }

    return null
  }
}

function extractTooltipSlot(node: ElementNode): ElementNode | null {
  return (
    node.children.find(
      (child): child is ElementNode =>
        child.type === NodeTypes.ELEMENT &&
        child.tag === 'template' &&
        child.props.some(
          (p) =>
            p.type === 7 &&
            p.name === 'slot' &&
            p.arg?.type === 4 &&
            p.arg.content === 'tooltip',
        ),
    ) || null
  )
}
