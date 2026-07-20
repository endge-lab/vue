import RevoGrid, { VGridVueTemplate } from '@revolist/vue3-datagrid'
import type {
  ComponentSFCTableColumnMenuDescriptor,
  ComponentSFCTableColumnPinMode,
  ComponentSFCTableColumnPinStateItem,
  ComponentSFCTableSortComparator,
  ComponentSFCTableSortDirection,
  ComponentSFCTableSortMode,
  ComponentSFCTableSortStateItem,
  ContextMenuDescriptor,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
  RuntimeBoundaryPatch,
  TableColumnActionContext,
  TableColumnPinSide,
  TableColumnSortState,
  TableRuntimeActionTarget,
  TableSortDirection,
} from '@endge/core'
import {
  Endge,
  normalizeComponentSFCTableColumnMenu,
  normalizeComponentSFCTableColumnPin,
  normalizeComponentSFCTableColumnPinMode,
  normalizeComponentSFCTableColumnVisibility,
  normalizeComponentSFCTableSort,
  normalizeComponentSFCTableSortMode,
  TABLE_RUNTIME_ACTION_IDS,
} from '@endge/core'
import type { PropType } from 'vue'
import { computed, defineComponent, h as vueH, inject, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type {
  SFCVueRenderContext,
  SFCVueRenderFunction,
  SFCVueRenderH,
  SFCVueRuntimeStateController,
} from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCProps, evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'
import {
  normalizeSFCTableCellAlignment,
  type SFCTableCellAlignment,
  type SFCTableCellAlign,
  type SFCTableCellVerticalAlign,
} from '@/ui/render/sfc/SFCRender_TableAlignment'
import { SFCVueBoundaryRegistryKey } from '@/ui/render/sfc/SFCRender_BoundaryRegistry'
import NativeTablePagination from '@/ui/table/NativeTablePagination.vue'
import { closeEndgeContextMenu, openEndgeContextMenu } from '@/ui/overlay/context-menu-manager'
import {
  createSFCTableColumnStyleSurfaces,
  createSFCTableStyleContract,
  decorateSFCTableRows,
  getSFCTableCellStyleSurfaces,
  SFC_TABLE_ROW_CLASS_FIELD,
  type SFCTableColumnStyleSurfaces,
  type SFCTablePublicPartAttrs,
  type SFCTableStyleContract,
  syncSFCTableDOMSurfaces,
  toRevoGridSurfaceProps,
} from '@/ui/render/sfc/SFCRender_TableStyle'

interface SFCTableColumn {
  index: number
  key: string
  title: string
  width: number | null
  pinnable: boolean
  sort: SFCTableColumnSort | null
  cellNodes: RComponentSFC_IR_Node[]
  rowDependencies: Set<string>
  styleSurfaces: SFCTableColumnStyleSurfaces
}

interface SFCTableColumnSort {
  sortable: boolean
  comparator: ComponentSFCTableSortComparator
  paths: string[]
}

interface SFCRevoGridElement {
  source?: Record<string, unknown>[]
  refresh?: (type?: 'all' | string) => Promise<void> | void
  setDataAt?: (input: {
    row: number
    col: number
    rowType: 'rgRow'
    colType: 'rgCol'
    val?: unknown
    skipDataUpdate?: boolean
  }) => Promise<void | undefined> | void
}

interface SFCTableCellRenderInput {
  h: SFCVueRenderH
  column: SFCTableColumn
  cellProps: Record<string, unknown>
  rows: Record<string, unknown>[]
  rowOffset: number
}

interface SFCTableCellAlignmentStyle {
  alignItems: 'flex-start' | 'center' | 'flex-end'
  justifyContent: 'flex-start' | 'center' | 'flex-end'
}

type SFCTablePaging = 'pages' | 'virtual'

interface SFCTableSortMeta {
  enabled: boolean
  direction?: ComponentSFCTableSortDirection
  index?: number
}

const naturalCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})
const textCollator = new Intl.Collator(undefined, {
  numeric: false,
  sensitivity: 'base',
})
const DEFAULT_TABLE_COLUMN_MENU: ContextMenuDescriptor = {
  kind: 'context-menu',
  items: [
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.columnPinLeft,
      label: TABLE_RUNTIME_ACTION_IDS.columnPinLeft,
      action: TABLE_RUNTIME_ACTION_IDS.columnPinLeft,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.columnPinRight,
      label: TABLE_RUNTIME_ACTION_IDS.columnPinRight,
      action: TABLE_RUNTIME_ACTION_IDS.columnPinRight,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.columnUnpin,
      label: TABLE_RUNTIME_ACTION_IDS.columnUnpin,
      action: TABLE_RUNTIME_ACTION_IDS.columnUnpin,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.columnResetPin,
      label: TABLE_RUNTIME_ACTION_IDS.columnResetPin,
      action: TABLE_RUNTIME_ACTION_IDS.columnResetPin,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.columnResetAllPins,
      label: TABLE_RUNTIME_ACTION_IDS.columnResetAllPins,
      action: TABLE_RUNTIME_ACTION_IDS.columnResetAllPins,
    },
    {
      kind: 'separator',
      id: 'pin-sort-separator',
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.sortSetColumnAsc,
      label: TABLE_RUNTIME_ACTION_IDS.sortSetColumnAsc,
      action: TABLE_RUNTIME_ACTION_IDS.sortSetColumnAsc,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.sortSetColumnDesc,
      label: TABLE_RUNTIME_ACTION_IDS.sortSetColumnDesc,
      action: TABLE_RUNTIME_ACTION_IDS.sortSetColumnDesc,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.sortClearColumn,
      label: TABLE_RUNTIME_ACTION_IDS.sortClearColumn,
      action: TABLE_RUNTIME_ACTION_IDS.sortClearColumn,
    },
    {
      kind: 'separator',
      id: 'sort-separator',
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_ACTION_IDS.sortClearAll,
      label: TABLE_RUNTIME_ACTION_IDS.sortClearAll,
      action: TABLE_RUNTIME_ACTION_IDS.sortClearAll,
    },
  ],
}

