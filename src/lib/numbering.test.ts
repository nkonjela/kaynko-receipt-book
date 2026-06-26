import { generateNumbers, type NumberingConfig } from './numbering'

function cfg(overrides: Partial<NumberingConfig>): NumberingConfig {
  return { prefix: 'REC-', start: 1, digits: 4, step: 1, suffix: '', total: 5, ...overrides }
}

describe('generateNumbers — basic output', () => {
  it('returns an array with length equal to total', () => {
    const result = generateNumbers(cfg({ total: 5 }))
    expect(result).toHaveLength(5)
  })

  it('formats first entry as prefix + zero-padded start + suffix', () => {
    expect(generateNumbers(cfg({ total: 1 }))[0]).toBe('REC-0001')
  })

  it('increments by step=1 across pages', () => {
    const result = generateNumbers(cfg({ total: 3 }))
    expect(result).toEqual(['REC-0001', 'REC-0002', 'REC-0003'])
  })

  it('applies prefix and suffix correctly', () => {
    const result = generateNumbers(cfg({ prefix: 'INV/', suffix: '/2024', total: 2 }))
    expect(result).toEqual(['INV/0001/2024', 'INV/0002/2024'])
  })
})

describe('generateNumbers — start=0 edge case', () => {
  it('produces REC-0000 as the first entry when start=0', () => {
    const result = generateNumbers(cfg({ start: 0, total: 3 }))
    expect(result[0]).toBe('REC-0000')
    expect(result[1]).toBe('REC-0001')
    expect(result[2]).toBe('REC-0002')
  })
})

describe('generateNumbers — step=2 for NCR duplicate books', () => {
  it('skips every other number when step=2', () => {
    const result = generateNumbers(cfg({ step: 2, total: 3 }))
    expect(result).toEqual(['REC-0001', 'REC-0003', 'REC-0005'])
  })

  it('output array length still equals total regardless of step', () => {
    expect(generateNumbers(cfg({ step: 2, total: 10 }))).toHaveLength(10)
  })

  it('start=1 step=2: numbers are 1,3,5,...', () => {
    const result = generateNumbers(cfg({ start: 1, step: 2, total: 5 }))
    expect(result).toEqual(['REC-0001', 'REC-0003', 'REC-0005', 'REC-0007', 'REC-0009'])
  })
})

describe('generateNumbers — digits edge cases', () => {
  it('does not truncate numbers wider than digits (digits=1 start=100)', () => {
    const result = generateNumbers(cfg({ digits: 1, start: 100, total: 2 }))
    expect(result[0]).toBe('REC-100')
    expect(result[1]).toBe('REC-101')
  })

  it('pads correctly when number is shorter than digits', () => {
    const result = generateNumbers(cfg({ digits: 6, start: 1, total: 1 }))
    expect(result[0]).toBe('REC-000001')
  })

  it('digits=0 — no padding applied', () => {
    const result = generateNumbers(cfg({ digits: 0, start: 42, total: 1 }))
    expect(result[0]).toBe('REC-42')
  })
})

describe('generateNumbers — total edge cases', () => {
  it('returns empty array when total=0', () => {
    expect(generateNumbers(cfg({ total: 0 }))).toEqual([])
  })

  it('returns exactly 1000 entries when total=1000', () => {
    const result = generateNumbers(cfg({ total: 1000 }))
    expect(result).toHaveLength(1000)
    expect(result[999]).toBe('REC-1000')
  })
})

describe('generateNumbers — empty prefix/suffix', () => {
  it('with empty prefix and suffix, returns just the zero-padded number', () => {
    const result = generateNumbers(cfg({ prefix: '', suffix: '', total: 3 }))
    expect(result).toEqual(['0001', '0002', '0003'])
  })

  it('with empty prefix only', () => {
    const result = generateNumbers(cfg({ prefix: '', suffix: '!', total: 1 }))
    expect(result[0]).toBe('0001!')
  })
})

describe('generateNumbers — validation errors', () => {
  it('throws a clear error when step < 1', () => {
    expect(() => generateNumbers(cfg({ step: 0 }))).toThrow(/step.*must be.*1/i)
  })

  it('throws when step is negative', () => {
    expect(() => generateNumbers(cfg({ step: -1 }))).toThrow(/step.*must be.*1/i)
  })

  it('throws a clear error when total is negative', () => {
    expect(() => generateNumbers(cfg({ total: -1 }))).toThrow(/total.*must be.*0/i)
  })

  it('throws when digits is negative', () => {
    expect(() => generateNumbers(cfg({ digits: -1 }))).toThrow(/digits.*must be.*0/i)
  })
})

describe('generateNumbers — large step values', () => {
  it('step=10 produces correct sequence', () => {
    const result = generateNumbers(cfg({ step: 10, total: 3, digits: 3 }))
    expect(result).toEqual(['REC-001', 'REC-011', 'REC-021'])
  })
})
