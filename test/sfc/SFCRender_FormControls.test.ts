import type {
  RComponentSFC_IR_ElementNode,
  RComponentSFC_IR_Tag,
  RComponentSFC_IR_Value,
} from '@endge/core'
import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
} from '@endge/core'
import { beforeAll, describe, expect, it } from 'vitest'
import { h, isVNode, type VNode } from 'vue'

import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { renderSFCNode } from '@/ui/render/sfc/SFCRender_Node'
import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'

describe('display-only SFC form controls', () => {
  beforeAll(() => {
    if (!Endge.uiRegistry.adapters.has(NativeVueSFCAdapter.id)) {
      Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)
    }
    Endge.uiRegistry.adapters.activate({
      id: NativeVueSFCAdapter.id,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  })

  it.each([
    ['String', 'text', 'SU 1402'],
    ['Number', 'number', 15],
    ['Date', 'date', '2026-07-13'],
    ['Time', 'time', '12:34'],
    ['DateTime', 'datetime-local', '2026-07-13T10:20'],
    ['Unknown', 'text', 'fallback'],
  ])('renders Input type %s as native %s', (type, nativeType, expectedValue) => {
    const value = type === 'Date'
      ? '2026-07-13T00:00:00.000Z'
      : type === 'Time'
        ? '12:34:56'
        : type === 'DateTime'
          ? '2026-07-13T10:20'
          : expectedValue
    const vnode = renderControl('Input', { type, value })

    expect(vnode.type).toBe('input')
    expect(vnode.props).toMatchObject({
      class: 'endge-sfc-input',
      type: nativeType,
      value: expectedValue,
    })
  })

  it('renders Textarea and Checkbox values through native props', () => {
    const textarea = renderControl('Textarea', {
      value: 'Комментарий',
      rows: '4',
      readonly: true,
    })
    expect(textarea.type).toBe('textarea')
    expect(textarea.props).toMatchObject({
      value: 'Комментарий',
      rows: '4',
      readonly: true,
    })

    const checkbox = renderControl('Checkbox', {
      checked: true,
      label: 'Отменённые',
    })
    const [nativeCheckbox, label] = vnodeChildren(checkbox)
    expect(nativeCheckbox.props).toMatchObject({
      class: 'endge-sfc-checkbox',
      type: 'checkbox',
      checked: true,
    })
    expect(label.children).toBe('Отменённые')
  })

  it('marks scalar and array Select values through string normalization', () => {
    const options = [
      { value: 1, label: 'Один' },
      { value: 2, label: 'Два' },
      { value: true, label: 'Да' },
    ]
    const single = renderControl('Select', {
      value: '2',
      options,
      placeholder: 'Статус',
    })
    const singleOptions = vnodeChildren(single)
    expect(single.props?.multiple).toBe(false)
    expect(singleOptions.map(option => option.props?.selected)).toEqual([false, true, false])

    const multiple = renderControl('Select', {
      multiple: true,
      value: ['1', true],
      options,
      placeholder: 'Не показывается',
    })
    const multipleOptions = vnodeChildren(multiple)
    expect(multiple.props?.multiple).toBe(true)
    expect(multipleOptions).toHaveLength(3)
    expect(multipleOptions.map(option => option.props?.selected)).toEqual([true, false, true])
  })

  it('does not register change callbacks on controls or their children', () => {
    const controls = [
      renderControl('Input', { value: 'SU' }),
      renderControl('Textarea', { value: 'Комментарий' }),
      renderControl('Checkbox', { checked: true, label: 'Отменённые' }),
      renderControl('Select', { value: 'active', options: [{ value: 'active' }] }),
    ]

    for (const control of controls) {
      for (const vnode of flattenVNodes(control)) {
        expect(Object.keys(vnode.props ?? {}).filter(key => key.startsWith('on'))).toEqual([])
      }
    }
  })
})

function renderControl(
  tag: Extract<RComponentSFC_IR_Tag, 'Input' | 'Textarea' | 'Checkbox' | 'Select'>,
  props: Record<string, unknown>,
): VNode {
  const node: RComponentSFC_IR_ElementNode = {
    id: `test-${tag}`,
    kind: 'element',
    tag,
    props: Object.fromEntries(Object.entries(props).map(([key, value]) => [key, literal(value)])),
    directives: {},
    children: [],
  }
  const result = renderSFCNode(h, node, createSFCVueRenderContext({}))

  if (!isVNode(result))
    throw new Error(`${tag} did not render a VNode`)
  return result
}

function literal(value: unknown): RComponentSFC_IR_Value {
  return { kind: 'literal', value }
}

function vnodeChildren(vnode: VNode): VNode[] {
  const children = Array.isArray(vnode.children) ? vnode.children : []
  return children.filter(isVNode)
}

function flattenVNodes(vnode: VNode): VNode[] {
  return [vnode, ...vnodeChildren(vnode).flatMap(flattenVNodes)]
}
