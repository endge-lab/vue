import RevoGrid, { VGridVueTemplate } from '@revolist/vue3-datagrid'
import type {
  ComponentSFCTableColumnMenuDescriptor,
  ComponentSFCTableSortComparator,
  ComponentSFCTableSortDirection,
  ComponentSFCTableSortMode,
  ComponentSFCTableSortStateItem,
  ContextMenuDescriptor,
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Node,
  RuntimeBoundaryPatch,
  TableColumnCommandContext,
  TableColumnSortState,
  TableRuntimeCommandTarget,
  TableSortDirection,
} from '@endge/core'
import {
  Endge,
  normalizeComponentSFCTableColumnMenu,
  normalizeComponentSFCTableSort,
  normalizeComponentSFCTableSortMode,
  TABLE_RUNTIME_COMMAND_IDS,
} from '@endge/core'
import type { PropType } from 'vue'
import { computed, defineComponent, h as vueH, inject, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'

import type {
  SFCVueRenderContext,
  SFCVueRenderFunction,
  SFCVueRenderH,
} from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCProps, evaluateSFCValue } from '@/ui/render/sfc/SFCRender_Evaluator'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'
import { SFCVueBoundaryRegistryKey } from '@/ui/render/sfc/SFCRender_BoundaryRegistry'
import { closeEndgeContextMenu, openEndgeContextMenu } from '@/ui/overlay/context-menu-manager'

interface SFCTableColumn {
  key: string
  title: string
  width: number | null
  sort: SFCTableColumnSort | null
  cellNodes: RComponentSFC_IR_Node[]
  rowDependencies: Set<string>
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
}

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
      id: TABLE_RUNTIME_COMMAND_IDS.sortSetColumnAsc,
      label: 'Сортировать по возрастанию',
      command: TABLE_RUNTIME_COMMAND_IDS.sortSetColumnAsc,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_COMMAND_IDS.sortSetColumnDesc,
      label: 'Сортировать по убыванию',
      command: TABLE_RUNTIME_COMMAND_IDS.sortSetColumnDesc,
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_COMMAND_IDS.sortClearColumn,
      label: 'Сбросить сортировку колонки',
      command: TABLE_RUNTIME_COMMAND_IDS.sortClearColumn,
    },
    {
      kind: 'separator',
      id: 'sort-separator',
    },
    {
      kind: 'item',
      id: TABLE_RUNTIME_COMMAND_IDS.sortClearAll,
      label: 'Сбросить все сортировки',
      command: TABLE_RUNTIME_COMMAND_IDS.sortClearAll,
    },
  ],
}

