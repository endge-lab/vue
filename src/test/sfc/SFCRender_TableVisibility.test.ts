import { describe, expect, it } from 'vitest'

import {
  createInitialTableVisibility,
  filterVisibleTableColumns,
} from '@/ui/render/sfc/SFCRender_Table'

describe('SFC RevoGrid table visibility', () => {
  const columns = [
    { key: 'flight' },
    { key: 'gate' },
    { key: 'status' },
  ]

  it('creates a sparse visibility map from default-hidden keys', () => {
    expect(createInitialTableVisibility(['gate', 'missing'], columns)).toEqual({
      gate: false,
    })
  })

  it('keeps visible columns in their source order', () => {
    expect(filterVisibleTableColumns(columns, { gate: false })).toEqual([
      { key: 'flight' },
      { key: 'status' },
    ])
  })
})
