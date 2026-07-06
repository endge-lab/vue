import RevoGrid from '@revolist/vue3-datagrid'
import type { RComponentSFC_IR_ElementNode, RComponentSFC_IR_Node } from '@endge/core'

import type {
  SFCVueRenderContext,
  SFCVueRenderFunction,
  SFCVueRenderH,
} from '@/domain/types/sfc-render.type'
import { SFCRender_Base } from '@/ui/render/sfc/SFCRender_Base'
import { extendSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCProps } from '@/ui/render/sfc/SFCRender_Evaluator'
import { renderSFCNodes } from '@/ui/render/sfc/SFCRender_Node'

interface SFCTableColumn {
  key: string
  title: string
  width: number | null
  cellNodes: RComponentSFC_IR_Node[]
}

/** Рендерит SFC Table primitive через RevoGrid, не раскрывая RevoGrid в SFC-синтаксис. */
export const SFCRender_Table: SFCVueRenderFunction = SFCRender_Base((input) => {
  const rows = normalizeRows(input.props.rows)
  const rowKey = normalizeText(input.props['row-key'] ?? input.props.rowKey, 'id')
  const columns = collectTableColumns(input.node, input.context)

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
    input.h(RevoGrid as any, {
      columns: columns.map(column => createRevoColumn(input.h, column, rows, input.context)),
      source: rows.map(row => normalizeRowSnapshot(row, rowKey)),
      rowSize: normalizeNumber(input.props.rowSize, 40),
      exporting: true,
      theme: normalizeText(input.props.theme, 'compact'),
      resize: true,
      range: false,
      readonly: true,
      useAutofill: false,
      style: 'height: 100%',
    }),
  ])
})

function collectTableColumns(
  tableNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
): SFCTableColumn[] {
  return tableNode.children
    .filter(isElementNode)
    .filter(node => node.tag === 'Column')
    .map((node, index) => createTableColumn(node, context, index))
}

function createTableColumn(
  columnNode: RComponentSFC_IR_ElementNode,
  context: SFCVueRenderContext,
  index: number,
): SFCTableColumn {
  const props = evaluateSFCProps(columnNode.props, context)
  const key = normalizeText(props.key, `column_${index}`)

  return {
    key,
    title: normalizeText(props.title ?? props.name, key),
    width: normalizeOptionalNumber(props.width ?? props.size),
    cellNodes: resolveCellNodes(columnNode),
  }
}

function resolveCellNodes(columnNode: RComponentSFC_IR_ElementNode): RComponentSFC_IR_Node[] {
  const cell = columnNode.children
    .filter(isElementNode)
    .find(node => node.tag === 'Cell')

  return cell?.children ?? columnNode.children
}

function createRevoColumn(
  h: SFCVueRenderH,
  column: SFCTableColumn,
  rows: Record<string, unknown>[],
  context: SFCVueRenderContext,
): Record<string, unknown> {
  return {
    prop: column.key,
    name: column.title,
    sortable: false,
    autoSize: column.width == null,
    size: column.width ?? 150,
    cellTemplate: (cellH: SFCVueRenderH, cellProps: Record<string, unknown>) => {
      const rowIndex = normalizeNumber(cellProps.rowIndex, 0)
      const row = normalizeCellRow(rows, cellProps, rowIndex)
      const cellContext = extendSFCVueRenderContext(context, {
        row,
        rowIndex,
        value: row[column.key],
      })
      const children = renderSFCNodes(cellH ?? h, column.cellNodes, cellContext)

      return (cellH ?? h)('div', {
        class: 'endge-sfc-table-cell',
        style: {
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          minWidth: 0,
        },
      }, children)
    },
  }
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}
