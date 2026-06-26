import type { PaperSizeName, Orientation, CustomSize } from '@/store/designStore'

export interface PaperDimensions {
  widthMm: number
  heightMm: number
  widthPx96: number
  heightPx96: number
  widthPx300: number
  heightPx300: number
}

const MM_TO_PX_96 = 96 / 25.4
const MM_TO_PX_300 = 300 / 25.4

function mmToDim(widthMm: number, heightMm: number): PaperDimensions {
  return {
    widthMm,
    heightMm,
    widthPx96: Math.round(widthMm * MM_TO_PX_96),
    heightPx96: Math.round(heightMm * MM_TO_PX_96),
    widthPx300: Math.round(widthMm * MM_TO_PX_300),
    heightPx300: Math.round(heightMm * MM_TO_PX_300),
  }
}

const PAPER_SIZES: Record<Exclude<PaperSizeName, 'Custom'>, PaperDimensions> = {
  'A4': mmToDim(210, 297),
  'A5': mmToDim(148, 210),
  'A6': mmToDim(105, 148),
  'US Letter': mmToDim(215.9, 279.4),
  'Half Letter': mmToDim(139.7, 215.9),
  'Slip/Register': mmToDim(215.9, 83.8),
  '3-up A4': mmToDim(210, 297),
}

export function getPaperDimensions(
  size: PaperSizeName,
  orientation: Orientation,
  custom?: CustomSize | null,
): PaperDimensions {
  let base: PaperDimensions

  if (size === 'Custom') {
    if (!custom) throw new Error('Custom paper size requires custom dimensions')
    base = mmToDim(custom.widthMm, custom.heightMm)
  } else {
    base = PAPER_SIZES[size]
  }

  if (orientation === 'landscape' && base.widthMm < base.heightMm) {
    return mmToDim(base.heightMm, base.widthMm)
  }
  if (orientation === 'portrait' && base.widthMm > base.heightMm) {
    return mmToDim(base.heightMm, base.widthMm)
  }

  return base
}

export function mmToPt(mm: number): number {
  return mm * (72 / 25.4)
}

export function pxToPt(px: number, dpi = 96): number {
  return px * (72 / dpi)
}
