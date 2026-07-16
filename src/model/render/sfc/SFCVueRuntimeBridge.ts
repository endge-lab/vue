import type {
  SFCVueRuntimeBridgeBoundaryPatch,
  SFCVueRuntimeBridgeUpdate,
  SFCVueRuntimeInputSource,
} from '@/domain/types/sfc-render.type'
import type { ComponentSFCRuntimeHost, RuntimeBoundaryPatch, RuntimeHostUpdateContext } from '@endge/core'

import { Raph } from '@endge/raph'

/**
 * Связывает runtime-host SFC-компонента с Vue render root.
 * Bridge материализует входные данные в плоский props snapshot.
 */
export class SFCVueRuntimeBridge {
  private readonly _host: ComponentSFCRuntimeHost
  private readonly _onUpdate: SFCVueRuntimeBridgeUpdate
  private readonly _onBoundaryPatch: SFCVueRuntimeBridgeBoundaryPatch | null
  private _input: SFCVueRuntimeInputSource
  private _isMounted = false
  private readonly _propsDirtyHandler = (_ctx: RuntimeHostUpdateContext): void => {
    if (this._isMounted)
      this._emitResolvedProps()
  }
  private readonly _boundaryDirtyHandler = async (patch: RuntimeBoundaryPatch): Promise<void> => {
    if (!this._isMounted)
      return

    const applied = await this._onBoundaryPatch?.(patch)
    if (!applied)
      this._emitResolvedProps()
  }
  private readonly _computationDirtyHandler = (): void => {
    if (this._isMounted)
      this._emitResolvedProps()
  }

  constructor(input: {
    host: ComponentSFCRuntimeHost
    input: SFCVueRuntimeInputSource
    onUpdate: SFCVueRuntimeBridgeUpdate
    onBoundaryPatch?: SFCVueRuntimeBridgeBoundaryPatch | null
  }) {
    this._host = input.host
    this._input = input.input
    this._onUpdate = input.onUpdate
    this._onBoundaryPatch = input.onBoundaryPatch ?? null
  }

  /**
   * Запускает bridge и сразу передает первый props snapshot в render root.
   */
  public mount(): void {
    if (this._isMounted)
      return

    this._isMounted = true
    this._host.setInputSource(this._input)
    this._host.on('props:dirty', this._propsDirtyHandler)
    this._host.on('boundary:dirty', this._boundaryDirtyHandler)
    this._host.on('computation:dirty', this._computationDirtyHandler)
    this._emitResolvedProps()
  }

  /**
   * Обновляет источник входных данных без пересоздания runtime-host.
   */
  public updateInput(input: SFCVueRuntimeInputSource): void {
    this._input = input
    this._host.setInputSource(input)

    if (this._isMounted)
      this._emitResolvedProps()
  }

  /**
   * Освобождает подписки bridge.
   */
  public destroy(): void {
    this._host.off('props:dirty', this._propsDirtyHandler)
    this._host.off('boundary:dirty', this._boundaryDirtyHandler)
    this._host.off('computation:dirty', this._computationDirtyHandler)
    this._isMounted = false
  }

  /** Принудительно перечитывает props из текущего input source. */
  public refresh(): void {
    if (this._isMounted)
      this._emitResolvedProps()
  }

  /**
   * Возвращает runtime-host, для которого создан bridge.
   */
  public get host(): ComponentSFCRuntimeHost {
    return this._host
  }

  private _emitResolvedProps(): void {
    this._onUpdate(this._resolveProps())
  }

  private _resolveProps(): Record<string, unknown> {
    if (this._input.kind === 'local')
      return { ...this._input.props }

    return this._resolveRaphProps()
  }

  private _resolveRaphProps(): Record<string, unknown> {
    if (this._input.kind !== 'raph')
      return {}

    const props: Record<string, unknown> = { ...(this._input.props ?? {}) }
    for (const [prop, binding] of Object.entries(this._input.bindings)) {
      props[prop] = Raph.get(binding.path)
    }

    return props
  }
}