/** Рендерит SFC Table primitive через RevoGrid, не раскрывая RevoGrid в SFC-синтаксис. */
export const SFCRender_Table: SFCVueRenderFunction = SFCRender_Base((input) => {
  const rows = normalizeRows(input.props.rows)
  const explicitHeight = input.props.height ?? input.props.h
  const fillsAvailableHeight = explicitHeight == null || explicitHeight === ''
  const rowKey = normalizeText(input.props['row-key'] ?? input.props.rowKey, 'id')
  const sortDescriptor = normalizeComponentSFCTableSort(input.node)
  const pinDescriptor = normalizeComponentSFCTableColumnPin(input.node)
  const visibilityDescriptor = normalizeComponentSFCTableColumnVisibility(input.node)
  const columnMenuDescriptor = normalizeComponentSFCTableColumnMenu(input.node)
  const styleContract = createSFCTableStyleContract(input.context)
  const columns = collectTableColumns(input.node, input.context, sortDescriptor, pinDescriptor, styleContract)
  const source = rows.map(row => normalizeRowSnapshot(row, rowKey))
  const sortMode = normalizeComponentSFCTableSortMode(input.props['sort-mode'] ?? input.props.sortMode ?? sortDescriptor.mode)
  const pinMode = normalizeComponentSFCTableColumnPinMode(input.props['column-pin'] ?? input.props.columnPin ?? pinDescriptor.mode)
  const tableId = normalizeText(input.props.id ?? input.props.tableId ?? input.attrs.id, '')
  const cellAlignmentStyle = createCellAlignmentStyle(
    normalizeSFCTableCellAlignment(
      input.props['cell-align'] ?? input.props.cellAlign,
      input.props['cell-vertical-align'] ?? input.props.cellVerticalAlign,
    ),
  )
  const tableContext = extendSFCVueRenderContext(
    input.context,
    {},
    input.context.iteration,
    `${input.context.consumerScope}/table:${input.node.id}`,
  )

  return input.h('div', {
    ...input.attrs,
    'data-endge-layout-fill-height': fillsAvailableHeight ? '' : undefined,
    class: ['endge-sfc-table', input.props.class],
    style: {
      ...(isPlainObject(input.attrs.style) ? input.attrs.style : {}),
      width: normalizeCssSize(input.props.width ?? input.props.w, '100%'),
      height: normalizeCssSize(explicitHeight, '100%'),
      minHeight: normalizeCssSize(input.props.minHeight ?? input.props.minH, '180px'),
      flex: fillsAvailableHeight ? '1 1 0%' : undefined,
      overflow: 'hidden',
    },
  }, [
    input.h(SFCRevoGridTable as any, {
      boundaryId: input.node.id,
      tableId,
      runtimeState: input.context.runtimeState,
      columns,
      source,
      styleContract,
      rowKey,
      sortMode,
      pinMode,
      columnMenu: columnMenuDescriptor,
      defaultSort: sortDescriptor.defaultSort,
      defaultPin: pinDescriptor.defaultPin,
      defaultHidden: visibilityDescriptor.defaultHidden,
      rowSize: normalizeNumber(input.props.rowSize, 40),
      paging: normalizeTablePaging(input.props.paging),
      pageSize: normalizePositiveInteger(input.props['page-size'] ?? input.props.pageSize, 10),
      pageSizes: normalizePageSizes(input.props['page-sizes'] ?? input.props.pageSizes),
      lazy: input.props.lazy === true,
      theme: normalizeText(input.props.theme, 'compact'),
      renderVersion: input.context.renderVersion,
      renderCell: (cellInput: SFCTableCellRenderInput) => {
        return renderTableCell({
          ...cellInput,
          fallbackH: input.h,
          context: tableContext,
          cellAlignmentStyle,
        })
      },
    }),
  ])
})

