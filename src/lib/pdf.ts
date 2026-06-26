import { PDFDocument, PDFPage, rgb, StandardFonts, degrees } from 'pdf-lib'
import { getPaperDimensions, mmToPt } from '@/lib/paperSizes'
import { generateNumbers } from '@/lib/numbering'
import type { NumberingConfig } from '@/lib/numbering'
import type { PaperSizeName, Orientation } from '@/store/designStore'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface CanvasObject {
  type: string
  left: number
  top: number
  width: number
  height: number
  scaleX?: number
  scaleY?: number
  text?: string
  fontSize?: number
  fill?: string
  data?: { type?: string }
}

export interface ExportConfig {
  paperSize: PaperSizeName
  orientation: Orientation
  bleedEnabled: boolean
  cropMarks: boolean
  watermark: boolean
  cmyk: boolean
  numbering: NumberingConfig
  canvasObjects: CanvasObject[]
  customSize?: { widthMm: number; heightMm: number } | null
}

export function mmToCropPt(mm: number): number {
  return mmToPt(mm)
}

// Hairline crop marks 3mm outside the trim edge, extending 5mm further out.
// bleedMm is ADDED to the trim offset so marks are always outside the trim.
export function drawCropMarks(page: PDFPage, trimBox: Box, bleedMm = 3): void {
  const bleedPt = mmToPt(bleedMm)
  const markLen = mmToPt(5) // 5mm mark length
  const { x, y, width, height } = trimBox

  // In PDF coordinates, Y=0 is at the BOTTOM
  const left = x
  const right = x + width
  const bottom = y
  const top = y + height

  const hairline = 0.25

  const lines: [number, number, number, number][] = [
    // top-left corner: horizontal
    [left - bleedPt - markLen, top, left - bleedPt, top],
    // top-left corner: vertical
    [left, top + bleedPt, left, top + bleedPt + markLen],
    // top-right corner: horizontal
    [right + bleedPt, top, right + bleedPt + markLen, top],
    // top-right corner: vertical
    [right, top + bleedPt, right, top + bleedPt + markLen],
    // bottom-left corner: horizontal
    [left - bleedPt - markLen, bottom, left - bleedPt, bottom],
    // bottom-left corner: vertical
    [left, bottom - bleedPt, left, bottom - bleedPt - markLen],
    // bottom-right corner: horizontal
    [right + bleedPt, bottom, right + bleedPt + markLen, bottom],
    // bottom-right corner: vertical
    [right, bottom - bleedPt, right, bottom - bleedPt - markLen],
  ]

  for (const [x1, y1, x2, y2] of lines) {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: hairline,
      color: rgb(0, 0, 0),
    })
  }
}

function pxToPt(px: number, dpi = 96): number {
  return px * (72 / dpi)
}

function flipY(yPx: number, pageHeightPt: number, objHeightPx: number): number {
  return pageHeightPt - pxToPt(yPx) - pxToPt(objHeightPx)
}

async function drawWatermark(page: PDFPage, doc: PDFDocument): Promise<void> {
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  page.drawText('WATERMARK — UPGRADE TO EXPORT', {
    x: width / 2 - 150,
    y: height / 2,
    size: 18,
    font,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(45),
    opacity: 0.5,
  })
}

async function renderObjectsToPage(
  page: PDFPage,
  doc: PDFDocument,
  objects: CanvasObject[],
  pageNumber: string,
  pageHeightPt: number,
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica)

  for (const obj of objects) {
    const scaleX = obj.scaleX ?? 1
    const scaleY = obj.scaleY ?? 1
    const wPt = pxToPt(obj.width * scaleX)
    const hPt = pxToPt(obj.height * scaleY)
    const xPt = pxToPt(obj.left)
    const yPt = flipY(obj.top, pageHeightPt, obj.height * scaleY)

    if (obj.data?.type === 'number-field') {
      page.drawText(pageNumber, {
        x: xPt,
        y: yPt + hPt / 2,
        size: 12,
        font,
        color: rgb(0.11, 0.31, 0.87),
      })
    } else if (obj.type === 'textbox' || obj.type === 'i-text' || obj.type === 'text') {
      const text = obj.text ?? ''
      const size = obj.fontSize ?? 14
      const fillColor = parseColor(obj.fill)
      page.drawText(text, { x: xPt, y: yPt, size, font, color: fillColor })
    } else if (obj.type === 'rect') {
      const fillColor = parseColor(obj.fill)
      page.drawRectangle({ x: xPt, y: yPt, width: wPt, height: hPt, color: fillColor })
    }
  }
}

function parseColor(fill?: string): ReturnType<typeof rgb> {
  if (!fill || fill === 'transparent') return rgb(0, 0, 0)
  if (fill.startsWith('#')) {
    const hex = fill.slice(1)
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    return rgb(r, g, b)
  }
  return rgb(0, 0, 0)
}

export async function exportPDF(config: ExportConfig): Promise<Uint8Array> {
  const { paperSize, orientation, bleedEnabled, cropMarks, watermark, numbering, canvasObjects, customSize } = config

  const dims = getPaperDimensions(paperSize, orientation, customSize)
  const bleedMm = bleedEnabled ? 3 : 0
  const bleedPt = mmToPt(bleedMm)

  const trimWidthPt = mmToPt(dims.widthMm)
  const trimHeightPt = mmToPt(dims.heightMm)
  const pageWidthPt = trimWidthPt + bleedPt * 2
  const pageHeightPt = trimHeightPt + bleedPt * 2

  const trimBox: Box = {
    x: bleedPt,
    y: bleedPt,
    width: trimWidthPt,
    height: trimHeightPt,
  }

  const doc = await PDFDocument.create()
  doc.setCreator('Kaynko Receipt Book')
  doc.setProducer('KRB / pdf-lib')

  const numbers = generateNumbers(numbering)

  for (let i = 0; i < numbering.total; i++) {
    const page = doc.addPage([pageWidthPt, pageHeightPt])

    if (bleedEnabled) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidthPt,
        height: pageHeightPt,
        color: rgb(1, 1, 1),
      })
    }

    await renderObjectsToPage(page, doc, canvasObjects, numbers[i], pageHeightPt)

    if (cropMarks) {
      drawCropMarks(page, trimBox, bleedMm > 0 ? bleedMm : 3)
    }

    if (watermark) {
      await drawWatermark(page, doc)
    }
  }

  return doc.save()
}
