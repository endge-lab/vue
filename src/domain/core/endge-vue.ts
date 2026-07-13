import type { PhaseName } from '@endge/raph'
import type { Ref } from 'vue'

import {
  ComponentType,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
  ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
  ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
  Endge,
  EndgeModule,
  type EndgePlugin,
} from '@endge/core'
import { Raph, RaphNode } from '@endge/raph'
import { randomString } from '@endge/utils'
import { onBeforeUnmount, ref, watch } from 'vue'

import JSXRender_Box from '@/ui/render/dsl-jsx/JSXRender_Box'
import JSXRender_Component from '@/ui/render/dsl-jsx/JSXRender_Component'
import JSXRender_DateTime from '@/ui/render/dsl-jsx/JSXRender_DateTime'
import JSXRender_Flex from '@/ui/render/dsl-jsx/JSXRender_Flex'
import JSXRender_Icon from '@/ui/render/dsl-jsx/JSXRender_Icon'
import JSXRender_Layout from '@/ui/render/dsl-jsx/JSXRender_Layout'
import JSXRender_Text from '@/ui/render/dsl-jsx/JSXRender_Text'
import ComponentType_DSL from '@/ui/render/ts/ComponentType_DSL'
import ComponentType_Table from '@/ui/render/vue/ComponentType_TableV2.vue'
import { NativeVueSFCAdapter } from '@/model/render/sfc/native-vue-sfc-adapter'

export class EndgeVueModule extends EndgeModule {
  private _started = false

  public override setup(): void {
    Endge.uiRegistry.adapters.register(NativeVueSFCAdapter)

    this.registerLegacyViewRenderer(
      ComponentType.Table,
      'component',
      ComponentType_Table,
      'ComponentType.Table:view',
    )
    this.registerLegacyViewRenderer(
      ComponentType.DSL,
      'functional',
      ComponentType_DSL,
      'ComponentType.DSL:view',
    )

    this.registerLegacyViewRenderer('Layout', 'functional', JSXRender_Layout, 'JSX:Layout')
    this.registerLegacyViewRenderer('Flex', 'functional', JSXRender_Flex, 'JSX:Flex')
    this.registerLegacyViewRenderer('Box', 'functional', JSXRender_Box, 'JSX:Box')
    this.registerLegacyViewRenderer('Component', 'functional', JSXRender_Component, 'JSX:Component')
    this.registerLegacyViewRenderer('Text', 'functional', JSXRender_Text, 'JSX:Text')
    this.registerLegacyViewRenderer('DateTime', 'functional', JSXRender_DateTime, 'JSX:DateTime')
    this.registerLegacyViewRenderer('Icon', 'functional', JSXRender_Icon, 'JSX:Icon')
  }

  public override build(): void {
    Endge.uiRegistry.adapters.activate({
      id: Endge.workspace.defaultSfcAdapterId,
      protocol: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL,
      protocolVersion: ENDGE_SFC_RENDER_ADAPTER_PROTOCOL_VERSION,
      renderer: 'vue',
      requiredRendererKeys: ENDGE_SFC_RENDER_ADAPTER_REQUIRED_KEYS,
    })
  }

  public override start(): void {
    if (this._started)
      return

    this._started = true

    Raph.addPhase({
      name: 'watch' as PhaseName,
      routes: ['*'],
      traversal: 'dirty-only',

      // берём только root-ноды таблицы (их ты сам track-ишь на `${basePath}.*`)
      nodes: (node: RaphNode) => node?.meta.type === 'watch',

      all: (ctxs) => {
        if (!ctxs.length)
          return

        ctxs.forEach((ctx) => {
          const path = ctx.node?.meta?.path

          if (!ctx.node?.meta?.ref || typeof path !== 'string') {
            return
          }

          (ctx.node.meta.ref as Ref<unknown>).value = Raph.get(path)
        })
      },
    })
  }

  public override reset(): void {
    this._started = false
  }

  private registerLegacyViewRenderer(
    componentIdentity: string,
    renderType: 'functional' | 'component',
    component: unknown,
    label?: string,
  ): void {
    Endge.uiRegistry.registerLegacyComponentRenderer({
      ref: `legacy:${componentIdentity}:view`,
      componentIdentity,
      host: 'view',
      renderType,
      component,
      label,
    })
  }
}

export const EndgeVuePlugin: EndgePlugin = {
  id: '@endge/vue',
  install(): void {
    Endge.defineModule({
      key: 'vue',
      module: new EndgeVueModule(),
      before: 'runtime',
    })
  },
}

export class EndgeVue {
  static makeRaphRef<T>(path: string): Ref<T> {
    const newRef = ref<T>(Raph.get(path) as T)

    const raphNode = new RaphNode(Raph.app, {
      id: `watch:${randomString(5)}`,
      meta: {
        ref: newRef,
        type: 'watch',
        path,
      },
    })
    Raph.app.addNode(raphNode)
    Raph.app.track(raphNode, `${path}[*]`, {
      wildcardDynamic: true,
    })

    onBeforeUnmount(() => {
      Raph.app.untrack?.(raphNode)
      raphNode.remove?.()
    })

    watch(newRef, () => {
      Raph.set(path, newRef.value)
    })

    return newRef as Ref<T>
  }

  static makeVocabRef<T>(vocab: string): Ref<T> {
    return EndgeVue.makeRaphRef(`vocabs.${vocab}`)
  }
}