const SFCRevoGridTable = defineComponent({
  name: 'SFCRevoGridTable',
  props: {
    boundaryId: {
      type: String,
      required: true,
    },
    tableId: {
      type: String,
      default: '',
    },
    runtimeState: {
      type: Object as PropType<SFCVueRuntimeStateController | null>,
      default: null,
    },
    columns: {
      type: Array as PropType<SFCTableColumn[]>,
      required: true,
    },
    source: {
      type: Array as PropType<Record<string, unknown>[]>,
      required: true,
    },
    styleContract: {
      type: Object as PropType<SFCTableStyleContract>,
      required: true,
    },
    rowKey: {
      type: String,
      required: true,
    },
    sortMode: {
      type: String as PropType<ComponentSFCTableSortMode>,
      required: true,
    },
    pinMode: {
      type: String as PropType<ComponentSFCTableColumnPinMode>,
      required: true,
    },
    columnMenu: {
      type: Object as PropType<ComponentSFCTableColumnMenuDescriptor>,
      required: true,
    },
    defaultSort: {
      type: Array as PropType<ComponentSFCTableSortStateItem[]>,
      required: true,
    },
    defaultPin: {
      type: Array as PropType<ComponentSFCTableColumnPinStateItem[]>,
      required: true,
    },
    defaultHidden: {
      type: Array as PropType<string[]>,
      required: true,
    },
    rowSize: {
      type: Number,
      required: true,
    },
    paging: {
      type: String as PropType<SFCTablePaging>,
      required: true,
    },
    pageSize: {
      type: Number,
      required: true,
    },
    pageSizes: {
      type: Array as PropType<number[]>,
      required: true,
    },
    lazy: {
      type: Boolean,
      required: true,
    },
    theme: {
      type: String,
      required: true,
    },
    renderVersion: {
      type: Number,
      required: true,
    },
    renderCell: {
      type: Function as PropType<(input: SFCTableCellRenderInput) => ReturnType<SFCVueRenderH>>,
      required: true,
    },
  },
  setup(props) {
    const gridRef = ref<{ $el?: SFCRevoGridElement } | SFCRevoGridElement | null>(null)
    const boundaryRegistry = inject(SFCVueBoundaryRegistryKey, null)
    const baseSource = shallowRef(cloneRows(props.source))
    const tableStateKey = computed(() => props.tableId ? `table:${props.tableId}` : null)
    const missingTableIdWarned = ref(false)
    const initialPagination = readTableState('pagination', { pageIndex: 0, pageSize: props.pageSize })
    const pageSize = ref(normalizePositiveInteger(initialPagination.pageSize, props.pageSize))
    const pageIndex = ref(Math.min(
      normalizeNonNegativeInteger(initialPagination.pageIndex, 0),
      Math.max(0, Math.ceil(baseSource.value.length / pageSize.value) - 1),
    ))
    const sortState = shallowRef(resolveInitialSortState())
    const defaultPinState = computed(() => createInitialPinState(props.pinMode, props.defaultPin, props.columns))
    const pinState = shallowRef(resolveInitialPinState())
    const visibilityState = shallowRef(resolveInitialVisibilityState())
    const visibleColumns = computed(() => filterVisibleTableColumns(props.columns, visibilityState.value))
    const currentSource = shallowRef(createStyledSource(baseSource.value))
    const pageCount = computed(() => Math.max(1, Math.ceil(baseSource.value.length / pageSize.value)))
    const previousSource = shallowRef(cloneRows(currentSource.value))
    const previousColumnsSignature = shallowRef(createColumnsSignature(visibleColumns.value))
    const previousSortSignature = shallowRef(createTableSortSignature(props.sortMode, props.defaultSort, props.columns))
    const previousPinSignature = shallowRef(createTablePinSignature(props.pinMode, props.defaultPin, props.columns))
    const previousVisibilitySignature = shallowRef(createTableVisibilitySignature(props.defaultHidden, props.columns))
    const tableActionTarget: TableRuntimeActionTarget = {
      setColumnVisibility: async (columnKey, visible) => {
        await commitVisibilityState({
          ...visibilityState.value,
          [columnKey]: visible,
        })
      },
      setColumnPin: async (columnKey, side) => {
        await commitPinState(setColumnPinState(pinState.value, columnKey, side, props.pinMode, props.columns))
      },
      resetColumnPin: async (columnKey) => {
        await commitPinState(resetColumnPinState(pinState.value, columnKey, defaultPinState.value))
      },
      resetAllPins: async () => {
        await commitPinState(defaultPinState.value)
      },
      setColumnSort: async (columnKey, direction) => {
        await commitSortState(setColumnSortState(sortState.value, columnKey, direction, props.sortMode, props.columns))
      },
      clearColumnSort: async (columnKey) => {
        await commitSortState(sortState.value.filter(item => item.key !== columnKey))
      },
      clearAllSort: async () => {
        await commitSortState([])
      },
    }

    const revoColumns = computed(() => visibleColumns.value.map((column) => {
      return createRevoColumn(
        column,
        column.index,
        getSortMeta(column.key, sortState.value),
        getPinSide(column.key, pinState.value),
        (event?: MouseEvent) => toggleColumnSort(column, event),
        (event: MouseEvent) => openColumnMenu(column, column.index, event),
        hasColumnMenu(column),
        (h, cellProps) => {
          return props.renderCell({
            h,
            column,
            cellProps,
            rows: currentSource.value,
            rowOffset: props.paging === 'pages' ? pageIndex.value * pageSize.value : 0,
          })
        },
      )
    }))

    const unregisterBoundary = boundaryRegistry?.register(props.boundaryId, {
      applyPatch: applyRuntimePatch,
    })

    onMounted(schedulePublicSurfaceSync)

    onBeforeUnmount(() => {
      closeEndgeContextMenu(props.boundaryId)
      unregisterBoundary?.()
    })

    watch(
      () => [props.renderVersion, props.source, props.columns, props.sortMode, props.defaultSort, props.pinMode, props.defaultPin, props.defaultHidden, props.paging] as const,
      async () => {
        const nextBaseSource = cloneRows(props.source)
        const nextSortSignature = createTableSortSignature(props.sortMode, props.defaultSort, props.columns)
        const nextPinSignature = createTablePinSignature(props.pinMode, props.defaultPin, props.columns)
        const nextVisibilitySignature = createTableVisibilitySignature(props.defaultHidden, props.columns)
        const pinChanged = previousPinSignature.value !== nextPinSignature
        const visibilityChanged = previousVisibilitySignature.value !== nextVisibilitySignature
        if (previousSortSignature.value !== nextSortSignature) {
          sortState.value = resolveInitialSortState()
          previousSortSignature.value = nextSortSignature
        }
        if (pinChanged) {
          pinState.value = resolveInitialPinState()
          previousPinSignature.value = nextPinSignature
        }
        if (visibilityChanged) {
          visibilityState.value = resolveInitialVisibilityState()
          previousVisibilitySignature.value = nextVisibilitySignature
        }

        baseSource.value = nextBaseSource
        clampPageIndex(nextBaseSource.length)
        const nextSource = createStyledSource(nextBaseSource)
        currentSource.value = nextSource
        await nextTick()
        await updateGridCells({
          grid: resolveGridElement(gridRef.value),
          previousRows: previousSource.value,
          nextRows: nextSource,
          previousColumnsSignature: previousColumnsSignature.value,
          nextColumns: visibleColumns.value,
          rowKey: props.rowKey,
        })
        if (pinChanged || visibilityChanged)
          await resolveGridElement(gridRef.value)?.refresh?.('all')
        previousSource.value = cloneRows(nextSource)
        previousColumnsSignature.value = createColumnsSignature(visibleColumns.value)
        schedulePublicSurfaceSync()
      },
    )

    async function toggleColumnSort(column: SFCTableColumn, event?: MouseEvent): Promise<void> {
      event?.preventDefault()
      event?.stopPropagation()

      if (!column.sort?.sortable || props.sortMode === 'disabled' || props.sortMode === 'fixed')
        return

      await commitSortState(toggleSortState(sortState.value, column.key, props.sortMode))
    }

    async function commitSortState(nextSortState: ComponentSFCTableSortStateItem[]): Promise<void> {
      sortState.value = nextSortState
      persistTableState('sort', nextSortState)
      pageIndex.value = 0
      persistPaginationState()
      const nextSource = createStyledSource(baseSource.value)
      currentSource.value = nextSource
      previousSource.value = cloneRows(nextSource)

      await nextTick()
      const grid = resolveGridElement(gridRef.value)
      if (grid) {
        grid.source = nextSource
        await grid.refresh?.('all')
      }
      schedulePublicSurfaceSync()
    }

    async function commitPinState(nextPinState: ComponentSFCTableColumnPinStateItem[]): Promise<void> {
      pinState.value = normalizePinState(nextPinState, props.columns, props.pinMode)
      persistTableState('pin', pinState.value)
      await nextTick()
      await resolveGridElement(gridRef.value)?.refresh?.('all')
      schedulePublicSurfaceSync()
    }

    async function commitVisibilityState(nextVisibilityState: Record<string, boolean>): Promise<void> {
      visibilityState.value = normalizePersistedVisibilityState(nextVisibilityState, {}, props.columns)
      persistTableState('visibility', visibilityState.value)
      await nextTick()
      await resolveGridElement(gridRef.value)?.refresh?.('all')
      previousColumnsSignature.value = createColumnsSignature(visibleColumns.value)
      schedulePublicSurfaceSync()
    }

    function createStyledSource(rows: readonly Record<string, unknown>[]): Record<string, unknown>[] {
      const sorted = applyTableSort([...rows], props.columns, sortState.value, props.sortMode)
      const start = pageIndex.value * pageSize.value
      const visibleRows = props.paging === 'virtual'
        ? sorted
        : sorted.slice(start, start + pageSize.value)
      return decorateSFCTableRows(
        visibleRows,
        props.columns.length,
        props.styleContract,
      )
    }

    async function commitPagination(nextPageIndex: number, nextPageSize = pageSize.value): Promise<void> {
      pageSize.value = normalizePositiveInteger(nextPageSize, props.pageSize)
      pageIndex.value = Math.min(
        normalizeNonNegativeInteger(nextPageIndex, 0),
        Math.max(0, Math.ceil(baseSource.value.length / pageSize.value) - 1),
      )
      persistPaginationState()
      const nextSource = createStyledSource(baseSource.value)
      currentSource.value = nextSource
      previousSource.value = cloneRows(nextSource)
      await nextTick()
      const grid = resolveGridElement(gridRef.value)
      if (grid) {
        grid.source = nextSource
        await grid.refresh?.('all')
      }
      schedulePublicSurfaceSync()
    }

    function clampPageIndex(rowCount = baseSource.value.length): void {
      pageIndex.value = Math.min(pageIndex.value, Math.max(0, Math.ceil(rowCount / pageSize.value) - 1))
    }

    function persistPaginationState(): void {
      persistTableState('pagination', { pageIndex: pageIndex.value, pageSize: pageSize.value })
    }

    function schedulePublicSurfaceSync(): void {
      void nextTick(() => {
        const grid = resolveGridHTMLElement(gridRef.value)
        if (grid) syncSFCTableDOMSurfaces(grid, props.styleContract)
      })
    }

    function resolveInitialSortState(): ComponentSFCTableSortStateItem[] {
      const fallback = createInitialSortState(props.sortMode, props.defaultSort, props.columns)
      return normalizePersistedSortState(readTableState('sort', fallback), fallback, props.sortMode, props.columns)
    }

    function resolveInitialPinState(): ComponentSFCTableColumnPinStateItem[] {
      const fallback = createInitialPinState(props.pinMode, props.defaultPin, props.columns)
      return normalizePinState(
        normalizePersistedPinState(readTableState('pin', fallback), fallback),
        props.columns,
        props.pinMode,
      )
    }

    function resolveInitialVisibilityState(): Record<string, boolean> {
      const fallback = createInitialTableVisibility(props.defaultHidden, props.columns)
      return normalizePersistedVisibilityState(readTableState('visibility', fallback), fallback, props.columns)
    }

    function readTableState<T>(section: string, fallback: T): T {
      if (!props.runtimeState)
        return fallback
      const key = tableStateKey.value
      if (!key) {
        warnMissingTableId()
        return fallback
      }

      return props.runtimeState.get(key, section, fallback)
    }

    function persistTableState<T>(section: string, value: T): void {
      if (!props.runtimeState)
        return
      const key = tableStateKey.value
      if (!key) {
        warnMissingTableId()
        return
      }

      props.runtimeState.set(key, section, value)
    }

    function warnMissingTableId(): void {
      if (missingTableIdWarned.value)
        return

      missingTableIdWarned.value = true
      console.warn('[SFC Table] Runtime state persistence requires stable <Table id="...">.', {
        boundaryId: props.boundaryId,
      })
    }

    function openColumnMenu(column: SFCTableColumn, columnIndex: number, event: MouseEvent): void {
      event.preventDefault()
      event.stopPropagation()

      const menu = resolveColumnMenu(column)
      if (!menu) {
        closeEndgeContextMenu(props.boundaryId)
        return
      }

      const context = createColumnActionContext(column, columnIndex)
      if (!hasExecutableMenuItem(menu, context)) {
        closeEndgeContextMenu(props.boundaryId)
        return
      }

      openEndgeContextMenu({
        ownerId: props.boundaryId,
        x: event.clientX,
        y: event.clientY,
        menu,
        context,
      })
    }

    function createColumnActionContext(
      column: SFCTableColumn,
      columnIndex: number,
    ): TableColumnActionContext {
      return {
        surface: 'table-column-header',
        runtimeId: props.runtimeState?.runtimeId ?? props.boundaryId,
        tableRuntimeId: props.runtimeState?.runtimeId ?? props.boundaryId,
        tableId: props.tableId || props.boundaryId,
        target: tableActionTarget,
        columnKey: column.key,
        columnIndex,
        hideable: true,
        pinnable: column.pinnable,
        pinMode: props.pinMode,
        pinState: getPinSide(column.key, pinState.value),
        defaultPinState: getPinSide(column.key, defaultPinState.value),
        hasPinChanges: !arePinStatesEqual(pinState.value, defaultPinState.value),
        sortable: column.sort?.sortable === true,
        sortMode: props.sortMode,
        sortState: toTableColumnSortState(getSortMeta(column.key, sortState.value)),
        activeSortCount: sortState.value.length,
      }
    }

    function hasColumnMenu(column: SFCTableColumn): boolean {
      return resolveColumnMenu(column) != null
    }

    function resolveColumnMenu(column: SFCTableColumn): ContextMenuDescriptor | null {
      if (props.columnMenu.mode === 'disabled')
        return null

      if (props.columnMenu.mode === 'inline')
        return props.columnMenu.menu

      if ((props.pinMode !== 'disabled' && column.pinnable) || column.sort?.sortable)
        return DEFAULT_TABLE_COLUMN_MENU

      return null
    }

    async function applyRuntimePatch(patch: RuntimeBoundaryPatch): Promise<boolean> {
      if (patch.kind !== 'collection-projection-update' || patch.boundaryId !== props.boundaryId)
        return false
      if (patch.itemIndex == null || patch.affectedProjections.length === 0)
        return false

      const nextBaseSource = replaceRowSnapshot(
        baseSource.value,
        patch.itemIndex,
        patch.itemSnapshot,
        props.rowKey,
      )
      baseSource.value = nextBaseSource
      const nextSource = createStyledSource(nextBaseSource)
      currentSource.value = nextSource
      await nextTick()

      const grid = resolveGridElement(gridRef.value)
      if (!grid)
        return false

      grid.source = nextSource
      await grid.refresh?.('all')
      previousSource.value = cloneRows(nextSource)
      schedulePublicSurfaceSync()
      return true
    }

    return () => vueH('div', {
      class: 'endge-native-table',
      'data-paging': props.paging,
      'data-lazy': props.lazy ? 'true' : undefined,
      style: 'display:flex;flex-direction:column;height:100%;min-height:0;width:100%;container-type:inline-size;',
    }, [
      vueH(RevoGrid as any, {
        ref: gridRef,
        part: props.styleContract.grid.attrs.part,
        'data-endge-part': props.styleContract.grid.attrs['data-endge-part'],
        class: ['endge-sfc-table-grid', props.styleContract.grid.attrs.class],
        columns: revoColumns.value,
        source: currentSource.value,
        rowClass: SFC_TABLE_ROW_CLASS_FIELD,
        rowSize: props.rowSize,
        exporting: true,
        theme: props.theme,
        resize: true,
        range: false,
        readonly: true,
        useAutofill: false,
        style: 'height:100%;min-height:0;flex:1 1 0%;',
        onAfterrender: schedulePublicSurfaceSync,
        onAfterheaderrender: schedulePublicSurfaceSync,
      }),
      props.paging === 'pages'
        ? vueH(NativeTablePagination, {
            pageIndex: pageIndex.value,
            pageSize: pageSize.value,
            pageCount: pageCount.value,
            pageSizes: props.pageSizes,
            lazy: props.lazy,
            'onUpdate:pageIndex': (value: number) => void commitPagination(value),
            'onUpdate:pageSize': (value: number) => void commitPagination(0, value),
          })
        : null,
    ])
  },
})

