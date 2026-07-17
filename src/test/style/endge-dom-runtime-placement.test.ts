// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { compileEndgeCSS, type EndgeStylePlacement } from '@endge/core'

import { materializeEndgeCSSForDOM } from '@/model/style/endge-dom-style'
import { EndgeDOMStyleRuntime } from '@/model/style/EndgeDOMStyleRuntime'

describe('DOM style runtime placements', () => {
  afterEach(() => {
    document.head.querySelectorAll('style[data-endge-styles]').forEach(element => element.remove())
    document.body.replaceChildren()
  })

  it('isolates an acquired artifact by runtime scope boundary', () => {
    const artifact = compileEndgeCSS('.cell { color: red; }', { identity: 'theme' }).artifact!
    const placement: EndgeStylePlacement = {
      id: 'placement',
      artifactIdentity: 'theme',
      artifact,
      ownerScopeIds: ['scope:a'],
      boundaryId: 'scope:a',
      orderKey: '0001:theme',
      state: 'active',
      referenceCount: 1,
    }
    const css = materializeEndgeCSSForDOM([placement]).css
    expect(css).toContain('[data-endge-runtime-scope~="scope:a"]')
    expect(css).toContain('color:red')
  })

  it('keeps source order independent from activation input order through orderKey sorting upstream', () => {
    const first = compileEndgeCSS('.cell { color: red; }', { identity: 'first' }).artifact!
    const second = compileEndgeCSS('.cell { color: blue; }', { identity: 'second' }).artifact!
    const placement = (artifact: typeof first, orderKey: string): EndgeStylePlacement => ({
      id: `${artifact.identity}:${orderKey}`,
      artifactIdentity: artifact.identity,
      artifact,
      ownerScopeIds: ['scope'],
      boundaryId: 'scope',
      orderKey,
      state: 'active',
      referenceCount: 1,
    })
    const css = materializeEndgeCSSForDOM([placement(first, '01'), placement(second, '02')]).css
    expect(css.indexOf('color:red')).toBeLessThan(css.indexOf('color:blue'))
  })

  it('hides paused runtime boundaries without destroying their DOM', () => {
    const runtime = new EndgeDOMStyleRuntime()
    runtime.update([], { renderer: 'dom', capabilities: [] }, ['scope:paused'])
    expect(document.querySelector('style[data-endge-styles]')?.textContent).toContain(
      '[data-endge-runtime-scope~="scope:paused"]{display:none!important;}',
    )
    runtime.reset()
    expect(document.querySelector('style[data-endge-styles]')).toBeNull()
  })

  it('applies, pauses and removes an acquired style through the managed stylesheet', () => {
    const artifact = compileEndgeCSS('.cell { color: rgb(255, 0, 0); }', { identity: 'theme' }).artifact!
    const placement: EndgeStylePlacement = {
      id: 'placement',
      artifactIdentity: 'theme',
      artifact,
      ownerScopeIds: ['scope:page'],
      boundaryId: 'scope:page',
      orderKey: '0001:theme',
      state: 'active',
      referenceCount: 1,
    }
    const className = materializeEndgeCSSForDOM([placement]).classes[0].className
    const boundary = document.createElement('section')
    boundary.dataset.endgeRuntimeScope = 'scope:page'
    const cell = document.createElement('div')
    cell.className = className
    boundary.append(cell)
    document.body.append(boundary)
    const runtime = new EndgeDOMStyleRuntime()

    runtime.update([placement], { renderer: 'dom', capabilities: [] })
    expect(getComputedStyle(cell).color).toBe('rgb(255, 0, 0)')

    runtime.update([placement], { renderer: 'dom', capabilities: [] }, ['scope:page'])
    expect(getComputedStyle(boundary).display).toBe('none')

    runtime.update([], { renderer: 'dom', capabilities: [] })
    expect(getComputedStyle(cell).color).not.toBe('rgb(255, 0, 0)')
    runtime.reset()
  })
})
