export interface NumberingConfig {
  prefix: string
  start: number
  digits: number
  step: number
  suffix: string
  total: number
}

export function generateNumbers(config: NumberingConfig): string[] {
  const { prefix, start, digits, step, suffix, total } = config

  if (step < 1) throw new Error('step must be at least 1')
  if (total < 0) throw new Error('total must be 0 or greater')
  if (digits < 0) throw new Error('digits must be 0 or greater')

  const result: string[] = []
  for (let i = 0; i < total; i++) {
    const num = start + i * step
    const padded = num.toString().padStart(digits, '0')
    result.push(prefix + padded + suffix)
  }
  return result
}