function collectTableColumns(
  tableNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  sortDescriptor: ReturnType<typeof normalizeComponentSFCTableSort>,
  pinDescriptor: ReturnType<typeof normalizeComponentSFCTableColumnPin>,
  styleContract: SFCTableStyleContract,
): SFCTableColumn[] {
  const columnNodes = tableNode.children
    .filter(isElementNode)
    .filter(node => node.tag === 'Column')
  const styleSurfaces = createSFCTableColumnStyleSurfaces(styleContract, columnNodes.length)

  return columnNodes.map((node, index) => {
    return createTableColumn(node, context, index, sortDescriptor, pinDescriptor, styleSurfaces[index])
  })
}

function createTableColumn(
  columnNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  index: number,
  sortDescriptor: ReturnType<typeof normalizeComponentSFCTableSort>,
  pinDescriptor: ReturnType<typeof normalizeComponentSFCTableColumnPin>,
  styleSurfaces: SFCTableColumnStyleSurfaces,
): SFCTableColumn {
  const props = evaluateSFCProps(columnNode.props, context)
  const key = normalizeColumnKey(columnNode, context, props.key, `column_${index}`)
  const sort = sortDescriptor.columns.find(column => column.key === key) ?? null
  const pin = pinDescriptor.columns.find(column => column.key === key) ?? null

  return {
    index,
    key,
    title: normalizeText(props.title ?? props.name, key),
    width: normalizeOptionalNumber(props.width ?? props.size),
    pinnable: pin?.pinnable ?? true,
    sort: sort
      ? {
          sortable: sort.sortable,
          comparator: sort.comparator,
          paths: [...sort.paths],
        }
      : null,
    cellNodes: resolveCellNodes(columnNode),
    rowDependencies: extractRowDependencies(resolveCellNodes(columnNode), key),
    styleSurfaces,
  }
}

function resolveCellNodes(columnNode: RComponentSFC_IR_ElementNode): RComponentSFC_IR_Node[] {
  const cell = columnNode.children
    .filter(isElementNode)
    .find(node => node.tag === 'Cell')

  return (cell?.children ?? columnNode.children).filter(node => !isTableMenuNode(node))
}

