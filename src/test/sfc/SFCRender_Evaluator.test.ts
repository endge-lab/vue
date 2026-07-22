import { describe, expect, it } from 'vitest'
import type { RComponentSFC_IR_Value } from '@endge/core'
import { createSFCVueRenderContext } from '@/ui/render/sfc/SFCRender_Context'
import {
  evaluateSFCExpression,
  evaluateSFCValue,
  readSFCObjectPath,
  readSFCPath,
} from '@/ui/render/sfc/SFCRender_Evaluator'

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

  it('evaluates logical and nullish expressions with short-circuit semantics', () => {
    const context = createSFCVueRenderContext({
      carrier: 'SU',
      number: '1418',
      empty: '',
    })

    expect(evaluateSFCExpression('carrier || number', context)).toBe('SU')
    expect(evaluateSFCExpression('empty || number', context)).toBe('1418')
    expect(evaluateSFCExpression('carrier && number', context)).toBe('1418')
    expect(evaluateSFCExpression('missing ?? number', context)).toBe('1418')
  })

  it('evaluates optional access and conditional expressions', () => {
    const context = createSFCVueRenderContext({
      comment: { text: 'Memo' },
      fresh: true,
      scheduledTime: { fresh: true },
      cancelled: {},
    })

    expect(evaluateSFCExpression('comment?.text', context)).toBe('Memo')
    expect(evaluateSFCExpression('missing?.text', context)).toBeUndefined()
    expect(evaluateSFCExpression("fresh ? '700' : '400'", context)).toBe('700')
    expect(
      evaluateSFCExpression("scheduledTime?.fresh || cancelled?.fresh ? '700' : '600'", context),
    ).toBe('700')
  })

  it('evaluates comparison and arithmetic expressions', () => {
    const context = createSFCVueRenderContext({
      delay: 15,
      status: 'ready',
      count: 2,
    })

    expect(evaluateSFCExpression("delay > 0 && status !== 'cancelled'", context)).toBe(true)
    expect(evaluateSFCExpression('count + 1', context)).toBe(3)
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

    expect(evaluateSFCExpression("row.departureLeg.attributes[name='ACTail'].text", context)).toBe(
      '73151',
    )
    expect(readSFCObjectPath(
      "departureLeg.attributes[name='ACTail'].text",
      context.locals.row,
    )).toBe('73151')
  })

  it('reads nested selectors containing spaces', () => {
    const context = createSFCVueRenderContext({
      rows: [
        {
          groundHandling: [
            {
              code: 'Bridge On',
              target: {
                points: [{ code: 'value', value: '2026-07-14T11:52:00Z' }],
              },
            },
          ],
        },
      ],
    })

    expect(
      readSFCPath(
        "rows[0].groundHandling[code='Bridge On'].target.points[code='value'].value",
        context,
      ),
    ).toBe('2026-07-14T11:52:00Z')
  })

  it('combines Endge selectors with logical and optional expressions', () => {
    const context = createSFCVueRenderContext({})
    context.locals.row = {
      attributes: [{ name: 'ACTail', text: '73151' }],
    }

    expect(evaluateSFCExpression("row.attributes[name='ACTail']?.text || '—'", context)).toBe(
      '73151',
    )
  })

  it('allows only explicitly supported pure calls', () => {
    const context = createSFCVueRenderContext({
      status: ' READY ',
      stations: ['SVO', 'LED'],
    })

    expect(evaluateSFCExpression("status.trim().toLowerCase() === 'ready'", context)).toBe(true)
    expect(evaluateSFCExpression("stations.includes('SVO')", context)).toBe(true)
    expect(evaluateSFCExpression('Math.max(1, 5, 3)', context)).toBe(5)
  })

  it('rejects arbitrary calls, assignments and prototype access', () => {
    let called = false
    const context = createSFCVueRenderContext({
      ready: false,
      dangerous: () => {
        called = true
        return true
      },
      value: {},
    })

    expect(evaluateSFCExpression('dangerous()', context)).toBeUndefined()
    expect(evaluateSFCExpression('ready = true', context)).toBeUndefined()
    expect(
      evaluateSFCExpression("value.constructor.constructor('return globalThis')()", context),
    ).toBeUndefined()
    expect(context.props.ready).toBe(false)
    expect(called).toBe(false)
  })
})
