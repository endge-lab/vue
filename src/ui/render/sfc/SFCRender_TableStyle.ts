import type { EndgeStyleMatchNode } from '@endge/core'

import type { SFCVueRenderContext } from '@/domain/types/sfc-render.type'
import { getEndgeDOMStyleClasses } from '@/model/style/endge-dom-style'

export type SFCTablePublicPart =
  | 'grid'
  | 'header'
  | 'header-cell'
  | 'header-content'
  | 'body'
  | 'row'
  | 'cell'
  | 'cell-content'
  | 'group-row'

export interface SFCTablePublicPartAttrs extends Record<string, unknown> {
  part: SFCTablePublicPart
  'data-endge-part': SFCTablePublicPart
  class: string[]
}

export interface SFCTablePublicSurface {
  node: EndgeStyleMatchNode
  attrs: SFCTablePublicPartAttrs
}

export interface SFCTableStyleContract {
  context: SFCVueRenderContext
  grid: SFCTablePublicSurface
  header: SFCTablePublicSurface
  body: SFCTablePublicSurface
  groupRow: SFCTablePublicSurface
}

export interface SFCTableColumnStyleSurfaces {
  headerCell: SFCTablePublicSurface
  headerContent: SFCTablePublicSurface
}

export interface SFCTableCellStyleSurfaces {
  cell: SFCTablePublicSurface
  cellContent: SFCTablePublicSurface
}

interface SFCTableRowStyleMeta {
  row: SFCTablePublicSurface
  cells: SFCTableCellStyleSurfaces[]
}

export const SFC_TABLE_ROW_CLASS_FIELD = '__endgeStyleRowClass'
const SFC_TABLE_ROW_STYLE_META = Symbol('endge.table.row-style-meta')
const APPLIED_STYLE_CLASSES_ATTRIBUTE = 'data-endge-applied-style-classes'

export function createSFCTableStyleContract(context: SFCVueRenderContext): SFCTableStyleContract {
  const grid = createSurface(context, 'grid', 1, 1)
  const header = createSurface(context, 'header', 1, 1, [], grid.node)
  const body = createSurface(context, 'body', 1, 1, [], grid.node)
  const groupRow = createSurface(context, 'group-row', 1, 1, [], body.node)
  return { context, grid, header, body, groupRow }
}

export function createSFCTableColumnStyleSurfaces(
  contract: SFCTableStyleContract,
  columnCount: number,
): SFCTableColumnStyleSurfaces[] {
  const headerCells: EndgeStyleMatchNode[] = []
  const result: SFCTableColumnStyleSurfaces[] = []

  for (let index = 0; index < columnCount; index++) {
    const headerCell = createSurface(
      contract.context,
      'header-cell',
      index + 1,
      columnCount,
      headerCells,
      contract.header.node,
    )
    headerCells.push(headerCell.node)
    const headerContent = createSurface(
      contract.context,
      'header-content',
      1,
      1,
      [],
      headerCell.node,
    )
    result.push({ headerCell, headerContent })
  }

  return result
}

export function decorateSFCTableRows(
  rows: readonly Record<string, unknown>[],
  columnCount: number,
  contract: SFCTableStyleContract,
): Record<string, unknown>[] {
  const rowNodes: EndgeStyleMatchNode[] = []

  return rows.map((row, rowIndex) => {
    const rowSurface = createSurface(
      contract.context,
      'row',
      rowIndex + 1,
      rows.length,
      rowNodes,
      contract.body.node,
    )
    rowNodes.push(rowSurface.node)

    const cellNodes: EndgeStyleMatchNode[] = []
    const cells: SFCTableCellStyleSurfaces[] = []
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
      const cell = createSurface(
        contract.context,
        'cell',
        columnIndex + 1,
        columnCount,
        cellNodes,
        rowSurface.node,
      )
      cellNodes.push(cell.node)
      const cellContent = createSurface(
        contract.context,
        'cell-content',
        1,
        1,
        [],
        cell.node,
      )
      cells.push({ cell, cellContent })
    }

    const decorated = {
      ...row,
      [SFC_TABLE_ROW_CLASS_FIELD]: rowSurface.attrs.class.join(' '),
    }
    Object.defineProperty(decorated, SFC_TABLE_ROW_STYLE_META, {
      configurable: false,
      enumerable: false,
      value: { row: rowSurface, cells } satisfies SFCTableRowStyleMeta,
      writable: false,
    })
    return decorated
  })
}

