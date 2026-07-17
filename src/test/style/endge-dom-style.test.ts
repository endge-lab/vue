import postcss from 'postcss'
import { describe, expect, it } from 'vitest'
import { compileEndgeCSS, type EndgeStyleMatchNode } from '@endge/core'

import { getEndgeDOMStyleClasses, materializeEndgeCSSForDOM } from '@/model/style/endge-dom-style'

function node(input: Partial<EndgeStyleMatchNode> & Pick<EndgeStyleMatchNode, 'tag'>): EndgeStyleMatchNode {
  return { classes: new Set(), attributes: {}, states: new Set(), parts: new Set(), index: 1, siblingCount: 1, ...input }
}

describe('EndgeCSS DOM materializer', () => {
  it('emits parseable CSS in neutral cascade order', () => {
    const artifact = compileEndgeCSS(`
      .status { color: blue; }
      Text { color: gray; }
      Text { color: red !important; }
      @theme dark { --surface: #111; .status { background: var(--surface); } }
    `).artifact!
    const result = materializeEndgeCSSForDOM([artifact])
    const parsed = postcss.parse(result.css)
    expect(parsed.nodes.length).toBeGreaterThan(0)
    expect(result.css).toContain(':root[data-endge-theme="dark"]')
    expect(result.css.lastIndexOf('!important')).toBeGreaterThan(result.css.lastIndexOf('color:blue'))
  })

  it('uses uniform non-zero class specificity to override renderer defaults', () => {
    const artifact = compileEndgeCSS('Table::part(header-content) { color: white; }').artifact!
    const result = materializeEndgeCSSForDOM([artifact])
    const generatedClass = result.classes[0].className

    expect(result.css).toContain(`.${generatedClass}{color:white;}`)
    expect(result.css).not.toContain(`:where(.${generatedClass})`)
  })

  it('includes dom rules, excludes canvas rules and warns for unknown capabilities', () => {
    const artifact = compileEndgeCSS(`
      @supports renderer(dom) { Text { color: green; } }
      @supports renderer(canvas) { Text { color: orange; } }
      @supports capability(print) { Text { color: black; } }
    `).artifact!
    const result = materializeEndgeCSSForDOM([artifact], { renderer: 'dom', capabilities: [] })
    expect(result.css).toContain('green')
    expect(result.css).not.toContain('orange')
    expect(result.css).not.toContain('black')
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'ENDGECSS_CAPABILITY_UNAVAILABLE' }))
  })

  it('attaches classes from logical nth-child and state matching', () => {
    const artifact = compileEndgeCSS('Flex > Text:nth-child(even):state(delayed) { color: red; }').artifact!
    const parent = node({ tag: 'Flex' })
    const target = node({ tag: 'Text', parent, index: 2, siblingCount: 3, states: new Set(['delayed']) })
    expect(getEndgeDOMStyleClasses([artifact], target)).toHaveLength(1)
  })
})
