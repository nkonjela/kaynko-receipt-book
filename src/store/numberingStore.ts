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
  setPrefix: (prefix: string) => void
  setStart: (start: number) => void
  setDigits: (digits: number) => void
  setStep: (step: number) => void
  setSuffix: (suffix: string) => void
  setTotal: (total: number) => void
  setConfig: (config: Partial<NumberingConfig>) => void
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

  setPrefix: (prefix) => set({ prefix }),
  setStart: (start) => set({ start }),
  setDigits: (digits) => set({ digits }),
  setStep: (step) => set({ step }),
  setSuffix: (suffix) => set({ suffix }),
  setTotal: (total) => set({ total }),
  setConfig: (config) => set(config),
}))
