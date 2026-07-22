import { parseExpression } from '@babel/parser'
import type { RComponentSFC_IR_Value } from '@endge/core'
import { DataPath } from '@endge/raph'
import type { SFCVueRenderBinding, SFCVueRenderContext } from '@/domain/types/sfc-render.type'

interface SFCExpressionNode {
  type: string
  [key: string]: unknown
}

const UNSUPPORTED_EXPRESSION = Symbol('unsupported-sfc-expression')
const EXPRESSION_CACHE_LIMIT = 512
const expressionCache = new Map<string, SFCExpressionNode | null>()
const BLOCKED_MEMBER_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

type SFCExpressionResult = unknown | typeof UNSUPPORTED_EXPRESSION

/** Вычисляет безопасное подмножество SFC IR value без eval и runtime зависимостей. */
export function evaluateSFCValue(
  value: RComponentSFC_IR_Value | undefined,
  context: SFCVueRenderContext,
): unknown {
  if (!value) return undefined
  if (value.kind === 'literal') return value.value

  return evaluateSFCExpression(value.source, context)
}

/** Вычисляет будущий binding-контракт renderer adapter. */
export function evaluateSFCBinding(
  binding: SFCVueRenderBinding,
  context: SFCVueRenderContext,
): unknown {
  if (binding.kind === 'literal') return binding.value
  return readSFCPath(binding.path, context)
}

/** Вычисляет props object из IR props map. */
export function evaluateSFCProps(
  props: Record<string, RComponentSFC_IR_Value> | undefined,
  context: SFCVueRenderContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(props ?? {})) {
    result[key] = evaluateSFCValue(value, context)
  }

  return result
}

/** Приводит любое значение к условию control-flow. */
export function isTruthySFCValue(value: unknown): boolean {
  return Boolean(value)
}

/** Читает путь из locals, затем из props. Отсутствующие поля возвращают undefined. */
export function readSFCPath(path: string, context: SFCVueRenderContext): unknown {
  const segments = parseSFCPath(path)
  if (segments.length === 0) return undefined

  const [head, ...tail] = segments
  if (!head.key) return undefined

  const root = head.key === 'props'
    ? context.props
    : Object.prototype.hasOwnProperty.call(context.locals, head.key)
      ? context.locals[head.key]
      : context.props[head.key]

  return readSFCObjectPathSegments(root, tail)
}

/** Читает относительный DataPath, включая array selectors, из переданного объекта. */
export function readSFCObjectPath(path: string, source: unknown): unknown {
  return readSFCObjectPathSegments(source, parseSFCPath(path))
}

function readSFCObjectPathSegments(
  source: unknown,
  segments: ReturnType<DataPath['segments']>,
): unknown {
  return segments.reduce<unknown>((current, segment) => {
    if (current == null) return undefined

    if (segment.key != null) {
      if (typeof current !== 'object' && typeof current !== 'function') return undefined
      return (current as Record<string, unknown>)[segment.key]
    }

    if (segment.index != null) {
      return Array.isArray(current) ? current[segment.index] : undefined
    }

    if (segment.pkey != null && segment.pval != null) {
      if (!Array.isArray(current)) return undefined

      return current.find((item) => {
        if (item == null || typeof item !== 'object') return false
        return Object.is((item as Record<string, unknown>)[segment.pkey!], segment.pval)
      })
    }

    return undefined
  }, source)
}

/**
 * Безопасно вычисляет SFC expression через AST interpreter без eval/Function.
 * Простые DataPath остаются на быстром пути, сложные AST кэшируются по source.
 */
export function evaluateSFCExpression(expression: string, context: SFCVueRenderContext): unknown {
  const source = expression.trim()
  if (source === '') return undefined
  if (source === 'true') return true
  if (source === 'false') return false
  if (source === 'null') return null
  if (source === 'undefined') return undefined

  if (isQuotedString(source)) return source.slice(1, -1)
  if (/^-?\d+(\.\d+)?$/.test(source)) return Number(source)

  if (isSupportedPath(source)) return readSFCPath(source, context)

  const ast = parseCachedExpression(source)
  if (!ast) return undefined

  const result = evaluateExpressionNode(ast, context)
  return result === UNSUPPORTED_EXPRESSION ? undefined : result
}

function isQuotedString(source: string): boolean {
  return (
    (source.startsWith('"') && source.endsWith('"')) ||
    (source.startsWith("'") && source.endsWith("'"))
  )
}