export function getSFCTableCellStyleSurfaces(
  row: Record<string, unknown>,
  columnIndex: number,
): SFCTableCellStyleSurfaces | null {
  const metadata = (row as unknown as Record<PropertyKey, unknown>)[SFC_TABLE_ROW_STYLE_META] as SFCTableRowStyleMeta | undefined
  return metadata?.cells[columnIndex] ?? null
}

export function toRevoGridSurfaceProps(attrs: SFCTablePublicPartAttrs): Record<string, unknown> {
  return {
    part: attrs.part,
    'data-endge-part': attrs['data-endge-part'],
    class: Object.fromEntries(attrs.class.map(className => [className, true])),
  }
}

/** Applies logical surfaces to RevoGrid-owned DOM without leaking vendor selectors into EndgeCSS. */
export function syncSFCTableDOMSurfaces(
  grid: HTMLElement,
  contract: SFCTableStyleContract,
): void {
  applySurfaceAttrs(grid, contract.grid.attrs)
  grid.querySelectorAll<HTMLElement>('revogr-header')
    .forEach(element => applySurfaceAttrs(element, contract.header.attrs))
  grid.querySelectorAll<HTMLElement>('revogr-data')
    .forEach((element) => {
      const rowType = element.getAttribute('type') ?? (element as HTMLElement & { type?: string }).type
      if (rowType === 'rgRow') applySurfaceAttrs(element, contract.body.attrs)
    })
  grid.querySelectorAll<HTMLElement>('.rgRow')
    .forEach((element) => {
      const part: SFCTablePublicPart = element.classList.contains('groupingRow') ? 'group-row' : 'row'
      if (part === 'group-row') {
        applySurfaceAttrs(element, contract.groupRow.attrs)
        return
      }

      element.setAttribute('part', part)
      element.setAttribute('data-endge-part', part)
    })
}

function createSurface(
  context: SFCVueRenderContext,
  part: SFCTablePublicPart,
  index: number,
  siblingCount: number,
  previousSiblings: readonly EndgeStyleMatchNode[] = [],
  parent?: EndgeStyleMatchNode,
): SFCTablePublicSurface {
  const host = context.styleParent
  const node: EndgeStyleMatchNode = {
    tag: host?.tag ?? 'Table',
    id: host?.id,
    classes: host?.classes ?? new Set<string>(),
    attributes: host?.attributes ?? {},
    states: host?.states ?? new Set<string>(),
    parts: new Set([part]),
    component: host?.component,
    identity: host?.identity,
    ownerScopeId: host?.ownerScopeId ?? context.styleOwnerScopeId,
    parent: parent ?? host?.parent,
    previousSiblings: [...previousSiblings],
    index,
    siblingCount,
  }
  return {
    node,
    attrs: {
      part,
      'data-endge-part': part,
      class: getEndgeDOMStyleClasses(context.styleArtifacts, node),
    },
  }
}

function applySurfaceAttrs(element: HTMLElement, attrs: SFCTablePublicPartAttrs): void {
  const previousClasses = element.getAttribute(APPLIED_STYLE_CLASSES_ATTRIBUTE)?.split(/\s+/).filter(Boolean) ?? []
  previousClasses.forEach(className => element.classList.remove(className))
  attrs.class.forEach(className => element.classList.add(className))
  element.setAttribute(APPLIED_STYLE_CLASSES_ATTRIBUTE, attrs.class.join(' '))
  element.setAttribute('part', attrs.part)
  element.setAttribute('data-endge-part', attrs['data-endge-part'])
}
