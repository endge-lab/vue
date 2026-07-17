import {
  compileComponentSFC,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
} from '@endge/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { h, isVNode } from 'vue'

import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'
import {
  decorateSFCTableRows,
  getSFCTableCellStyleSurfaces,
  SFC_TABLE_ROW_CLASS_FIELD,
  type SFCTableStyleContract,
} from '@/ui/render/sfc/SFCRender_TableStyle'

describe('SFC EndgeCSS runtime markers', () => {
  beforeAll(() => {
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  it('normalizes id, class, state, part and attaches a matched generated class', () => {
    const compiled = compileComponentSFC(`<template>
      <Text id="status" class="flight-card" state="delayed selected" part="status">Delayed</Text>
    </template>
    <style scoped lang="endgecss">
      #status.flight-card:state(delayed)::part(status) { color: red; }
    </style>`, { identity: 'flight-board' })
    const ir = compiled.ir!
    const rendered = renderSFCNode(h, ir.template.roots[0], createSFCVueRenderContext({}, 0, null, ir))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered)) return
    expect(rendered.props?.['data-endge-id']).toBe('status')
    expect(rendered.props?.['data-endge-state']).toBe('delayed selected')
    expect(rendered.props?.part).toBe('status')
    expect(rendered.props?.['data-endge-scope-root']).toBe(ir.style?.scopeId)
    expect(String(rendered.props?.class)).toContain('endge-es-')
  })

  it('exposes the complete Table structural style contract', () => {
    const compiled = compileComponentSFC(`<template>
      <Table id="groundhandling-control" :rows="[]">
        <Column key="aircraft" title="ВС"><Text>RA-00001</Text></Column>
      </Table>
    </template>
    <style scoped lang="endgecss">
      #groundhandling-control::part(grid) { background-color: white; }
      #groundhandling-control::part(header) { background-color: #1e3a5f; }
      #groundhandling-control::part(header-cell) { border-right: 1px solid gray; }
      #groundhandling-control::part(header-content) { color: white; }
      #groundhandling-control::part(body) { background-color: white; }
      #groundhandling-control:nth-child(even)::part(row) { background-color: #eee; }
      #groundhandling-control::part(cell) { border-bottom: 1px solid gray; }
      #groundhandling-control::part(cell-content) { color: #222; }
      #groundhandling-control::part(group-row) { font-weight: 700; }
    </style>`, { identity: 'ground-handling-table' })
    const ir = compiled.ir!
    const rendered = renderSFCNode(h, ir.template.roots[0], createSFCVueRenderContext({}, 0, null, ir))

    expect(isVNode(rendered)).toBe(true)
    if (!isVNode(rendered) || !Array.isArray(rendered.children)) return

    const grid = rendered.children[0]
    expect(isVNode(grid)).toBe(true)
    if (!isVNode(grid)) return

    const contract = grid.props?.styleContract as SFCTableStyleContract
    const column = (grid.props?.columns as any[])[0]
    expect(contract.grid.attrs).toMatchObject({ part: 'grid', 'data-endge-part': 'grid' })
    expect(contract.header.attrs).toMatchObject({ part: 'header', 'data-endge-part': 'header' })
    expect(contract.body.attrs).toMatchObject({ part: 'body', 'data-endge-part': 'body' })
    expect(contract.groupRow.attrs).toMatchObject({ part: 'group-row', 'data-endge-part': 'group-row' })
    expect(column.styleSurfaces.headerCell.attrs).toMatchObject({
      part: 'header-cell',
      'data-endge-part': 'header-cell',
    })
    expect(column.styleSurfaces.headerContent.attrs).toMatchObject({
      part: 'header-content',
      'data-endge-part': 'header-content',
    })

    const rows = decorateSFCTableRows([{ id: 1 }, { id: 2 }], 1, contract)
    expect(rows[0][SFC_TABLE_ROW_CLASS_FIELD]).toBe('')
    expect(rows[1][SFC_TABLE_ROW_CLASS_FIELD]).toContain('endge-es-')
    expect(getSFCTableCellStyleSurfaces(rows[0], 0)?.cell.attrs).toMatchObject({
      part: 'cell',
      'data-endge-part': 'cell',
    })
    expect(getSFCTableCellStyleSurfaces(rows[0], 0)?.cellContent.attrs).toMatchObject({
      part: 'cell-content',
      'data-endge-part': 'cell-content',
    })
    expect(contract.grid.attrs.class).toHaveLength(1)
    expect(contract.header.attrs.class).toHaveLength(1)
    expect(contract.body.attrs.class).toHaveLength(1)
    expect(contract.groupRow.attrs.class).toHaveLength(1)
    expect(column.styleSurfaces.headerCell.attrs.class).toHaveLength(1)
    expect(column.styleSurfaces.headerContent.attrs.class).toHaveLength(1)
  })
})
