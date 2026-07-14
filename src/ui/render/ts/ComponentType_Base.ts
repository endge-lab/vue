import type { VNode } from 'vue'
import type { RComponentBase } from '@endge/core'
import type { ComponentType_Props } from '@endge/core'
import { EndgeJsxAttr, Prefix } from '@endge/core'
import { randomString } from '@endge/utils'
import { RuntimeScope } from '@endge/core'

/**
 * Legacy layout wrapper.
 * Script execution has been removed; the scope only preserves the old renderer contract.
 *
 * @param renderFn Основная функция рендера компонента
 * @returns Функция рендера с legacy-обёрткой
 */
export default function ComponentType_Base<T extends RComponentBase>(
  renderFn: (
    h: (...args: any[]) => VNode,

    props: ComponentType_Props<T>,
  ) => VNode,
) {
  return (
    h: (...args: any[]) => VNode,
    props: ComponentType_Props<T>,
  ): VNode => {
    const { model, scope: parentScope } = props
    const scopeId = `component-scope-${randomString(5)}`
    const scope = new RuntimeScope(scopeId, parentScope)

    // Получаем содержимое и оборачиваем его
    const vnode = renderFn(h, {
      ...props,
      scope,
    })
    return h(
      'div',
      {
        class: Prefix.ComponentWrapper,
        [EndgeJsxAttr.ComponentIdentity]: model.identity ?? model.id,
        [EndgeJsxAttr.ComponentId]: model.id,
      },
      [vnode],
    )
  }
}
