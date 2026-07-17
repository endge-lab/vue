import type {
  ComponentSFCRuntimeHost,
  EndgeSFCRenderAdapterKey,
  RComponentSFC_IR,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
  RComponentSFC_IR_Tag,
  RComponentSFC_IR_Value,
  RuntimeHostInputSource,
  RuntimeHostLocalInputSource,
  RuntimeHostRaphInputBinding,
  RuntimeHostRaphInputSource,
  RuntimeBoundaryPatch,
  UIRenderAdapter,
  EndgeStyleMatchNode,
  EndgeStyleSheetArtifact,
} from '@endge/core'
import type { h as VueH, VNode } from 'vue'

/** Поддерживаемые SFC primitive-теги во Vue adapter. */
export type SFCVueRenderPrimitive = RComponentSFC_IR_Tag

/** Будущий контракт binding-ов renderer adapter. */
export type SFCVueRenderBinding
  = | {
    kind: 'literal'
    value: unknown
  }
    | {
      kind: 'prop'
      path: string
    }

/** Контекст текущего SFC render pass. */
export interface SFCVueRenderContext {
  props: Record<string, unknown>
  locals: Record<string, unknown>
  iteration: SFCVueRenderIteration | null
  renderVersion: number
  host: ComponentSFCRuntimeHost | null
  runtimeState: SFCVueRuntimeStateController | null
  /** Stack identity текущего component-call для защиты от recursive render cycles. */
  componentStack: readonly string[]
  /** Stable renderer scope used to isolate host-owned computation resources. */
  consumerScope: string
  /** Effective global, ancestor and local style artifacts for this boundary. */
  styleArtifacts: readonly EndgeStyleSheetArtifact[]
  /** Logical parent in the abstract SFC tree. */
  styleParent: EndgeStyleMatchNode | undefined
  /** Already rendered logical siblings; physical Vue wrappers are not present here. */
  styleSiblings: EndgeStyleMatchNode[]
  /** Expected logical sibling count for structural pseudo selectors. */
  styleSiblingCount: number
  /** Current scoped SFC owner. */
  styleOwnerScopeId: string | undefined
  /** Runtime lifecycle ancestry used by renderer boundary isolation. */
  runtimeScopeIds: readonly string[]
}

/** Structural runtime-state controller contract used by Vue render adapters. */
export interface SFCVueRuntimeStateController {
  readonly runtimeId: string
  readonly storageKey: string

  get<T>(entityKey: string, section: string, fallback: T): T

  set<T>(entityKey: string, section: string, value: T): void

  remove(entityKey: string, section?: string): void

  clear(): void
}

/** Данные текущей for-итерации. */
export interface SFCVueRenderIteration {
  item: string
  index?: string
  value: unknown
  indexValue: number
  key: unknown
}

/** Входные props корневого SFC renderer adapter. */
export interface SFCVueRenderAdapterProps {
  ir: RComponentSFC_IR | null
  props?: Record<string, unknown>
  renderVersion?: number
  host?: ComponentSFCRuntimeHost | null
}

/** Локальный источник входных props для runtime renderer-а. */
export type SFCVueLocalInputSource = RuntimeHostLocalInputSource

/** Binding на runtime/Raph источник данных. */
export type SFCVueRaphInputBinding = RuntimeHostRaphInputBinding

/** Источник входных props из runtime/Raph-хранилища. */
export type SFCVueRaphInputSource = RuntimeHostRaphInputSource

/** Источник входных props для SFC runtime bridge. */
export type SFCVueRuntimeInputSource = RuntimeHostInputSource

/** Вход Vue runtime renderer-а, связывающего RuntimeHost и render root. */
export interface SFCVueRuntimeRendererProps {
  host: ComponentSFCRuntimeHost | null
  input: SFCVueRuntimeInputSource
}

/** Callback обновления materialized props из runtime bridge в Vue root. */
export type SFCVueRuntimeBridgeUpdate = (
  props: Record<string, unknown>,
) => void

/** Callback точечного patch-а от runtime boundary в Vue adapter. */
export type SFCVueRuntimeBridgeBoundaryPatch = (
  patch: RuntimeBoundaryPatch,
) => void | boolean | Promise<void | boolean>

/** Тип Vue h-функции, который нужен renderer-слою без привязки к компоненту. */
export type SFCVueRenderH = typeof VueH

/** Результат рендера одного SFC узла. */
export type SFCVueRenderResult = VNode | string | null

/** Результат рендера списка SFC узлов. */
export type SFCVueRenderListResult = Array<VNode | string>

/** Вход renderer-а одного SFC element node. */
export interface SFCVueRenderElementInput {
  h: SFCVueRenderH
  node: RComponentSFC_IR_ElementNode
  context: SFCVueRenderContext
  children: SFCVueRenderListResult
  renderChildren: (context: SFCVueRenderContext) => SFCVueRenderListResult
  props: Record<string, unknown>
  attrs: Record<string, unknown>
}

/** Нормализованный вход visual primitive renderer-а без compiler/runtime деталей. */
export type SFCVueRenderAdapterElementInput = Pick<
  SFCVueRenderElementInput,
  'h' | 'children' | 'props' | 'attrs'
>

/** Renderer одной visual primitive внутри Vue adapter-а. */
export type SFCVueRenderAdapterFunction = (
  input: SFCVueRenderAdapterElementInput,
) => SFCVueRenderResult

/** Полный набор visual primitive renderers Vue adapter-а. */
export type SFCVueRenderAdapterRendererMap = Record<
  EndgeSFCRenderAdapterKey,
  SFCVueRenderAdapterFunction
>

/** Типизированный SFC adapter для Vue render engine. */
export interface SFCVueRenderAdapter extends UIRenderAdapter<SFCVueRenderAdapterFunction> {
  protocol: 'endge-sfc'
  protocolVersion: 1
  renderer: 'vue'
  renderers: SFCVueRenderAdapterRendererMap
}

/** Функция renderer-а одного SFC primitive-тега. */
export type SFCVueRenderFunction = (
  input: SFCVueRenderElementInput,
) => SFCVueRenderResult

/** Вход функции рендера произвольного SFC IR узла. */
export interface SFCVueRenderNodeInput {
  h: SFCVueRenderH
  node: RComponentSFC_IR_Node
  context: SFCVueRenderContext
}

/** Настройки условного рендера, вычисленные из sibling chain. */
export interface SFCVueRenderConditionState {
  shouldRender: boolean
  startsChain: boolean
  matchedChain: boolean
  closesChain: boolean
}

/** Нормализованное значение style prop. */
export type SFCVueRenderStyleValue = string | number | null | undefined

/** Сервисная функция вычисления IR-значений. */
export type SFCVueRenderValueEvaluator = (
  value: RComponentSFC_IR_Value | undefined,
  context: SFCVueRenderContext,
) => unknown