function parseCachedExpression(source: string): SFCExpressionNode | null {
  if (expressionCache.has(source)) {
    return expressionCache.get(source) ?? null
  }

  let parsed: SFCExpressionNode | null = null
  try {
    parsed = parseExpression(source, {
      sourceType: 'module',
      plugins: ['typescript'],
    }) as unknown as SFCExpressionNode
  } catch {
    parsed = null
  }

  if (expressionCache.size >= EXPRESSION_CACHE_LIMIT) {
    const oldestKey = expressionCache.keys().next().value
    if (oldestKey !== undefined) expressionCache.delete(oldestKey)
  }
  expressionCache.set(source, parsed)

  return parsed
}

function evaluateExpressionNode(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  switch (node.type) {
    case 'Identifier':
      return evaluateIdentifier(node, context)
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'UnaryExpression':
      return evaluateUnaryExpression(node, context)
    case 'LogicalExpression':
      return evaluateLogicalExpression(node, context)
    case 'BinaryExpression':
      return evaluateBinaryExpression(node, context)
    case 'ConditionalExpression':
      return evaluateConditionalExpression(node, context)
    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return evaluateMemberExpression(node, context)
    case 'CallExpression':
    case 'OptionalCallExpression':
      return evaluateCallExpression(node, context)
    case 'ArrayExpression':
      return evaluateArrayExpression(node, context)
    case 'ObjectExpression':
      return evaluateObjectExpression(node, context)
    case 'TemplateLiteral':
      return evaluateTemplateLiteral(node, context)
    case 'ParenthesizedExpression':
    case 'TSAsExpression':
    case 'TSTypeAssertion':
    case 'TSNonNullExpression': {
      const expression = asExpressionNode(node.expression)
      return expression ? evaluateExpressionNode(expression, context) : UNSUPPORTED_EXPRESSION
    }
    default:
      return UNSUPPORTED_EXPRESSION
  }
}

function evaluateIdentifier(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  const name = typeof node.name === 'string' ? node.name : ''
  if (!name) return UNSUPPORTED_EXPRESSION
  if (name === 'undefined') return undefined
  if (name === 'NaN') return Number.NaN
  if (name === 'Infinity') return Number.POSITIVE_INFINITY
  if (name === 'props') return context.props

  if (Object.prototype.hasOwnProperty.call(context.locals, name)) {
    return context.locals[name]
  }
  return context.props[name]
}

function evaluateUnaryExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  const argumentNode = asExpressionNode(node.argument)
  if (!argumentNode) return UNSUPPORTED_EXPRESSION

  const argument = evaluateExpressionNode(argumentNode, context)
  if (argument === UNSUPPORTED_EXPRESSION) return argument

  switch (node.operator) {
    case '!':
      return !isTruthySFCValue(argument)
    case '+':
      return +(argument as number)
    case '-':
      return -(argument as number)
    case '~':
      return ~(argument as number)
    case 'typeof':
      return typeof argument
    case 'void':
      return undefined
    default:
      return UNSUPPORTED_EXPRESSION
  }
}

function evaluateLogicalExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  const leftNode = asExpressionNode(node.left)
  const rightNode = asExpressionNode(node.right)
  if (!leftNode || !rightNode) return UNSUPPORTED_EXPRESSION

  const left = evaluateExpressionNode(leftNode, context)
  if (left === UNSUPPORTED_EXPRESSION) return left

  if (node.operator === '&&') {
    return isTruthySFCValue(left) ? evaluateExpressionNode(rightNode, context) : left
  }
  if (node.operator === '||') {
    return isTruthySFCValue(left) ? left : evaluateExpressionNode(rightNode, context)
  }
  if (node.operator === '??') {
    return left == null ? evaluateExpressionNode(rightNode, context) : left
  }

  return UNSUPPORTED_EXPRESSION
}

function evaluateBinaryExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  const leftNode = asExpressionNode(node.left)
  const rightNode = asExpressionNode(node.right)
  if (!leftNode || !rightNode) return UNSUPPORTED_EXPRESSION

  const left = evaluateExpressionNode(leftNode, context)
  const right = evaluateExpressionNode(rightNode, context)
  if (left === UNSUPPORTED_EXPRESSION || right === UNSUPPORTED_EXPRESSION) {
    return UNSUPPORTED_EXPRESSION
  }

  switch (node.operator) {
    case '===':
      return left === right
    case '!==':
      return left !== right
    case '==':
      return isLooselyEqual(left, right)
    case '!=':
      return !isLooselyEqual(left, right)
    case '<':
      return (left as number) < (right as number)
    case '<=':
      return (left as number) <= (right as number)
    case '>':
      return (left as number) > (right as number)
    case '>=':
      return (left as number) >= (right as number)
    case '+':
      return (left as number) + (right as number)
    case '-':
      return (left as number) - (right as number)
    case '*':
      return (left as number) * (right as number)
    case '/':
      return (left as number) / (right as number)
    case '%':
      return (left as number) % (right as number)
    case '**':
      return (left as number) ** (right as number)
    case '|':
      return (left as number) | (right as number)
    case '&':
      return (left as number) & (right as number)
    case '^':
      return (left as number) ^ (right as number)
    case '<<':
      return (left as number) << (right as number)
    case '>>':
      return (left as number) >> (right as number)
    case '>>>':
      return (left as number) >>> (right as number)
    default:
      return UNSUPPORTED_EXPRESSION
  }
}