function normalizeColumnKey(
  columnNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  propValue: unknown,
  fallback: string,
): string {
  const evaluated = propValue ?? evaluateSFCValue(columnNode.directives.key, context)
  if (evaluated != null)
    return normalizeText(evaluated, fallback)

  const directiveKey = columnNode.directives.key
  if (directiveKey?.kind === 'expression' && directiveKey.reads.length === 0)
    return normalizeText(directiveKey.source.replace(/^['"]|['"]$/g, ''), fallback)

  return fallback
}

function createRevoColumn(
  column: SFCTableColumn,
  columnIndex: number,
  sortMeta: SFCTableSortMeta,
  pinSide: TableColumnPinSide,
  onSortClick: (event?: MouseEvent) => void,
  onMenuOpen: (event: MouseEvent) => void,
  hasMenu: boolean,
  renderCell: (h: SFCVueRenderH, cellProps: Record<string, unknown>) => ReturnType<SFCVueRenderH>,
): Record<string, unknown> {
  return {
    prop: column.key,
    name: column.title,
    __sfcColumnIndex: columnIndex,
    sortable: undefined,
    order: undefined,
    cellCompare: undefined,
    autoSize: column.width == null,
    size: column.width ?? 150,
    pin: toRevoGridPinSide(pinSide),
    columnProperties: () => toRevoGridSurfaceProps(column.styleSurfaces.headerCell.attrs),
    cellProperties: (cellProps: Record<string, unknown>) => {
      const row = cellProps.model
      if (!isPlainObject(row)) {
        return {
          part: 'cell',
          'data-endge-part': 'cell',
        }
      }

      const surfaces = getSFCTableCellStyleSurfaces(row, column.index)
      return surfaces
        ? toRevoGridSurfaceProps(surfaces.cell.attrs)
        : {
            part: 'cell',
            'data-endge-part': 'cell',
          }
    },
    columnTemplate: VGridVueTemplate(SFCRevoGridColumnHeader, {
      title: column.title,
      headerContentAttrs: column.styleSurfaces.headerContent.attrs,
      isSortable: column.sort?.sortable === true,
      sortEnabled: sortMeta.enabled,
      sortDirection: sortMeta.direction,
      sortIndex: sortMeta.index,
      onSortClick,
      onMenuOpen,
      hasMenu,
    }),
    cellTemplate: (cellH: SFCVueRenderH, cellProps: Record<string, unknown>) => renderCell(cellH, cellProps),
  }
}

const SFCRevoGridColumnHeader = defineComponent({
  name: 'SFCRevoGridColumnHeader',
  props: {
    title: {
      type: String,
      required: true,
    },
    headerContentAttrs: {
      type: Object as PropType<SFCTablePublicPartAttrs>,
      required: true,
    },
    isSortable: {
      type: Boolean,
      default: false,
    },
    sortEnabled: {
      type: Boolean,
      default: false,
    },
    sortDirection: {
      type: String as PropType<ComponentSFCTableSortDirection | undefined>,
      default: undefined,
    },
    sortIndex: {
      type: Number,
      default: undefined,
    },
    onSortClick: {
      type: Function as PropType<(event?: MouseEvent) => void>,
      default: undefined,
    },
    onMenuOpen: {
      type: Function as PropType<(event: MouseEvent) => void>,
      default: undefined,
    },
    hasMenu: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    function handleClick(event: MouseEvent): void {
      if (!props.isSortable)
        return

      event.preventDefault()
      event.stopPropagation()
      props.onSortClick?.(event)
    }

    function handleMenuOpen(event: MouseEvent): void {
      if (!props.hasMenu)
        return

      event.preventDefault()
      event.stopPropagation()
      props.onMenuOpen?.(event)
    }

    return () => vueH('div', {
      class: [
        'endge-sfc-table-header-control',
        props.isSortable ? 'endge-sfc-table-header--sortable' : '',
        props.sortEnabled ? 'endge-sfc-table-header--sorted' : '',
      ],
      role: props.isSortable ? 'button' : undefined,
      tabindex: props.isSortable ? 0 : undefined,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minWidth: 0,
        position: 'relative',
        boxSizing: 'border-box',
        cursor: props.isSortable ? 'pointer' : undefined,
        pointerEvents: 'auto',
        userSelect: 'none',
      },
      onClick: handleClick,
      onContextmenu: handleMenuOpen,
      onKeydown: (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ')
          handleClick(event as unknown as MouseEvent)
      },
    }, [
      vueH('div', {
        part: props.headerContentAttrs.part,
        'data-endge-part': props.headerContentAttrs['data-endge-part'],
        class: ['endge-sfc-table-header-content', props.headerContentAttrs.class],
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          height: '100%',
          minWidth: 0,
          position: 'relative',
          padding: props.sortEnabled ? '0 30px' : '0 8px',
          boxSizing: 'border-box',
        },
      }, [
        vueH('span', {
          style: {
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            maxWidth: '100%',
            textAlign: 'center',
            color: 'inherit',
            fontWeight: 'inherit',
          },
        }, `${props.title} \u200e`),
        props.sortEnabled && props.sortDirection
          ? vueH('span', {
              style: {
                position: 'absolute',
                right: '7px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'inline-flex',
                width: '20px',
                height: '20px',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'inherit',
                lineHeight: '1',
              },
            }, [
              renderSortDirectionIcon(props.sortDirection),
              props.sortIndex != null
                ? vueH('span', {
                    style: {
                      position: 'absolute',
                      right: '-5px',
                      top: '-4px',
                      minWidth: '13px',
                      height: '13px',
                      borderRadius: '999px',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: '600',
                      lineHeight: '13px',
                      textAlign: 'center',
                      padding: '0 3px',
                      boxSizing: 'border-box',
                    },
                  }, String(props.sortIndex + 1))
                : null,
            ])
          : null,
      ]),
    ])
  },
})

function renderSortDirectionIcon(direction: ComponentSFCTableSortDirection): ReturnType<SFCVueRenderH> {
  return vueH('svg', {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2.1,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  }, direction === 'asc'
    ? [
        vueH('path', { d: 'M12 19V5' }),
        vueH('path', { d: 'm5 12 7-7 7 7' }),
      ]
    : [
        vueH('path', { d: 'M12 5v14' }),
        vueH('path', { d: 'm19 12-7 7-7-7' }),
      ])
}

function getSortMeta(columnKey: string, sortState: ComponentSFCTableSortStateItem[]): SFCTableSortMeta {
  const index = sortState.findIndex(item => item.key === columnKey)
  if (index < 0)
    return { enabled: false }

  return {
    enabled: true,
    direction: sortState[index].direction,
    index,
  }
}

function toTableColumnSortState(meta: SFCTableSortMeta): TableColumnSortState {
  return {
    active: meta.enabled,
    direction: meta.direction,
    index: meta.index,
  }
}

function getPinSide(
  columnKey: string,
  pinState: ComponentSFCTableColumnPinStateItem[],
): TableColumnPinSide {
  return pinState.find(item => item.key === columnKey)?.side ?? 'none'
}

function toRevoGridPinSide(side: TableColumnPinSide): 'colPinStart' | 'colPinEnd' | undefined {
  if (side === 'left')
    return 'colPinStart'
  if (side === 'right')
    return 'colPinEnd'
  return undefined
}

function hasExecutableMenuItem(
  menu: ContextMenuDescriptor,
  context: TableColumnActionContext,
): boolean {
  return menu.items.some(item => item.kind === 'item' && Endge.runtime.actions.canExecute(item.action, context))
}

function createInitialSortState(
  sortMode: ComponentSFCTableSortMode,
  defaultSort: ComponentSFCTableSortStateItem[],
  columns: SFCTableColumn[],
): ComponentSFCTableSortStateItem[] {
  if (sortMode === 'disabled')
    return []

  const sortableKeys = new Set(columns.filter(column => column.sort != null).map(column => column.key))
  const normalized = defaultSort.filter(item => sortableKeys.has(item.key))

  return sortMode === 'single' ? normalized.slice(0, 1) : normalized
}

function normalizePersistedSortState(
  value: unknown,
  fallback: ComponentSFCTableSortStateItem[],
  sortMode: ComponentSFCTableSortMode,
  columns: SFCTableColumn[],
): ComponentSFCTableSortStateItem[] {
  if (!Array.isArray(value))
    return fallback

  const items: ComponentSFCTableSortStateItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object')
      continue

    const key = normalizeText((item as ComponentSFCTableSortStateItem).key, '')
    const direction = (item as ComponentSFCTableSortStateItem).direction
    if (!key || (direction !== 'asc' && direction !== 'desc'))
      continue

    items.push({ key, direction })
  }

  return createInitialSortState(sortMode, items, columns)
}

