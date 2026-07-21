import type {
  ComponentSFCEventRuntimeSource,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_ForDirective,
  RComponentSFC_IR_Value,
} from '@endge/core'
import { getComponentSFCIntrinsicEventDefinitions } from '@endge/core'
import type { EndgeStyleMatchNode } from '@endge/core'
import type {
  SFCVueRenderConditionState,
  SFCVueRenderContext,
  SFCVueRenderElementInput,
  SFCVueRenderFunction,
  SFCVueRenderResult,
} from '@/domain/types/sfc-render.type'
import { extendSFCVueRenderContext, extendSFCVueStyleContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCProps, evaluateSFCValue, isTruthySFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import { getEndgeDOMStyleClasses } from '@/model/style/endge-dom-style'
import { createSFCInspectionAttrs, registerSFCInspectionElement } from '@/model/render/sfc/SFCVueRenderInspection'

/** Выполняет общий SFC render pipeline вокруг primitive renderer-а. */
export function SFCRender_Base(renderFn: SFCVueRenderFunction): SFCVueRenderFunction {
  return (input) => {
    const repeated = renderForDirective(input, renderFn)
    if (repeated !== undefined) return repeated

    return renderOnce(input, renderFn)
  }
}

/** Вычисляет состояние if / else-if / else для sibling chain. */
export function resolveSFCConditionState(
  node: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  previousMatched: boolean,
): SFCVueRenderConditionState {
  if (node.directives.if) {
    const shouldRender = isTruthySFCValue(evaluateSFCValue(node.directives.if, context))

    return {
      shouldRender,
      startsChain: true,
      matchedChain: shouldRender,
      closesChain: false,
    }
  }

  if (node.directives.elseIf) {
    if (previousMatched) {
      return {
        shouldRender: false,
        startsChain: true,
        matchedChain: true,
        closesChain: false,
      }
    }

    const shouldRender = isTruthySFCValue(evaluateSFCValue(node.directives.elseIf, context))

    return {
      shouldRender,
      startsChain: true,
      matchedChain: shouldRender,
      closesChain: false,
    }
  }

  if (node.directives.else) {
    return {
      shouldRender: !previousMatched,
      startsChain: true,
      matchedChain: true,
      closesChain: true,
    }
  }

  return {
    shouldRender: true,
    startsChain: false,
    matchedChain: false,
    closesChain: true,
  }
}

/** Готовит renderer-neutral attrs для primitive-тега. */
export function createSFCBaseAttrs(
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  styleNode?: EndgeStyleMatchNode,
  runtimeScopeIds: readonly string[] = [],
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    key: resolveKey(node, props),
  }

  const style = createSFCStyle(props)
  if (Object.keys(style).length > 0) attrs.style = style

  if (props.tooltip != null) attrs.title = String(props.tooltip)

  if (styleNode) {
    attrs['data-endge-node'] = node.id
    attrs['data-endge-tag'] = node.tag
    if (styleNode.id) attrs['data-endge-id'] = styleNode.id
    if (styleNode.states.size) attrs['data-endge-state'] = [...styleNode.states].join(' ')
    if (styleNode.parts.size) {
      attrs.part = [...styleNode.parts].join(' ')
      attrs['data-endge-part'] = [...styleNode.parts].join(' ')
    }
    if (styleNode.component) attrs['data-endge-component'] = styleNode.component
    if (styleNode.identity) attrs['data-endge-identity'] = styleNode.identity
    if (styleNode.ownerScopeId) {
      attrs['data-endge-scope'] = styleNode.ownerScopeId
      if (!styleNode.parent || styleNode.parent.ownerScopeId !== styleNode.ownerScopeId)
        attrs['data-endge-scope-root'] = styleNode.ownerScopeId
    }
  }
  if (runtimeScopeIds.length)
    attrs['data-endge-runtime-scope'] = runtimeScopeIds.join(' ')

  return attrs
}

function renderOnce(
  input: SFCVueRenderElementInput,
  renderFn: SFCVueRenderFunction,
): SFCVueRenderResult {
  const props = evaluateSFCProps(input.node.props, input.context)
  const styleNode = createStyleNode(input.node, props, input.context)
  input.context.styleSiblings.push(styleNode)
  const generatedClasses = getEndgeDOMStyleClasses(input.context.styleArtifacts, styleNode)
  if (generatedClasses.length > 0) props.class = [props.class, ...generatedClasses]
  const inspectionId = input.context.inspection
    ? registerSFCInspectionElement(input.node, props, input.context)
    : null
  const attrs = {
    ...createSFCBaseAttrs(input.node, props, styleNode, input.context.runtimeScopeIds),
    ...createSFCEventAttrs(input.node, props, input.context),
    ...(inspectionId ? createSFCInspectionAttrs(input.context, inspectionId) : {}),
    ...input.attrs,
  }
  const childContext = extendSFCVueStyleContext(input.context, styleNode)
  childContext.inspectionParentId = inspectionId ?? input.context.inspectionParentId
  const children = input.renderChildren(childContext)

  return renderFn({
    ...input,
    context: childContext,
    children,
    props,
    attrs,
  })
}

