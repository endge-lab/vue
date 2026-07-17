import type { EndgeStylePlacement, EndgeStyleSheetArtifact, EndgeStyleTargetProfile } from '@endge/core'

import { materializeEndgeCSSForDOM } from '@/model/style/endge-dom-style'

/** Owns one atomically replaced stylesheet for the Vue DOM renderer. */
export class EndgeDOMStyleRuntime {
  private sheet: CSSStyleSheet | null = null
  private fallback: HTMLStyleElement | null = null
  private lastKey = ''

  public update(
    artifacts: readonly (EndgeStyleSheetArtifact | EndgeStylePlacement)[],
    target: EndgeStyleTargetProfile,
    hiddenScopeIds: readonly string[] = [],
  ): void {
    if (typeof document === 'undefined') return
    const key = `${target.renderer}:${[...(target.capabilities ?? [])].sort().join(',')}:${artifacts.map((item) => 'artifact' in item ? `${item.artifact.sourceHash}@${item.boundaryId}:${item.orderKey}` : item.sourceHash).join(':')}:hidden=${[...hiddenScopeIds].sort().join(',')}`
    if (key === this.lastKey) return
    this.lastKey = key
    const materialized = materializeEndgeCSSForDOM(artifacts, target)
    const hiddenCss = hiddenScopeIds
      .map(id => `[data-endge-runtime-scope~=${JSON.stringify(id)}]{display:none!important;}`)
      .join('\n')
    const css = [materialized.css, hiddenCss].filter(Boolean).join('\n')

    const root = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }
    if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype && Array.isArray(root.adoptedStyleSheets)) {
      this.fallback?.remove()
      this.fallback = null
      this.sheet ??= new CSSStyleSheet()
      this.sheet.replaceSync(css)
      if (!root.adoptedStyleSheets.includes(this.sheet))
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, this.sheet]
      return
    }

    this.fallback ??= this.createFallback()
    this.fallback.textContent = css
  }

  public reset(): void {
    if (typeof document !== 'undefined' && this.sheet) {
      const root = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }
      if (Array.isArray(root.adoptedStyleSheets))
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter(sheet => sheet !== this.sheet)
    }
    this.fallback?.remove()
    this.fallback = null
    this.sheet = null
    this.lastKey = ''
  }

  private createFallback(): HTMLStyleElement {
    const element = document.createElement('style')
    element.dataset.endgeStyles = ''
    document.head.append(element)
    return element
  }
}
