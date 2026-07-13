import type {
  FilterViewRenderField,
  SourceFieldOption,
} from '@endge/core'

import {
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  Endge,
} from '@endge/core'
import { defineComponent, h, type PropType } from 'vue'

import type {
  SFCVueRenderAdapterFunction,
} from '@/domain/types/sfc-render.type'

/** Делегирует один semantic control активному Vue adapter-у. */
export const EndgeFilterControlRenderer = defineComponent({
  name: 'EndgeFilterControlRenderer',
  props: {
    field: {
      type: Object as PropType<FilterViewRenderField>,
      required: true,
    },
    options: {
      type: Array as PropType<SourceFieldOption[]>,
      default: () => [],
    },
    readonly: Boolean,
    label: String,
  },
  emits: {
    'update:value': (_value: unknown) => true,
  },
  setup(props, { emit }) {
    return () => {
      const adapter = Endge.uiRegistry.adapters.requireActive<SFCVueRenderAdapterFunction>({
        protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
        protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
        renderer: 'vue',
        requiredRendererKeys: [props.field.control.type],
      })
      const render = adapter.renderers[props.field.control.type]
      if (!render)
        throw new Error(`[EndgeFilterControlRenderer] renderer "${props.field.control.type}" is missing.`)

      const readonly = props.readonly === true
      const controlProps = makeControlProps(props.field, props.options, readonly, props.label)
      const eventName = props.field.control.type === 'Input' || props.field.control.type === 'Textarea'
        ? 'onInput'
        : 'onChange'

      return render({
        h,
        children: [],
        props: controlProps,
        attrs: {
          'data-endge-filter-field': props.field.key,
          [eventName]: (event: Event) => {
            if (!readonly)
              emit('update:value', readControlValue(event, props.field, props.options))
          },
        },
      })
    }
  },
})

function makeControlProps(
  field: FilterViewRenderField,
  options: SourceFieldOption[],
  readonly: boolean,
  label?: string,
): Record<string, unknown> {
  if (field.control.type === 'Checkbox') {
    return {
      checked: field.value === true,
      label: label || field.key,
      readonly,
      disabled: readonly,
    }
  }

  if (field.control.type === 'Select') {
    return {
      value: field.value,
      options,
      multiple: field.array,
      placeholder: field.key,
      readonly,
      disabled: readonly,
    }
  }

  const value = field.array && Array.isArray(field.value)
    ? field.value.join(', ')
    : field.value
  return {
    type: field.type === 'Number' || field.type === 'Date' || field.type === 'Time' || field.type === 'DateTime'
      ? field.type
      : 'String',
    value,
    rows: field.control.type === 'Textarea' ? 3 : undefined,
    placeholder: field.key,
    readonly,
    disabled: readonly,
  }
}

function readControlValue(
  event: Event,
  field: FilterViewRenderField,
  options: SourceFieldOption[],
): unknown {
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement))
    return field.value

  if (field.control.type === 'Checkbox' && target instanceof HTMLInputElement)
    return target.checked

  if (field.control.type === 'Select' && target instanceof HTMLSelectElement) {
    if (field.array) {
      return Array.from(target.selectedOptions)
        .map(option => findOptionValue(options, option.value))
    }
    return target.value === '' ? undefined : findOptionValue(options, target.value)
  }

  const value = target.value
  if (field.array) {
    const parts = value.split(',').map(item => item.trim()).filter(Boolean)
    return field.type === 'Number'
      ? parts.map(Number).filter(Number.isFinite)
      : parts
  }
  if (field.type === 'Number') {
    if (value.trim() === '')
      return undefined
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? numberValue : field.value
  }
  return value
}

function findOptionValue(options: SourceFieldOption[], value: string): SourceFieldOption['value'] | string {
  return options.find(option => String(option.value) === value)?.value ?? value
}
