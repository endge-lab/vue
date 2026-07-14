import { describe, expect, it } from 'vitest'
import type { RComponentSFC_IR_Value } from '@endge/core'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import { evaluateSFCExpression, evaluateSFCValue, readSFCPath } from '@/ui/render/sfc/SFCRender_Evaluator'

describe('SFCRender_Evaluator', () => {
  it('returns literal prop values', () => {
    const value: RComponentSFC_IR_Value = {
      kind: 'literal',
      value: 'Boarding',
    }

    expect(evaluateSFCValue(value, createSFCVueRenderContext({}))).toBe('Boarding')
  })

  it('evaluates dotted prop expressions', () => {
    const context = createSFCVueRenderContext({
      flight: {
        number: 'SU 1402',
      },
    })

    expect(evaluateSFCExpression('flight.number', context)).toBe('SU 1402')
  })

  it('evaluates boolean negation', () => {
    const context = createSFCVueRenderContext({
      compact: false,
    })

    expect(evaluateSFCExpression('!compact', context)).toBe(true)
  })

  it('returns undefined for missing props', () => {
    const context = createSFCVueRenderContext({})

    expect(evaluateSFCExpression('flight.number', context)).toBeUndefined()
  })

  it('reads array items by a DataPath parameter selector', () => {
    const context = createSFCVueRenderContext({})
    context.locals.row = {
      departureLeg: {
        attributes: [
          { name: 'ACType', text: '359' },
          { name: 'ACTail', text: '73151' },
        ],
      },
    }

    expect(
      evaluateSFCExpression("row.departureLeg.attributes[name='ACTail'].text", context),
    ).toBe('73151')
  })

  it('reads nested selectors containing spaces', () => {
    const context = createSFCVueRenderContext({
      rows: [{
        groundHandling: [{
          code: 'Bridge On',
          target: {
            points: [{ code: 'value', value: '2026-07-14T11:52:00Z' }],
          },
        }],
      }],
    })

    expect(readSFCPath(
      "rows[0].groundHandling[code='Bridge On'].target.points[code='value'].value",
      context,
    )).toBe('2026-07-14T11:52:00Z')
  })

  it('keeps arbitrary JavaScript outside the safe path subset', () => {
    const context = createSFCVueRenderContext({
      rows: [{ value: 1 }],
    })

    expect(evaluateSFCExpression('rows[0].value + 1', context)).toBeUndefined()
  })
})
