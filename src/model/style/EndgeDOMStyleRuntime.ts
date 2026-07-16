import type { EndgeStyleSheetArtifact, EndgeStyleTargetProfile } from '@endge/core'

import { materializeEndgeCSSForDOM } from '@/model/style/endge-dom-style'

/** Owns one atomically replaced stylesheet for the Vue DOM renderer. */
export class EndgeDOMStyleRuntime {
  private sheet: CSSStyleSheet | null = null
  private fallback: HTMLStyleElement | null = null
  private lastKey = ''

  public update(artifacts: readonly EndgeStyleSheetArtifact[], target: EndgeStyleTargetProfile): void {
    if (typeof document === 'undefined') return
    const key = `${target.renderer}:${[...(target.capabilities ?? [])].sort().join(',')}:${artifacts.map(artifact => artifact.sourceHash).join(':')}`
    if (key === this.lastKey) return
    this.lastKey = key
    const { css } = materializeEndgeCSSForDOM(artifacts, target)

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
