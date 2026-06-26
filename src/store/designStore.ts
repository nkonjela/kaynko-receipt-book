import { create } from 'zustand'

export type PaperSizeName =
  | 'A4' | 'A5' | 'A6'
  | 'US Letter' | 'Half Letter'
  | 'Slip/Register' | '3-up A4'
  | 'Custom'

export type Orientation = 'portrait' | 'landscape'

export interface CustomSize {
  widthMm: number
  heightMm: number
}

interface DesignState {
  designId: string | null
  name: string
  canvasJson: string | null
  paperSize: PaperSizeName
  orientation: Orientation
  customSize: CustomSize | null
  bleedEnabled: boolean
  showSafeZone: boolean
  history: string[]
  historyIndex: number

  setDesignId: (id: string | null) => void
  setName: (name: string) => void
  setCanvasJson: (json: string) => void
  setPaperSize: (size: PaperSizeName) => void
  setOrientation: (orientation: Orientation) => void
  setCustomSize: (size: CustomSize | null) => void
  setBleedEnabled: (enabled: boolean) => void
  setShowSafeZone: (show: boolean) => void
  pushHistory: (json: string) => void
  undo: () => string | null
  redo: () => string | null
  reset: () => void
}

const DEFAULT_STATE = {
  designId: null,
  name: 'Untitled Design',
  canvasJson: null,
  paperSize: 'A4' as PaperSizeName,
  orientation: 'portrait' as Orientation,
  customSize: null,
  bleedEnabled: true,
  showSafeZone: true,
  history: [],
  historyIndex: -1,
}

export const useDesignStore = create<DesignState>((set, get) => ({
  ...DEFAULT_STATE,

  setDesignId: (id) => set({ designId: id }),
  setName: (name) => set({ name }),
  setCanvasJson: (json) => set({ canvasJson: json }),
  setPaperSize: (size) => set({ paperSize: size }),
  setOrientation: (orientation) => set({ orientation }),
  setCustomSize: (size) => set({ customSize: size }),
  setBleedEnabled: (enabled) => set({ bleedEnabled: enabled }),
  setShowSafeZone: (show) => set({ showSafeZone: show }),

  pushHistory: (json) => {
    const { history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(json)
    set({ history: newHistory, historyIndex: newHistory.length - 1, canvasJson: json })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex <= 0) return null
    const newIndex = historyIndex - 1
    set({ historyIndex: newIndex, canvasJson: history[newIndex] })
    return history[newIndex]
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex >= history.length - 1) return null
    const newIndex = historyIndex + 1
    set({ historyIndex: newIndex, canvasJson: history[newIndex] })
    return history[newIndex]
  },

  reset: () => set(DEFAULT_STATE),
}))