/** Рендерит SFC Table primitive через RevoGrid, не раскрывая RevoGrid в SFC-синтаксис. */
export const SFCRender_Table: SFCVueRenderFunction = SFCRender_Base((input) => {
  const rows = normalizeRows(input.props.rows)
  const rowKey = normalizeText(input.props['row-key'] ?? input.props.rowKey, 'id')
  const sortDescriptor = normalizeComponentSFCTableSort(input.node)
  const columnMenuDescriptor = normalizeComponentSFCTableColumnMenu(input.node)
  const columns = collectTableColumns(input.node, input.context, sortDescriptor)
  const source = rows.map(row => normalizeRowSnapshot(row, rowKey))
  const sortMode = normalizeComponentSFCTableSortMode(input.props['sort-mode'] ?? input.props.sortMode ?? sortDescriptor.mode)

  return input.h('div', {
    ...input.attrs,
    class: ['endge-sfc-table', input.props.class],
    style: {
      ...(isPlainObject(input.attrs.style) ? input.attrs.style : {}),
      width: normalizeCssSize(input.props.width ?? input.props.w, '100%'),
      height: normalizeCssSize(input.props.height ?? input.props.h, '360px'),
      minHeight: '180px',
    },
  }, [
    input.h(SFCRevoGridTable as any, {
      boundaryId: input.node.id,
      columns,
      source,
      rowKey,
      sortMode,
      columnMenu: columnMenuDescriptor,
      defaultSort: sortDescriptor.defaultSort,
      rowSize: normalizeNumber(input.props.rowSize, 40),
      theme: normalizeText(input.props.theme, 'compact'),
      renderVersion: input.context.renderVersion,
      renderCell: (cellInput: SFCTableCellRenderInput) => {
        return renderTableCell({
          ...cellInput,
          fallbackH: input.h,
          context: input.context,
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
    columns: {
      type: Array as PropType<SFCTableColumn[]>,
      required: true,
    },
    source: {
      type: Array as PropType<Record<string, unknown>[]>,
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
    columnMenu: {
      type: Object as PropType<ComponentSFCTableColumnMenuDescriptor>,
      required: true,
    },
    defaultSort: {
      type: Array as PropType<ComponentSFCTableSortStateItem[]>,
      required: true,
    },
    rowSize: {
      type: Number,
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
    const sortState = shallowRef(createInitialSortState(props.sortMode, props.defaultSort, props.columns))
    const currentSource = shallowRef(applyTableSort(baseSource.value, props.columns, sortState.value, props.sortMode))
    const previousSource = shallowRef(cloneRows(currentSource.value))
    const previousColumnsSignature = shallowRef(createColumnsSignature(props.columns))
    const previousSortSignature = shallowRef(createTableSortSignature(props.sortMode, props.defaultSort, props.columns))
    const tableCommandTarget: TableRuntimeCommandTarget = {
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

    const revoColumns = computed(() => props.columns.map((column, columnIndex) => {
      return createRevoColumn(
        column,
        columnIndex,
        getSortMeta(column.key, sortState.value),
        (event?: MouseEvent) => toggleColumnSort(column, event),
        (event: MouseEvent) => openColumnMenu(column, columnIndex, event),
        hasColumnMenu(column),
        (h, cellProps) => {
          return props.renderCell({
            h,
            column,
            cellProps,
            rows: currentSource.value,
          })
        },
      )
    }))

    const unregisterBoundary = boundaryRegistry?.register(props.boundaryId, {
      applyPatch: applyRuntimePatch,
    })

    onBeforeUnmount(() => {
      closeEndgeContextMenu(props.boundaryId)
      unregisterBoundary?.()
    })

    watch(
      () => [props.renderVersion, props.source, props.columns, props.sortMode, props.defaultSort] as const,
      async () => {
        const nextBaseSource = cloneRows(props.source)
        const nextSortSignature = createTableSortSignature(props.sortMode, props.defaultSort, props.columns)
        if (previousSortSignature.value !== nextSortSignature) {
          sortState.value = createInitialSortState(props.sortMode, props.defaultSort, props.columns)
          previousSortSignature.value = nextSortSignature
        }

        baseSource.value = nextBaseSource
        const nextSource = applyTableSort(nextBaseSource, props.columns, sortState.value, props.sortMode)
        currentSource.value = nextSource
        await nextTick()
        await updateGridCells({
          grid: resolveGridElement(gridRef.value),
          previousRows: previousSource.value,
          nextRows: nextSource,
          previousColumnsSignature: previousColumnsSignature.value,
          nextColumns: props.columns,
          rowKey: props.rowKey,
        })
        previousSource.value = cloneRows(nextSource)
        previousColumnsSignature.value = createColumnsSignature(props.columns)
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
      const nextSource = applyTableSort(baseSource.value, props.columns, sortState.value, props.sortMode)
      currentSource.value = nextSource
      previousSource.value = cloneRows(nextSource)

      await nextTick()
      const grid = resolveGridElement(gridRef.value)
      if (grid) {
        grid.source = nextSource
        await grid.refresh?.('all')
      }
    }

    function openColumnMenu(column: SFCTableColumn, columnIndex: number, event: MouseEvent): void {
      event.preventDefault()
      event.stopPropagation()

      const menu = resolveColumnMenu(column)
      if (!menu) {
        closeEndgeContextMenu(props.boundaryId)
        return
      }

      const context = createColumnCommandContext(column, columnIndex)
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

    function createColumnCommandContext(
      column: SFCTableColumn,
      columnIndex: number,
    ): TableColumnCommandContext {
      return {
        surface: 'table-column-header',
        runtimeId: props.boundaryId,
        tableRuntimeId: props.boundaryId,
        tableId: props.boundaryId,
        target: tableCommandTarget,
        columnKey: column.key,
        columnIndex,
        pinState: 'none',
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

      if (column.sort?.sortable)
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
      const nextSource = applyTableSort(nextBaseSource, props.columns, sortState.value, props.sortMode)
      currentSource.value = nextSource
      await nextTick()

      const grid = resolveGridElement(gridRef.value)
      if (!grid)
        return false

      grid.source = nextSource

      if (sortState.value.length > 0) {
        await grid.refresh?.('all')
        previousSource.value = cloneRows(nextSource)
        return true
      }

      for (const projection of patch.affectedProjections) {
        await grid.setDataAt?.({
          row: patch.itemIndex,
          col: projection.index,
          rowType: 'rgRow',
          colType: 'rgCol',
          val: nextSource[patch.itemIndex]?.[projection.key],
          skipDataUpdate: true,
        })
      }

      previousSource.value = cloneRows(nextSource)
      return true
    }

    return () => vueH(RevoGrid as any, {
      ref: gridRef,
      columns: revoColumns.value,
      source: currentSource.value,
      rowSize: props.rowSize,
      exporting: true,
      theme: props.theme,
      resize: true,
      range: false,
      readonly: true,
      useAutofill: false,
      style: 'height: 100%',
    })
  },
})

function collectTableColumns(
  tableNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  sortDescriptor: ReturnType<typeof normalizeComponentSFCTableSort>,
): SFCTableColumn[] {
  return tableNode.children
    .filter(isElementNode)
    .filter(node => node.tag === 'Column')
    .map((node, index) => createTableColumn(node, context, index, sortDescriptor))
}

function createTableColumn(
  columnNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  index: number,
  sortDescriptor: ReturnType<typeof normalizeComponentSFCTableSort>,
): SFCTableColumn {
  const props = evaluateSFCProps(columnNode.props, context)
  const key = normalizeColumnKey(columnNode, context, props.key, `column_${index}`)
  const sort = sortDescriptor.columns.find(column => column.key === key) ?? null

  return {
    key,
    title: normalizeText(props.title ?? props.name, key),
    width: normalizeOptionalNumber(props.width ?? props.size),
    sort: sort
      ? {
          sortable: sort.sortable,
          comparator: sort.comparator,
          paths: [...sort.paths],
        }
      : null,
    cellNodes: resolveCellNodes(columnNode),
    rowDependencies: extractRowDependencies(resolveCellNodes(columnNode), key),
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
    columnTemplate: VGridVueTemplate(SFCRevoGridColumnHeader, {
      title: column.title,
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
        'endge-sfc-table-header',
        props.isSortable ? 'endge-sfc-table-header--sortable' : '',
        props.sortEnabled ? 'endge-sfc-table-header--sorted' : '',
      ],
      role: props.isSortable ? 'button' : undefined,
      tabindex: props.isSortable ? 0 : undefined,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '6px',
        width: '100%',
        height: '100%',
        minWidth: 0,
        position: 'relative',
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
      vueH('span', {
        style: {
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        },
      }, `${props.title} \u200e`),
      props.sortEnabled && props.sortDirection
        ? vueH('span', {
            style: {
              marginLeft: 'auto',
              fontSize: '11px',
              lineHeight: '1',
              opacity: '0.72',
            },
          }, `${props.sortDirection.toUpperCase()}${props.sortIndex != null ? props.sortIndex + 1 : ''}`)
        : null,
      props.hasMenu
        ? vueH('button', {
            type: 'button',
            'aria-label': 'Открыть меню колонки',
            style: {
              display: 'inline-flex',
              flex: '0 0 22px',
              width: '22px',
              height: '22px',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              borderRadius: '4px',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              font: 'inherit',
              lineHeight: '1',
              padding: 0,
              opacity: '0.72',
            },
            onClick: handleMenuOpen,
            onContextmenu: handleMenuOpen,
          }, '⋮')
        : null,
    ])
  },
})

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

function hasExecutableMenuItem(
  menu: ContextMenuDescriptor,
  context: TableColumnCommandContext,
): boolean {
  return menu.items.some(item => item.kind === 'item' && Endge.commands.canExecute(item.command, context))
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
    .map((row, index) => ({ row: { ...row }, index }))
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
}): ReturnType<SFCVueRenderH> {
  const h = input.h ?? input.fallbackH
  const rowIndex = normalizeNumber(input.cellProps.rowIndex, 0)
  const row = normalizeCellRow(input.rows, input.cellProps, rowIndex)
  const cellContext = extendSFCVueRenderContext(input.context, {
    row,
    rowIndex,
    value: row[input.column.key],
  })
  const children = renderSFCNodes(h, input.column.cellNodes, cellContext)

  return h('div', {
    class: 'endge-sfc-table-cell',
    style: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      minWidth: 0,
    },
  }, children)
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
    .map(column => `${column.key}:${column.title}:${column.width ?? ''}:${column.sort?.sortable ?? false}:${column.sort?.comparator ?? ''}:${column.sort?.paths.join(',') ?? ''}`)
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

function resolveGridElement(value: { $el?: SFCRevoGridElement } | SFCRevoGridElement | null): SFCRevoGridElement | null {
  if (!value)
    return null

  if ('$el' in value && value.$el)
    return value.$el

  if (isRevoGridElement(value))
    return value

  return null
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
      ? { ...item }
      : { value: item }
  })
}

function cloneRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => ({ ...row }))
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
