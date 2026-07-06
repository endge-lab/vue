import type {
  SFCVueRuntimeBridgeUpdate,
  SFCVueRuntimeInputSource,
} from '@/domain/types/sfc-render.type'
import type { ComponentSFCRuntimeHost } from '@endge/core'

/**
 * Связывает runtime-host SFC-компонента с Vue render root.
 * Bridge материализует входные данные в плоский props snapshot.
 */
export class SFCVueRuntimeBridge {
  private readonly _host: ComponentSFCRuntimeHost
  private readonly _onUpdate: SFCVueRuntimeBridgeUpdate
  private _input: SFCVueRuntimeInputSource
  private _isMounted = false

  constructor(input: {
    host: ComponentSFCRuntimeHost
    input: SFCVueRuntimeInputSource
    onUpdate: SFCVueRuntimeBridgeUpdate
  }) {
    this._host = input.host
    this._input = input.input
    this._onUpdate = input.onUpdate
  }

  /**
   * Запускает bridge и сразу передает первый props snapshot в render root.
   */
  public mount(): void {
    if (this._isMounted)
      return

    this._isMounted = true
    this._emitResolvedProps()
  }

  /**
   * Обновляет источник входных данных без пересоздания runtime-host.
   */
  public updateInput(input: SFCVueRuntimeInputSource): void {
    this._input = input

    if (this._isMounted)
      this._emitResolvedProps()
  }

  /**
   * Освобождает подписки bridge.
   * Для local input подписок нет, Raph-подписки появятся на следующем этапе.
   */
  public destroy(): void {
    this._isMounted = false
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
    throw new Error('[SFCVueRuntimeBridge] raph input source is not implemented yet')
  }
}