function createInitialPinState(
  pinMode: ComponentSFCTableColumnPinMode,
  defaultPin: ComponentSFCTableColumnPinStateItem[],
  columns: SFCTableColumn[],
): ComponentSFCTableColumnPinStateItem[] {
  return normalizePinState(defaultPin, columns, pinMode)
}

function normalizePinState(
  current: ComponentSFCTableColumnPinStateItem[],
  columns: SFCTableColumn[],
  pinMode: ComponentSFCTableColumnPinMode,
): ComponentSFCTableColumnPinStateItem[] {
  if (pinMode === 'disabled')
    return []

  const columnKeys = new Set(columns.map(column => column.key))
  const seenKeys = new Set<string>()
  const result: ComponentSFCTableColumnPinStateItem[] = []

  for (const item of current) {
    if (!columnKeys.has(item.key) || seenKeys.has(item.key))
      continue
    if (item.side !== 'left' && item.side !== 'right')
      continue

    seenKeys.add(item.key)
    result.push({
      key: item.key,
      side: item.side,
    })
  }

  return result
}

function normalizePersistedPinState(
  value: unknown,
  fallback: ComponentSFCTableColumnPinStateItem[],
): ComponentSFCTableColumnPinStateItem[] {
  if (!Array.isArray(value))
    return fallback

  const items: ComponentSFCTableColumnPinStateItem[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object')
      continue

    const key = normalizeText((item as ComponentSFCTableColumnPinStateItem).key, '')
    const side = (item as ComponentSFCTableColumnPinStateItem).side
    if (!key || (side !== 'left' && side !== 'right'))
      continue

    items.push({ key, side })
  }

  return items
}

export function createInitialTableVisibility<T extends { key: string }>(
  defaultHidden: readonly string[],
  columns: readonly T[],
): Record<string, boolean> {
  const columnKeys = new Set(columns.map(column => column.key))
  return Object.fromEntries(
    defaultHidden
      .filter(key => columnKeys.has(key))
      .map(key => [key, false]),
  )
}

export function filterVisibleTableColumns<T extends { key: string }>(
  columns: readonly T[],
  visibility: Readonly<Record<string, boolean>>,
): T[] {
  return columns.filter(column => visibility[column.key] !== false)
}

function normalizePersistedVisibilityState<T extends { key: string }>(
  value: unknown,
  fallback: Record<string, boolean>,
  columns: readonly T[],
): Record<string, boolean> {
  if (!isPlainObject(value))
    return fallback

  const columnKeys = new Set(columns.map(column => column.key))
  const result: Record<string, boolean> = {}
  for (const [key, visible] of Object.entries(value)) {
    if (columnKeys.has(key) && typeof visible === 'boolean')
      result[key] = visible
  }

  return result
}

function setColumnPinState(
  current: ComponentSFCTableColumnPinStateItem[],
  columnKey: string,
  side: TableColumnPinSide,
  pinMode: ComponentSFCTableColumnPinMode,
  columns: SFCTableColumn[],
): ComponentSFCTableColumnPinStateItem[] {
  if (pinMode === 'disabled')
    return current

  const column = columns.find(item => item.key === columnKey)
  if (!column?.pinnable)
    return current

  const next = current.filter(item => item.key !== columnKey)
  if (side === 'none')
    return next

  return normalizePinState([...next, { key: columnKey, side }], columns, pinMode)
}

function resetColumnPinState(
  current: ComponentSFCTableColumnPinStateItem[],
  columnKey: string,
  defaultPin: ComponentSFCTableColumnPinStateItem[],
): ComponentSFCTableColumnPinStateItem[] {
  const next = current.filter(item => item.key !== columnKey)
  const defaultItem = defaultPin.find(item => item.key === columnKey)
  return defaultItem ? [...next, { ...defaultItem }] : next
}

function arePinStatesEqual(
  left: ComponentSFCTableColumnPinStateItem[],
  right: ComponentSFCTableColumnPinStateItem[],
): boolean {
  return createPinStateSignature(left) === createPinStateSignature(right)
}

function createPinStateSignature(pinState: ComponentSFCTableColumnPinStateItem[]): string {
  return [...pinState]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map(item => `${item.key}:${item.side}`)
    .join(',')
}

function toggleSortState(
  current: ComponentSFCTableSortStateItem[],
  columnKey: string,
  sortMode: ComponentSFCTableSortMode,
): ComponentSFCTableSortStateItem[] {
  if (sortMode === 'disabled' || sortMode === 'fixed')
    return current

  const existingIndex = current.findIndex(item => item.key === columnKey)
  const existing = existingIndex >= 0 ? current[existingIndex] : null
  const nextDirection: ComponentSFCTableSortDirection | null = !existing
    ? 'asc'
    : existing.direction === 'asc' ? 'desc' : null

  if (sortMode === 'single')
    return nextDirection ? [{ key: columnKey, direction: nextDirection }] : []

  if (nextDirection == null)
    return current.filter(item => item.key !== columnKey)

  if (existingIndex >= 0) {
    return current.map(item => item.key === columnKey
      ? { ...item, direction: nextDirection }
      : item)
  }

  return [...current, { key: columnKey, direction: nextDirection }]
}

function setColumnSortState(
  current: ComponentSFCTableSortStateItem[],
  columnKey: string,
  direction: TableSortDirection,
  sortMode: ComponentSFCTableSortMode,
  columns: SFCTableColumn[],
): ComponentSFCTableSortStateItem[] {
  if (sortMode === 'disabled' || sortMode === 'fixed')
    return current

  const column = columns.find(item => item.key === columnKey)
  if (!column?.sort?.sortable)
    return current

  const nextItem: ComponentSFCTableSortStateItem = {
    key: columnKey,
    direction,
  }

  if (sortMode === 'single')
    return [nextItem]

  const existingIndex = current.findIndex(item => item.key === columnKey)
  if (existingIndex < 0)
    return [...current, nextItem]

  return current.map(item => item.key === columnKey ? nextItem : item)
}

function applyTableSort(
  rows: Record<string, unknown>[],
  columns: SFCTableColumn[],
  sortState: ComponentSFCTableSortStateItem[],
  sortMode: ComponentSFCTableSortMode,
): Record<string, unknown>[] {
  if (sortMode === 'disabled' || sortState.length === 0)
    return cloneRows(rows)

  const columnsByKey = new Map(columns.map(column => [column.key, column]))
  const rules = sortState
    .map(item => {
      const column = columnsByKey.get(item.key)
      return column?.sort
        ? { ...item, sort: column.sort }
        : null
    })
    .filter((item): item is ComponentSFCTableSortStateItem & { sort: SFCTableColumnSort } => item != null)

  if (rules.length === 0)
    return cloneRows(rows)

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const rule of rules) {
        const result = compareRows(a.row, b.row, rule.sort)
        if (result !== 0)
          return rule.direction === 'desc' ? -result : result
      }

      return a.index - b.index
    })
    .map(item => item.row)
}