function createSFCEventAttrs(
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): Record<string, unknown> {
  const boundary = context.eventBoundary
  if (!boundary) return {}
  const source: ComponentSFCEventRuntimeSource = {
    nodeId: node.id,
    ref: typeof props.ref === 'string' && props.ref.trim() ? props.ref.trim() : undefined,
    componentTag: node.componentTag ?? node.tag,
    target: {
      type: 'component.node',
      identity: String(props.id ?? props.ref ?? node.id),
      value: null,
    },
  }
  const attrs: Record<string, unknown> = {}
  for (const definition of getComponentSFCIntrinsicEventDefinitions(node.tag)) {
    const bindings = (node.events ?? []).filter(binding => binding.name === definition.name)
    const observed = boundary.observesChild(source, definition.name)
    if (bindings.length === 0 && !observed) continue
    const modifiers = new Set(bindings.flatMap(binding => binding.modifiers))
    const propName = vueEventPropName(definition.name, {
      capture: modifiers.has('capture'),
      passive: modifiers.has('passive'),
      once: bindings.length > 0 && bindings.every(binding => binding.modifiers.includes('once')) && !observed,
    })
    attrs[propName] = (event: Event) => {
      const activeBindings = bindings.filter(binding => !binding.modifiers.includes('self') || event.target === event.currentTarget)
      if (activeBindings.length === 0 && !observed) return
      const activeModifiers = new Set(activeBindings.flatMap(binding => binding.modifiers))
      if (activeModifiers.has('prevent') && event.cancelable) event.preventDefault()
      if (activeModifiers.has('stop')) event.stopPropagation()
      const runtimeSource: ComponentSFCEventRuntimeSource = {
        ...source,
        target: source.target ? { ...source.target, value: event.currentTarget } : undefined,
      }
      void boundary.routeChild(runtimeSource, definition.name, normalizeIntrinsicEvent(event), activeBindings)
    }
  }
  return attrs
}

function vueEventPropName(
  name: string,
  options: { capture: boolean, passive: boolean, once: boolean },
): string {
  return `on${name.charAt(0).toUpperCase()}${name.slice(1)}${options.once ? 'Once' : ''}${options.capture ? 'Capture' : ''}${options.passive ? 'Passive' : ''}`
}

function normalizeIntrinsicEvent(event: Event): Record<string, unknown> {
  const source = event as Event & Record<string, unknown>
  const target = event.target as { value?: unknown, checked?: unknown } | null
  const modifiers = {
    alt: source.altKey === true,
    ctrl: source.ctrlKey === true,
    meta: source.metaKey === true,
    shift: source.shiftKey === true,
  }
  const payload: Record<string, unknown> = { type: event.type, modifiers }
  if ('clientX' in source) {
    payload.x = Number(source.clientX ?? 0)
    payload.y = Number(source.clientY ?? 0)
    payload.button = Number(source.button ?? 0)
    payload.buttons = Number(source.buttons ?? 0)
    payload.pointerType = typeof source.pointerType === 'string' ? source.pointerType : 'mouse'
  }
  if ('key' in source) {
    payload.key = String(source.key ?? '')
    payload.code = String(source.code ?? '')
    payload.repeat = source.repeat === true
  }
  if ('deltaX' in source) {
    payload.deltaX = Number(source.deltaX ?? 0)
    payload.deltaY = Number(source.deltaY ?? 0)
  }
  if (target && ('value' in target || 'checked' in target)) {
    payload.value = target.value
    if (typeof target.checked === 'boolean') payload.checked = target.checked
  }
  return payload
}

function renderForDirective(
  input: SFCVueRenderElementInput,
  renderFn: SFCVueRenderFunction,
): SFCVueRenderResult | undefined {
  const directive = input.node.directives.for
  if (!directive) return undefined

  const source = evaluateSFCValue(directive.source, input.context)
  const entries = createForEntries(source)
  if (!entries) return null
  const logicalSiblings: EndgeStyleMatchNode[] = []

  const children = entries
    .map(([key, value], index) => renderForItem(input, renderFn, directive, key, value, index, entries.length, logicalSiblings))
    .filter((child): child is Exclude<SFCVueRenderResult, null> => child !== null)

  return input.h('span', null, children)
}

function renderForItem(
  input: SFCVueRenderElementInput,
  renderFn: SFCVueRenderFunction,
  directive: RComponentSFC_IR_ForDirective,
  key: unknown,
  value: unknown,
  index: number,
  count: number,
  styleSiblings: EndgeStyleMatchNode[],
): SFCVueRenderResult {
  const locals: Record<string, unknown> = {
    [directive.item]: value,
  }

  if (directive.index) locals[directive.index] = index

  const context = extendSFCVueRenderContext(input.context, locals, {
    item: directive.item,
    index: directive.index,
    value,
    indexValue: index,
    key,
  }, `${input.context.consumerScope}/for:${input.node.id}:${String(key)}`)
  context.styleSiblings = styleSiblings
  context.styleSiblingCount = count

  return renderOnce({
    ...input,
    context,
  }, renderFn)
}

