/** @vitest-environment jsdom */
import { compileEndgeCSS, type EndgeStyleMatchNode } from '@endge/core'
import { afterEach, describe, expect, it } from 'vitest'

import { EndgeDOMStyleRuntime } from '@/model/style/EndgeDOMStyleRuntime'
import { getEndgeDOMStyleClasses, materializeEndgeCSSForDOM } from '@/model/style/endge-dom-style'

function textNode(): EndgeStyleMatchNode {
  return { tag: 'Text', classes: new Set(), attributes: {}, states: new Set(), parts: new Set(), index: 1, siblingCount: 1 }
}

describe('EndgeCSS DOM application', () => {
  afterEach(() => {
    document.head.querySelectorAll('[data-endge-test-style]').forEach(element => element.remove())
    document.body.replaceChildren()
  })

  it('applies generated CSS and preserves the important priority in CSSOM', () => {
    const artifact = compileEndgeCSS('Text { color: rgb(255, 0, 0) !important; }').artifact!
    const style = document.createElement('style')
    style.dataset.endgeTestStyle = ''
    style.textContent = materializeEndgeCSSForDOM([artifact]).css
    document.head.append(style)
    const element = document.createElement('span')
    element.className = getEndgeDOMStyleClasses([artifact], textNode()).join(' ')
    document.body.append(element)
    expect(getComputedStyle(element).color).toBe('rgb(255, 0, 0)')
    expect(style.sheet?.cssRules[0] && (style.sheet.cssRules[0] as CSSStyleRule).style.getPropertyPriority('color')).toBe('important')
  })

  it('atomically reuses one managed fallback style element', () => {
    const runtime = new EndgeDOMStyleRuntime()
    runtime.update([compileEndgeCSS('Text { color: red; }').artifact!], { renderer: 'dom' })
    runtime.update([compileEndgeCSS('Text { color: blue; }').artifact!], { renderer: 'dom' })
    const styles = document.head.querySelectorAll('style[data-endge-styles]')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toContain('blue')
    runtime.reset()
    expect(document.head.querySelector('style[data-endge-styles]')).toBeNull()
  })
})