function compareRows(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
  sort: SFCTableColumnSort,
): number {
  for (const path of sort.paths) {
    const result = compareValues(readRowPath(left, path), readRowPath(right, path), sort.comparator)
    if (result !== 0)
      return result
  }

  return 0
}

function compareValues(
  left: unknown,
  right: unknown,
  comparator: ComponentSFCTableSortComparator,
): number {
  const empty = compareEmpty(left, right)
  if (empty != null)
    return empty

  if (comparator === 'number')
    return compareNumbers(left, right)
  if (comparator === 'date')
    return compareDates(left, right)
  if (comparator === 'time')
    return compareTimes(left, right)
  if (comparator === 'boolean')
    return compareBooleans(left, right)
  if (comparator === 'text')
    return compareText(left, right)

  return compareNatural(left, right)
}

function compareEmpty(left: unknown, right: unknown): number | null {
  const leftEmpty = left == null || left === ''
  const rightEmpty = right == null || right === ''
  if (leftEmpty && rightEmpty)
    return 0
  if (leftEmpty)
    return 1
  if (rightEmpty)
    return -1
  return null
}

function compareNatural(left: unknown, right: unknown): number {
  return naturalCollator.compare(String(left), String(right))
}

function compareText(left: unknown, right: unknown): number {
  return textCollator.compare(String(left), String(right))
}

function compareNumbers(left: unknown, right: unknown): number {
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) && !Number.isFinite(b))
    return compareNatural(left, right)
  if (!Number.isFinite(a))
    return 1
  if (!Number.isFinite(b))
    return -1
  return a - b
}

function compareDates(left: unknown, right: unknown): number {
  return compareTimestamps(parseDateTimestamp(left), parseDateTimestamp(right), left, right)
}

function compareTimes(left: unknown, right: unknown): number {
  return compareTimestamps(parseTimeTimestamp(left), parseTimeTimestamp(right), left, right)
}

function compareTimestamps(
  left: number,
  right: number,
  rawLeft: unknown,
  rawRight: unknown,
): number {
  if (!Number.isFinite(left) && !Number.isFinite(right))
    return compareNatural(rawLeft, rawRight)
  if (!Number.isFinite(left))
    return 1
  if (!Number.isFinite(right))
    return -1
  return left - right
}

function compareBooleans(left: unknown, right: unknown): number {
  return Number(Boolean(left)) - Number(Boolean(right))
}

function parseDateTimestamp(value: unknown): number {
  if (value instanceof Date)
    return value.getTime()
  return Date.parse(String(value))
}

function parseTimeTimestamp(value: unknown): number {
  if (value instanceof Date)
    return value.getHours() * 60 + value.getMinutes()

  const source = String(value ?? '').trim()
  const timeMatch = source.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (timeMatch) {
    const hours = Number(timeMatch[1])
    const minutes = Number(timeMatch[2])
    const seconds = Number(timeMatch[3] ?? 0)
    if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds))
      return hours * 3600 + minutes * 60 + seconds
  }

  const parsed = Date.parse(source)
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed)
    return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
  }

  return Number.NaN
}

function readRowPath(row: Record<string, unknown>, path: string): unknown {
  const segments = String(path ?? '').split('.').map(part => part.trim()).filter(Boolean)
  if (segments.length === 0)
    return undefined

  return segments.reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== 'object')
      return undefined
    return (current as Record<string, unknown>)[segment]
  }, row)
}

function renderTableCell(input: SFCTableCellRenderInput & {
  fallbackH: SFCVueRenderH
  context: SFCVueRenderContext
  cellAlignmentStyle: SFCTableCellAlignmentStyle
}): ReturnType<SFCVueRenderH> {
  const h = input.h ?? input.fallbackH
  const localRowIndex = normalizeNumber(input.cellProps.rowIndex, 0)
  const rowIndex = input.rowOffset + localRowIndex
  const row = normalizeCellRow(input.rows, input.cellProps, localRowIndex)
  const cellContext = extendSFCVueRenderContext(input.context, {
    row,
    rowIndex,
    value: row[input.column.key],
  }, input.context.iteration, `${input.context.consumerScope}/row:${rowIndex}/column:${input.column.key}`)
  const children = renderSFCNodes(h, input.column.cellNodes, cellContext)
  const styleSurfaces = getSFCTableCellStyleSurfaces(row, input.column.index)
  const contentAttrs = styleSurfaces?.cellContent.attrs

  return h('div', {
    part: contentAttrs?.part ?? 'cell-content',
    'data-endge-part': contentAttrs?.['data-endge-part'] ?? 'cell-content',
    class: ['endge-sfc-table-cell-content', contentAttrs?.class],
    style: {
      display: 'flex',
      ...input.cellAlignmentStyle,
      width: '100%',
      height: '100%',
      minWidth: 0,
    },
  }, children)
}

function createCellAlignmentStyle(alignment: SFCTableCellAlignment): SFCTableCellAlignmentStyle {
  return {
    alignItems: mapVerticalCellAlignment(alignment.vertical),
    justifyContent: mapHorizontalCellAlignment(alignment.horizontal),
  }
}

function mapHorizontalCellAlignment(value: SFCTableCellAlign): 'flex-start' | 'center' | 'flex-end' {
  if (value === 'center')
    return 'center'
  return value === 'right' ? 'flex-end' : 'flex-start'
}

function mapVerticalCellAlignment(value: SFCTableCellVerticalAlign): 'flex-start' | 'center' | 'flex-end' {
  if (value === 'middle')
    return 'center'
  return value === 'bottom' ? 'flex-end' : 'flex-start'
}

async function updateGridCells(input: {
  grid: SFCRevoGridElement | null
  previousRows: Record<string, unknown>[]
  nextRows: Record<string, unknown>[]
  previousColumnsSignature: string
  nextColumns: SFCTableColumn[]
  rowKey: string
}): Promise<void> {
  if (!input.grid)
    return

  input.grid.source = input.nextRows

  const nextColumnsSignature = createColumnsSignature(input.nextColumns)
  if (input.previousColumnsSignature !== nextColumnsSignature) {
    await input.grid.refresh?.('all')
    return
  }

  const changedRows = collectChangedRows(input.previousRows, input.nextRows, input.rowKey)
  if (!changedRows) {
    await input.grid.refresh?.('all')
    return
  }

  let updatedCells = 0
  for (const [rowIndex, changedFields] of changedRows.entries()) {
    for (let colIndex = 0; colIndex < input.nextColumns.length; colIndex++) {
      const column = input.nextColumns[colIndex]
      if (!shouldUpdateColumn(column, changedFields))
        continue

      updatedCells++
      await input.grid.setDataAt?.({
        row: rowIndex,
        col: colIndex,
        rowType: 'rgRow',
        colType: 'rgCol',
        val: input.nextRows[rowIndex]?.[column.key],
        skipDataUpdate: true,
      })
    }
  }

  if (updatedCells === 0 && changedRows.size > 0)
    await input.grid.refresh?.('all')
}