function isLooselyEqual(left: unknown, right: unknown): boolean {
  // Поддерживаем JS expression semantics для авторского ==.
  // eslint-disable-next-line eqeqeq
  return left == right
}

function evaluateConditionalExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  const testNode = asExpressionNode(node.test)
  const consequentNode = asExpressionNode(node.consequent)
  const alternateNode = asExpressionNode(node.alternate)
  if (!testNode || !consequentNode || !alternateNode) return UNSUPPORTED_EXPRESSION

  const test = evaluateExpressionNode(testNode, context)
  if (test === UNSUPPORTED_EXPRESSION) return test

  return evaluateExpressionNode(isTruthySFCValue(test) ? consequentNode : alternateNode, context)
}

function evaluateMemberExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  const objectNode = asExpressionNode(node.object)
  const propertyNode = asExpressionNode(node.property)
  if (!objectNode || !propertyNode) return UNSUPPORTED_EXPRESSION

  const object = evaluateExpressionNode(objectNode, context)
  if (object === UNSUPPORTED_EXPRESSION) return object
  if (object == null) return undefined

  if (node.computed === true && isSelectorExpression(propertyNode)) {
    return evaluateSelectorExpression(object, propertyNode, context)
  }

  const property =
    node.computed === true
      ? evaluateExpressionNode(propertyNode, context)
      : readIdentifierName(propertyNode)
  if (property === UNSUPPORTED_EXPRESSION) return property
  if (typeof property !== 'string' && typeof property !== 'number') {
    return UNSUPPORTED_EXPRESSION
  }

  return readSafeMember(object, property)
}

function isSelectorExpression(node: SFCExpressionNode): boolean {
  return (
    node.type === 'AssignmentExpression' &&
    node.operator === '=' &&
    asExpressionNode(node.left)?.type === 'Identifier'
  )
}

function evaluateSelectorExpression(
  object: unknown,
  selector: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  if (!Array.isArray(object)) return undefined

  const left = asExpressionNode(selector.left)
  const right = asExpressionNode(selector.right)
  if (!left || !right) return UNSUPPORTED_EXPRESSION

  const key = readIdentifierName(left)
  const expected = evaluateExpressionNode(right, context)
  if (key === UNSUPPORTED_EXPRESSION || expected === UNSUPPORTED_EXPRESSION) {
    return UNSUPPORTED_EXPRESSION
  }

  return object.find((item) => {
    if (item == null || typeof item !== 'object') return false
    if (BLOCKED_MEMBER_KEYS.has(key)) return false
    if (!Object.prototype.hasOwnProperty.call(item, key)) return false
    return Object.is((item as Record<string, unknown>)[key], expected)
  })
}

function readSafeMember(object: unknown, property: string | number): SFCExpressionResult {
  const key = String(property)
  if (BLOCKED_MEMBER_KEYS.has(key)) return UNSUPPORTED_EXPRESSION

  if (typeof object === 'string') {
    if (key === 'length') return object.length
    const index = readArrayIndex(key)
    return index == null ? undefined : object[index]
  }

  if (Array.isArray(object)) {
    if (key === 'length') return object.length
    const index = readArrayIndex(key)
    return index == null ? undefined : object[index]
  }

  if (typeof object !== 'object' && typeof object !== 'function') return undefined
  if (!Object.prototype.hasOwnProperty.call(object, key)) return undefined
  return (object as Record<string, unknown>)[key]
}

function readArrayIndex(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const index = Number(value)
  return Number.isSafeInteger(index) ? index : null
}

function evaluateCallExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  const callee = asExpressionNode(node.callee)
  if (!callee) return UNSUPPORTED_EXPRESSION

  const args = evaluateCallArguments(node.arguments, context)
  if (args === UNSUPPORTED_EXPRESSION) return args

  if (callee.type === 'Identifier') {
    return callSafeGlobal(readIdentifierName(callee), args, context)
  }

  if (callee.type !== 'MemberExpression' && callee.type !== 'OptionalMemberExpression') {
    return UNSUPPORTED_EXPRESSION
  }

  const objectNode = asExpressionNode(callee.object)
  const methodNode = asExpressionNode(callee.property)
  if (!objectNode || !methodNode) return UNSUPPORTED_EXPRESSION

  const method =
    callee.computed === true
      ? evaluateExpressionNode(methodNode, context)
      : readIdentifierName(methodNode)
  if (method === UNSUPPORTED_EXPRESSION || typeof method !== 'string') {
    return UNSUPPORTED_EXPRESSION
  }

  const globalName =
    objectNode.type === 'Identifier' ? readIdentifierName(objectNode) : UNSUPPORTED_EXPRESSION
  if (globalName !== UNSUPPORTED_EXPRESSION) {
    const globalResult = callSafeStatic(globalName, method, args)
    if (globalResult !== UNSUPPORTED_EXPRESSION) return globalResult
  }

  const receiver = evaluateExpressionNode(objectNode, context)
  if (receiver === UNSUPPORTED_EXPRESSION) return receiver
  if (receiver == null) return undefined

  return callSafeInstance(receiver, method, args)
}

function evaluateCallArguments(
  value: unknown,
  context: SFCVueRenderContext,
): unknown[] | typeof UNSUPPORTED_EXPRESSION {
  if (!Array.isArray(value)) return UNSUPPORTED_EXPRESSION

  const result: unknown[] = []
  for (const argument of value) {
    const argumentNode = asExpressionNode(argument)
    if (!argumentNode || argumentNode.type === 'SpreadElement') return UNSUPPORTED_EXPRESSION
    const evaluated = evaluateExpressionNode(argumentNode, context)
    if (evaluated === UNSUPPORTED_EXPRESSION) return evaluated
    result.push(evaluated)
  }
  return result
}

function callSafeGlobal(
  name: string | typeof UNSUPPORTED_EXPRESSION,
  args: unknown[],
  context: SFCVueRenderContext,
): SFCExpressionResult {
  if (name === UNSUPPORTED_EXPRESSION) return name
  if (name === 't') {
    if (typeof args[0] !== 'string' || args.length > 2)
      return UNSUPPORTED_EXPRESSION
    const fallback = args[1] == null ? undefined : String(args[1])
    return context.host?.translate(args[0], fallback) ?? fallback ?? `{{${args[0]}}}`
  }
  if (name === 'Boolean') return Boolean(args[0])
  if (name === 'Number') return Number(args[0])
  if (name === 'String') return String(args[0] ?? '')
  return UNSUPPORTED_EXPRESSION
}

function callSafeStatic(name: string, method: string, args: unknown[]): SFCExpressionResult {
  if (name === 'Array' && method === 'isArray') return Array.isArray(args[0])
  if (name === 'Number' && method === 'isFinite') return Number.isFinite(args[0])
  if (name === 'Number' && method === 'isNaN') return Number.isNaN(args[0])
  if (name === 'Object' && method === 'is') return Object.is(args[0], args[1])

  if (name !== 'Math') return UNSUPPORTED_EXPRESSION
  const numbers = args.map((value) => Number(value))
  if (method === 'abs') return Math.abs(numbers[0] ?? Number.NaN)
  if (method === 'ceil') return Math.ceil(numbers[0] ?? Number.NaN)
  if (method === 'floor') return Math.floor(numbers[0] ?? Number.NaN)
  if (method === 'round') return Math.round(numbers[0] ?? Number.NaN)
  if (method === 'trunc') return Math.trunc(numbers[0] ?? Number.NaN)
  if (method === 'max') return Math.max(...numbers)
  if (method === 'min') return Math.min(...numbers)
  return UNSUPPORTED_EXPRESSION
}

function callSafeInstance(receiver: unknown, method: string, args: unknown[]): SFCExpressionResult {
  if (typeof receiver === 'string') {
    if (method === 'includes') return receiver.includes(String(args[0] ?? ''), Number(args[1] ?? 0))
    if (method === 'startsWith')
      return receiver.startsWith(String(args[0] ?? ''), Number(args[1] ?? 0))
    if (method === 'endsWith')
      return receiver.endsWith(String(args[0] ?? ''), args[1] == null ? undefined : Number(args[1]))
    if (method === 'toLowerCase') return receiver.toLowerCase()
    if (method === 'toUpperCase') return receiver.toUpperCase()
    if (method === 'trim') return receiver.trim()
  }

  if (Array.isArray(receiver) && method === 'includes') {
    return receiver.includes(args[0], Number(args[1] ?? 0))
  }

  return UNSUPPORTED_EXPRESSION
}

function evaluateArrayExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  if (!Array.isArray(node.elements)) return UNSUPPORTED_EXPRESSION

  const values: unknown[] = []
  for (const element of node.elements) {
    if (element == null) {
      values.push(undefined)
      continue
    }

    const elementNode = asExpressionNode(element)
    if (!elementNode || elementNode.type === 'SpreadElement') return UNSUPPORTED_EXPRESSION
    const value = evaluateExpressionNode(elementNode, context)
    if (value === UNSUPPORTED_EXPRESSION) return value
    values.push(value)
  }
  return values
}

function evaluateObjectExpression(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  if (!Array.isArray(node.properties)) return UNSUPPORTED_EXPRESSION
  const result: Record<string, unknown> = {}
  for (const property of node.properties) {
    const entry = asExpressionNode(property)
    if (!entry || entry.type !== 'ObjectProperty' || entry.computed === true)
      return UNSUPPORTED_EXPRESSION
    const keyNode = asExpressionNode(entry.key)
    const valueNode = asExpressionNode(entry.value)
    if (!keyNode || !valueNode) return UNSUPPORTED_EXPRESSION
    const key = keyNode.type === 'Identifier'
      ? readIdentifierName(keyNode)
      : keyNode.type === 'StringLiteral' || keyNode.type === 'NumericLiteral'
        ? String(keyNode.value)
        : UNSUPPORTED_EXPRESSION
    if (key === UNSUPPORTED_EXPRESSION || BLOCKED_MEMBER_KEYS.has(key))
      return UNSUPPORTED_EXPRESSION
    const value = evaluateExpressionNode(valueNode, context)
    if (value === UNSUPPORTED_EXPRESSION) return value
    result[key] = value
  }
  return result
}

function evaluateTemplateLiteral(
  node: SFCExpressionNode,
  context: SFCVueRenderContext,
): SFCExpressionResult {
  if (!Array.isArray(node.quasis) || !Array.isArray(node.expressions)) {
    return UNSUPPORTED_EXPRESSION
  }

  let result = ''
  for (let index = 0; index < node.quasis.length; index += 1) {
    const quasi = node.quasis[index]
    if (!quasi || typeof quasi !== 'object') return UNSUPPORTED_EXPRESSION
    const value = (quasi as Record<string, unknown>).value
    if (!value || typeof value !== 'object') return UNSUPPORTED_EXPRESSION
    const cooked = (value as Record<string, unknown>).cooked
    const raw = (value as Record<string, unknown>).raw
    result += typeof cooked === 'string' ? cooked : String(raw ?? '')

    const expression = asExpressionNode(node.expressions[index])
    if (!expression) continue
    const evaluated = evaluateExpressionNode(expression, context)
    if (evaluated === UNSUPPORTED_EXPRESSION) return evaluated
    result += String(evaluated ?? '')
  }
  return result
}

function readIdentifierName(node: SFCExpressionNode): string | typeof UNSUPPORTED_EXPRESSION {
  return node.type === 'Identifier' && typeof node.name === 'string'
    ? node.name
    : UNSUPPORTED_EXPRESSION
}

function asExpressionNode(value: unknown): SFCExpressionNode | null {
  return value != null &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).type === 'string'
    ? (value as SFCExpressionNode)
    : null
}

function isSupportedPath(source: string): boolean {
  const identifier = String.raw`[A-Za-z_$][\w$]*`
  const selectorKey = String.raw`[A-Za-z_$][\w$-]*`
  const singleQuoted = String.raw`'(?:\\.|[^'\\])*'`
  const doubleQuoted = String.raw`"(?:\\.|[^"\\])*"`
  const selectorValue = String.raw`(?:${singleQuoted}|${doubleQuoted}|\d+)`
  const dotSegment = String.raw`\.${identifier}`
  const indexSegment = String.raw`\[\s*\d+\s*\]`
  const selectorSegment = String.raw`\[\s*${selectorKey}\s*=\s*${selectorValue}\s*\]`

  return new RegExp(
    String.raw`^${identifier}(?:${dotSegment}|${indexSegment}|${selectorSegment})*$`,
  ).test(source)
}

function parseSFCPath(path: string): ReturnType<DataPath['segments']> {
  const source = path.trim()
  if (!isSupportedPath(source)) return []

  return DataPath.from(source).segments()
}
