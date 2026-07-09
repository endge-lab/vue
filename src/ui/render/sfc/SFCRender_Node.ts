import type {
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
} from '@endge/core'
import type {
  SFCVueRenderContext,
  SFCVueRenderFunction,
  SFCVueRenderH,
  SFCVueRenderListResult,
  SFCVueRenderResult,
} from '@/domain/types/sfc-render.type'
import { resolveSFCConditionState } from '@/ui/render/sfc/SFCRender_Base'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import { SFCRender_Badge } from '@/ui/render/sfc/SFCRender_Badge'
import { SFCRender_Box } from '@/ui/render/sfc/SFCRender_Box'
import { SFCRender_Component } from '@/ui/render/sfc/SFCRender_Component'
import { SFCRender_DateTime } from '@/ui/render/sfc/SFCRender_DateTime'
import { SFCRender_Divider } from '@/ui/render/sfc/SFCRender_Divider'
import { SFCRender_Dot } from '@/ui/render/sfc/SFCRender_Dot'
import { SFCRender_Flex } from '@/ui/render/sfc/SFCRender_Flex'
import { SFCRender_Icon } from '@/ui/render/sfc/SFCRender_Icon'
import { SFCRender_Number } from '@/ui/render/sfc/SFCRender_Number'
import { SFCRender_Table } from '@/ui/render/sfc/SFCRender_Table'
import { SFCRender_Text } from '@/ui/render/sfc/SFCRender_Text'

const SFCRender_Structural: SFCVueRenderFunction = () => null

/** Рендерит список SFC IR узлов с учетом sibling if / else-if / else chain. */
export function renderSFCNodes(
  h: SFCVueRenderH,
  nodes: RComponentSFC_IR_Node[] | undefined,
  context: SFCVueRenderContext,
): SFCVueRenderListResult {
  const result: SFCVueRenderListResult = []
  let chainActive = false
  let previousMatched = false

  for (const node of nodes ?? []) {
    if (!isElementNode(node)) {
      chainActive = false
      previousMatched = false
      appendRenderedNode(result, renderSFCNode(h, node, context))
      continue
    }

    if (node.directives.elseIf && !chainActive) continue
    if (node.directives.else && !chainActive) continue

    const condition = resolveSFCConditionState(node, context, previousMatched)

    if (condition.shouldRender) {
      appendRenderedNode(result, renderSFCElement(h, node, context))
    }

    chainActive = condition.startsChain && !condition.closesChain
    previousMatched = condition.startsChain ? condition.matchedChain : false
  }

  return result
}

/** Рендерит один SFC IR узел. */
export function renderSFCNode(
  h: SFCVueRenderH,
  node: RComponentSFC_IR_Node,
  context: SFCVueRenderContext,
): SFCVueRenderResult {
  if (node.kind === 'text') return node.value
  if (node.kind === 'expression') {
    const value = evaluateSFCValue(node.value, context)
    return value == null ? '' : String(value)
  }

  return renderSFCElement(h, node, context)
}

function renderSFCElement(
  h: SFCVueRenderH,
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
): SFCVueRenderResult {
  const renderFn = getSFCElementRenderer(node)

  return renderFn({
    h,
    node,
    context,
    children: [],
    renderChildren: (childContext) => renderSFCNodes(h, node.children, childContext),
    props: {},
    attrs: {},
  })
}

function getSFCElementRenderer(
  node: RComponentSFC_IR_ElementNode,
) {
  switch (node.tag) {
    case 'Text':
      return SFCRender_Text
    case 'DateTime':
      return SFCRender_DateTime
    case 'Number':
      return SFCRender_Number
    case 'Icon':
      return SFCRender_Icon
    case 'Badge':
      return SFCRender_Badge
    case 'Dot':
      return SFCRender_Dot
    case 'Box':
      return SFCRender_Box
    case 'Flex':
      return SFCRender_Flex
    case 'Divider':
      return SFCRender_Divider
    case 'Component':
      return SFCRender_Component
    case 'Table':
      return SFCRender_Table
    case 'Column':
    case 'Cell':
    case 'ColumnMenu':
    case 'MenuItem':
    case 'MenuSeparator':
      return SFCRender_Structural
  }
}

function appendRenderedNode(
  result: SFCVueRenderListResult,
  rendered: SFCVueRenderResult,
): void {
  if (rendered === null) return
  result.push(rendered)
}

function isElementNode(
  node: RComponentSFC_IR_Node,
): node is RComponentSFC_IR_ElementNode {
  return node.kind === 'element'
}