function collectChangedRows(
  previousRows: Record<string, unknown>[],
  nextRows: Record<string, unknown>[],
  rowKey: string,
): Map<number, Set<string>> | null {
  if (previousRows.length !== nextRows.length)
    return null

  const result = new Map<number, Set<string>>()
  for (let index = 0; index < nextRows.length; index++) {
    const previousRow = previousRows[index]
    const nextRow = nextRows[index]

    if (String(previousRow?.[rowKey] ?? index) !== String(nextRow?.[rowKey] ?? index))
      return null

    const changedFields = collectChangedFields(previousRow, nextRow)
    if (changedFields.size > 0)
      result.set(index, changedFields)
  }

  return result
}

function collectChangedFields(
  previousRow: Record<string, unknown>,
  nextRow: Record<string, unknown>,
): Set<string> {
  const keys = new Set([...Object.keys(previousRow), ...Object.keys(nextRow)])
  const result = new Set<string>()

  for (const key of keys) {
    if (!Object.is(previousRow[key], nextRow[key]))
      result.add(key)
  }

  return result
}

function shouldUpdateColumn(column: SFCTableColumn, changedFields: Set<string>): boolean {
  if (column.rowDependencies.size === 0)
    return changedFields.has(column.key)

  for (const dependency of column.rowDependencies) {
    if (changedFields.has(dependency))
      return true
  }

  return false
}

function extractRowDependencies(nodes: RComponentSFC_IR_Node[], columnKey: string): Set<string> {
  const result = new Set<string>()

  for (const node of nodes)
    collectRowDependencies(node, result, columnKey)

  return result
}

function collectRowDependencies(
  node: RComponentSFC_IR_Node,
  result: Set<string>,
  columnKey: string,
): void {
  if (node.kind === 'expression') {
    if (node.value.kind === 'expression')
      collectRowDependenciesFromSource(node.value.source, result, columnKey)
    return
  }

  if (node.kind !== 'element')
    return

  for (const value of Object.values(node.props)) {
    if (value.kind === 'expression')
      collectRowDependenciesFromSource(value.source, result, columnKey)
  }

  for (const value of [
    node.directives.if,
    node.directives.elseIf,
    node.directives.key,
    node.directives.for?.source,
  ]) {
    if (value?.kind === 'expression')
      collectRowDependenciesFromSource(value.source, result, columnKey)
  }

  for (const child of node.children)
    collectRowDependencies(child, result, columnKey)
}

function collectRowDependenciesFromSource(source: string, result: Set<string>, columnKey: string): void {
  const rowFieldPattern = /\brow\.([A-Za-z_$][\w$]*)/g
  let match: RegExpExecArray | null

  while ((match = rowFieldPattern.exec(source)))
    result.add(match[1])

  if (/\bvalue\b/.test(source))
    result.add(columnKey)
}

function createColumnsSignature(columns: SFCTableColumn[]): string {
  return columns
    .map(column => `${column.key}:${column.title}:${column.width ?? ''}:${column.pinnable}:${column.sort?.sortable ?? false}:${column.sort?.comparator ?? ''}:${column.sort?.paths.join(',') ?? ''}`)
    .join('|')
}

function createTableSortSignature(
  sortMode: ComponentSFCTableSortMode,
  defaultSort: ComponentSFCTableSortStateItem[],
  columns: SFCTableColumn[],
): string {
  return [
    sortMode,
    defaultSort.map(item => `${item.key}:${item.direction}`).join(','),
    createColumnsSignature(columns),
  ].join('|')
}

function createTablePinSignature(
  pinMode: ComponentSFCTableColumnPinMode,
  defaultPin: ComponentSFCTableColumnPinStateItem[],
  columns: SFCTableColumn[],
): string {
  return [
    pinMode,
    createPinStateSignature(defaultPin),
    createColumnsSignature(columns),
  ].join('|')
}

function createTableVisibilitySignature(
  defaultHidden: readonly string[],
  columns: SFCTableColumn[],
): string {
  return [defaultHidden.join(','), createColumnsSignature(columns)].join('|')
}

function resolveGridElement(value: { $el?: SFCRevoGridElement } | SFCRevoGridElement | null): SFCRevoGridElement | null {
  if (!value)
    return null

  if ('$el' in value && value.$el)
    return value.$el

  if (isRevoGridElement(value))
    return value

  return null
}

function resolveGridHTMLElement(
  value: { $el?: SFCRevoGridElement } | SFCRevoGridElement | null,
): HTMLElement | null {
  const element = value && '$el' in value && value.$el ? value.$el : value
  return typeof HTMLElement !== 'undefined' && element instanceof HTMLElement
    ? element
    : null
}

function isRevoGridElement(value: unknown): value is SFCRevoGridElement {
  return isPlainObject(value)
    && (
      'refresh' in value
      || 'setDataAt' in value
      || 'source' in value
    )
}

function normalizeRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value))
    return []

  return value.map((item) => {
    return isPlainObject(item)
      ? item
      : { value: item }
  })
}

function cloneRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  // Rows enter the table as normalized immutable snapshots. Copying the
  // collection is sufficient and avoids duplicating every 10k-row snapshot at
  // each base/current/previous transition.
  return [...rows]
}

function replaceRowSnapshot(
  rows: Record<string, unknown>[],
  rowIndex: number,
  nextRow: unknown,
  rowKey: string,
): Record<string, unknown>[] {
  if (!isPlainObject(nextRow))
    return rows

  const result = cloneRows(rows)
  const normalized = normalizeRowSnapshot(nextRow, rowKey)
  const nextRowId = normalized[rowKey]
  const targetIndex = nextRowId == null
    ? rowIndex
    : result.findIndex(row => Object.is(row[rowKey], nextRowId))
  result[targetIndex >= 0 ? targetIndex : rowIndex] = normalized
  return result
}

function normalizeRowSnapshot(row: Record<string, unknown>, rowKey: string): Record<string, unknown> {
  return {
    ...row,
    rowId: row[rowKey] == null ? String(row.__index ?? '') : String(row[rowKey]),
  }
}

function normalizeCellRow(
  rows: Record<string, unknown>[],
  cellProps: Record<string, unknown>,
  rowIndex: number,
): Record<string, unknown> {
  const row = rows[rowIndex] ?? cellProps.model ?? cellProps.row
  return isPlainObject(row) ? row : {}
}

function normalizeText(value: unknown, fallback: string): string {
  const source = String(value ?? '').trim()
  return source || fallback
}

function normalizeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Math.floor(Number(value))
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  const numeric = Math.floor(Number(value))
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback
}

function normalizeTablePaging(value: unknown): SFCTablePaging {
  return String(value ?? '').trim().toLowerCase() === 'virtual' ? 'virtual' : 'pages'
}

function normalizePageSizes(value: unknown): number[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [10, 25, 50, 100]
  const sizes = source
    .map(size => normalizePositiveInteger(size, 0))
    .filter(size => size > 0)
  return [...new Set(sizes)].sort((left, right) => left - right)
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value == null || value === '')
    return null

  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeCssSize(value: unknown, fallback: string): string {
  if (value == null || value === '')
    return fallback

  if (typeof value === 'number')
    return `${value}px`

  const source = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(source))
    return `${Number(source)}px`

  return source
}

function isElementNode(node: RComponentSFC_IR_Node): node is RComponentSFC_IR_ElementNode {
  return node.kind === 'element'
}

function isTableMenuNode(node: RComponentSFC_IR_Node): boolean {
  return isElementNode(node)
    && (
      node.tag === 'ColumnMenu'
      || node.tag === 'MenuItem'
      || node.tag === 'MenuSeparator'
    )
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
