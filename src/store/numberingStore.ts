import { create } from 'zustand'

export interface NumberingConfig {
  prefix: string
  start: number
  digits: number
  step: number
  suffix: string
  total: number
}

interface NumberingState extends NumberingConfig {
  numberingEnabled: boolean
  booksCount: number
  itemsPerBook: number
  copiesPerItem: 1 | 2 | 3
  setPrefix: (prefix: string) => void
  setStart: (start: number) => void
  setDigits: (digits: number) => void
  setStep: (step: number) => void
  setSuffix: (suffix: string) => void
  setTotal: (total: number) => void
  setConfig: (config: Partial<NumberingConfig>) => void
  setNumberingEnabled: (enabled: boolean) => void
  setBooksCount: (n: number) => void
  setItemsPerBook: (n: number) => void
  setCopiesPerItem: (n: 1 | 2 | 3) => void
}

const DEFAULT_CONFIG: NumberingConfig = {
  prefix: 'REC-',
  start: 1,
  digits: 4,
  step: 1,
  suffix: '',
  total: 50,
}

export const useNumberingStore = create<NumberingState>((set) => ({
  ...DEFAULT_CONFIG,
  numberingEnabled: true,
  booksCount: 1,
  itemsPerBook: 50,
  copiesPerItem: 1,

  setPrefix: (prefix) => set({ prefix }),
  setStart: (start) => set({ start }),
  setDigits: (digits) => set({ digits }),
  setStep: (step) => set({ step }),
  setSuffix: (suffix) => set({ suffix }),
  setTotal: (total) => set({ total }),
  setConfig: (config) => set(config),
  setNumberingEnabled: (enabled) => set({ numberingEnabled: enabled }),
  setBooksCount: (n) => set({ booksCount: n }),
  setItemsPerBook: (n) => set({ itemsPerBook: n }),
  setCopiesPerItem: (n) => set({ copiesPerItem: n }),
}))