function createStyleNode(
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
  context: SFCVueRenderContext,
): EndgeStyleMatchNode {
  const classes = normalizeTokenSet(props.class)
  const states = normalizeStateSet(props.state)
  const parts = normalizeTokenSet(props.part)
  const identity = node.tag === 'Component' ? String(props.is ?? props.identity ?? '').trim() || undefined : undefined
  return {
    tag: node.tag,
    id: typeof props.id === 'string' && props.id.trim() ? props.id.trim() : undefined,
    classes,
    attributes: props,
    states,
    parts,
    component: node.componentTag,
    identity,
    ownerScopeId: context.styleOwnerScopeId,
    runtimeScopeIds: new Set(context.runtimeScopeIds),
    parent: context.styleParent,
    previousSibling: context.styleSiblings.at(-1),
    index: context.styleSiblings.length + 1,
    siblingCount: context.styleSiblingCount || context.styleSiblings.length + 1,
  }
}

function normalizeTokenSet(value: unknown): Set<string> {
  const result = new Set<string>()
  const visit = (item: unknown) => {
    if (typeof item === 'string') item.trim().split(/\s+/).filter(Boolean).forEach(token => result.add(token))
    else if (Array.isArray(item)) item.forEach(visit)
    else if (item && typeof item === 'object') Object.entries(item as Record<string, unknown>).forEach(([key, enabled]) => { if (enabled) result.add(key) })
  }
  visit(value)
  return result
}

function normalizeStateSet(value: unknown): Set<string> {
  return normalizeTokenSet(value)
}

function createForEntries(source: unknown): Array<[unknown, unknown]> | null {
  if (source == null) return null

  if (Array.isArray(source)) {
    return source.map((value, index) => [index, value])
  }

  if (typeof source === 'object') {
    return Object.entries(source as Record<string, unknown>)
  }

  return null
}

function createSFCStyle(props: Record<string, unknown>): Record<string, string> {
  const style: Record<string, string> = {}

  assignSpacing(style, 'padding', props.p)
  assignSpacing(style, 'paddingTop', props.pt)
  assignSpacing(style, 'paddingRight', props.pr)
  assignSpacing(style, 'paddingBottom', props.pb)
  assignSpacing(style, 'paddingLeft', props.pl)
  assignSpacing(style, 'margin', props.m)
  assignSpacing(style, 'marginTop', props.mt)
  assignSpacing(style, 'marginRight', props.mr)
  assignSpacing(style, 'marginBottom', props.mb)
  assignSpacing(style, 'marginLeft', props.ml)

  assignStyle(style, 'color', props.color)
  assignStyle(style, 'background', props.bg)
  assignStyle(style, 'width', props.w)
  assignStyle(style, 'height', props.h)
  assignStyle(style, 'minWidth', props.minW)
  assignStyle(style, 'minHeight', props.minH)
  assignStyle(style, 'maxWidth', props.maxW)
  assignStyle(style, 'maxHeight', props.maxH)
  assignGridPlacement(style, 'gridColumn', props.colStart, props.colSpan)
  assignGridPlacement(style, 'gridRow', props.rowStart, props.rowSpan)

  return style
}

function assignGridPlacement(
  style: Record<string, string>,
  key: 'gridColumn' | 'gridRow',
  startValue: unknown,
  spanValue: unknown,
): void {
  const start = normalizePositiveInteger(startValue)
  const span = normalizePositiveInteger(spanValue)
  if (start != null && span != null) {
    style[key] = `${start} / span ${span}`
    return
  }
  if (start != null) {
    style[key] = String(start)
    return
  }
  if (span != null) {
    style[key] = `span ${span}`
  }
}

function normalizePositiveInteger(value: unknown): number | null {
  if (value == null || value === false || value === '') return null
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null
}

function assignSpacing(style: Record<string, string>, key: string, value: unknown): void {
  const normalized = normalizeLength(value, 4)
  if (normalized) style[key] = normalized
}

function assignStyle(style: Record<string, string>, key: string, value: unknown): void {
  const normalized = normalizeLength(value, 1)
  if (normalized) style[key] = normalized
}

function normalizeLength(value: unknown, unit: number): string | null {
  if (value == null || value === false) return null
  if (typeof value === 'number') return `${value * unit}px`

  const source = String(value).trim()
  if (source === '') return null
  if (/^-?\d+(\.\d+)?$/.test(source)) return `${Number(source) * unit}px`

  return source
}

function resolveKey(
  node: RComponentSFC_IR_ElementNode,
  props: Record<string, unknown>,
): unknown {
  if (node.directives.key) return resolveKeyValue(node.directives.key, props)
  return node.id
}

function resolveKeyValue(
  value: RComponentSFC_IR_Value,
  props: Record<string, unknown>,
): unknown {
  if (value.kind === 'literal') return value.value
  return props.key
}
