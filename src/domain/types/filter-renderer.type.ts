import type { CompositionFilterFieldsSlice, FilterRuntimeHost } from '@endge/core'

export interface EndgeFilterRendererProps {
  runtime: FilterRuntimeHost
  slice?: CompositionFilterFieldsSlice | null
  readonly?: boolean
}
