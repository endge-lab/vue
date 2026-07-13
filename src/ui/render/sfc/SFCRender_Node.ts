import type {
  EndgeSFCRenderAdapterKey,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
} from '@endge/core'
import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
} from '@endge/core'
import type {
  SFCVueRenderAdapterFunction,
  SFCVueRenderContext,
  SFCVueRenderFunction,
  SFCVueRenderH,
  SFCVueRenderListResult,
  SFCVueRenderResult,
} from '@/domain/types/sfc-render.type'
import { resolveSFCConditionState, SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import { SFCRender_Component } from '@/ui/render/sfc/SFCRender_Component'
import { SFCRender_Table } from '@/ui/render/sfc/SFCRender_Table'

const SFCRender_Structural: SFCVueRenderFunction = () => null
const SFCRender_Adapter: SFCVueRenderFunction = SFCRender_Base((input) => {
  const adapter = Endge.uiRegistry.adapters.requireActive<SFCVueRenderAdapterFunction>({
    protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
    protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
    renderer: 'vue',
    requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  })
  const renderFn = adapter.renderers[input.node.tag]
  if (!renderFn) {
    throw new Error(
      `[SFCRender_Node] adapter "${adapter.id}" has no renderer for "${input.node.tag}"`,
    )
  }

  return renderFn({
    h: input.h,
    children: input.children,
    props: input.props,
    attrs: input.attrs,
  })
})

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
  if (isAdapterRenderKey(node.tag)) return SFCRender_Adapter

  switch (node.tag) {
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

function isAdapterRenderKey(tag: RComponentSFC_IR_ElementNode['tag']): tag is EndgeSFCRenderAdapterKey {
  return (ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS as readonly string[]).includes(tag)
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
