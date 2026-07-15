# SFC Renderer

Новый SFC renderer в `@endge/vue` читает готовый `RComponentSFC_IR` и локальные `props`.

На первом этапе renderer не создает runtime host, не читает `Endge.program`, не подписывается на Raph и не управляет repository bindings. Его задача - отрисовать уже скомпилированный IR во Vue `h` tree.

Пример:

```vue
<SFC_Renderer :ir="ir" :props="{ flight, compact: false }" />
```

Compiled `definePorts` defaults are resolved before template rendering.
Computation port locals are evaluated once per component render context, and a
component port is rendered through the same nested `Component` adapter. This
keeps row and nested-component results isolated without DOM-specific state.

Визуальные primitive-теги рендерятся активным adapter-ом: `Text`, `DateTime`, `Number`, `Icon`, `Badge`, `Dot`, `Box`, `Flex`, `Divider`, `Input`, `Textarea`, `Checkbox`, `Select`.

`Component`, `Table` и структурные table-теги остаются частью Vue render engine: они работают с runtime host и структурой IR, которые не входят в публичный adapter contract.

## Render adapters

`@endge/vue` регистрирует нативный DOM adapter `native-vue`. Выбранный идентификатор берется из `Workspace.defaultSfcAdapterId` на фазе `build()`.

Массив `Workspace.sfcAdapterIds` описывает доступные пользователю варианты, но не устанавливает код adapter-а. Реальная implementation должна быть зарегистрирована приложением до `build()`. Если выбранного adapter-а нет, либо его protocol, renderer или набор primitives несовместимы, boot завершается ошибкой до запуска runtime.

Vue adapter получает только нормализованный вход:

```ts
interface SFCVueRenderAdapterElementInput {
  h: typeof import('vue').h
  props: Record<string, unknown>
  attrs: Record<string, unknown>
  children: Array<VNode | string>
}
```

Compiler IR node, runtime host и evaluator context adapter-у не передаются.

Внешний пакет должен регистрировать adapter через свой Endge plugin, чтобы регистрация повторялась после `Endge.reset()`:

```ts
import type { EndgePlugin } from '@endge/core'
import { Endge, EndgeModule } from '@endge/core'
import type { SFCVueRenderAdapter } from '@endge/vue'
import { NativeVueSFCAdapter } from '@endge/vue'
import CustomerInput from './CustomerInput.vue'

const CustomerAdapter: SFCVueRenderAdapter = {
  ...NativeVueSFCAdapter,
  id: 'customer-aodb',
  renderers: {
    ...NativeVueSFCAdapter.renderers,
    Input: input => input.h(CustomerInput, input.attrs),
  },
}

class CustomerAdapterModule extends EndgeModule {
  override setup(): void {
    Endge.uiRegistry.adapters.register(CustomerAdapter)
  }
}

export const CustomerAdapterPlugin: EndgePlugin = {
  id: '@customer/aodb-ui',
  install(): void {
    Endge.defineModule({
      key: 'customerAodbUi',
      module: new CustomerAdapterModule(),
    })
  },
}
```

Приложение подключает `CustomerAdapterPlugin` и `EndgeVuePlugin` через `Endge.use(...)` до `Endge.boot(...)`.
