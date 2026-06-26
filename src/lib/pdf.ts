import { PDFDocument, PDFPage, rgb, StandardFonts, degrees } from 'pdf-lib'
import { getPaperDimensions, getSlotGrid, mmToPt } from '@/lib/paperSizes'
import type { ReceiptsPerPage } from '@/lib/paperSizes'
import { generateNumbers } from '@/lib/numbering'
import type { NumberingConfig } from '@/lib/numbering'
import type { PaperSizeName, Orientation, PerforationLine } from '@/store/designStore'

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
  receiptsPerPage?: ReceiptsPerPage
  numberingEnabled?: boolean
  twoUpOrientation?: 'h' | 'v'
  perforationLines?: PerforationLine[]
}

export function mmToCropPt(mm: number): number {
  return mmToPt(mm)
}

// Hairline crop marks 3mm outside the trim edge, extending 5mm further out.
export function drawCropMarks(page: PDFPage, trimBox: Box, bleedMm = 3): void {
  const bleedPt = mmToPt(bleedMm)
  const markLen = mmToPt(5)
  const { x, y, width, height } = trimBox

  const left = x
  const right = x + width
  const bottom = y
  const top = y + height

  const hairline = 0.25

  const lines: [number, number, number, number][] = [
    [left - bleedPt - markLen, top, left - bleedPt, top],
    [left, top + bleedPt, left, top + bleedPt + markLen],
    [right + bleedPt, top, right + bleedPt + markLen, top],
    [right, top + bleedPt, right, top + bleedPt + markLen],
    [left - bleedPt - markLen, bottom, left - bleedPt, bottom],
    [left, bottom - bleedPt, left, bottom - bleedPt - markLen],
    [right + bleedPt, bottom, right + bleedPt + markLen, bottom],
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
  slotOffsetXPt: number,
  slotOffsetYPt: number,
  slotHeightPt: number,
): Promise<void> {
  const font = await doc.embedFont(StandardFonts.Helvetica)

  for (const obj of objects) {
    const scaleX = obj.scaleX ?? 1
    const scaleY = obj.scaleY ?? 1
    const wPt = pxToPt(obj.width * scaleX)
    const hPt = pxToPt(obj.height * scaleY)
    const xPt = slotOffsetXPt + pxToPt(obj.left)
    // Y-flip is relative to the slot height, then offset by the slot's Y position
    const yPt = slotOffsetYPt + (slotHeightPt - pxToPt(obj.top) - hPt)

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

function drawSlotDividers(page: PDFPage, trimBox: Box, cols: number, rows: number): void {
  const slotW = trimBox.width / cols
  const slotH = trimBox.height / rows
  const gray = rgb(0.7, 0.7, 0.7)

  for (let c = 1; c < cols; c++) {
    page.drawLine({
      start: { x: trimBox.x + c * slotW, y: trimBox.y },
      end: { x: trimBox.x + c * slotW, y: trimBox.y + trimBox.height },
      thickness: 0.25,
      color: gray,
    })
  }
  for (let r = 1; r < rows; r++) {
    page.drawLine({
      start: { x: trimBox.x, y: trimBox.y + r * slotH },
      end: { x: trimBox.x + trimBox.width, y: trimBox.y + r * slotH },
      thickness: 0.25,
      color: gray,
    })
  }
}

function drawPerforationLinesPDF(
  page: PDFPage,
  trimBox: Box,
  lines: PerforationLine[],
): void {
  const MM_TO_PT = 72 / 25.4
  for (const line of lines) {
    const posPt = line.positionMm * MM_TO_PT
    const gray = rgb(0.5, 0.5, 0.5)
    if (line.style === 'dashes') {
      // Draw dashed line across the trim area
      const dashLen = 4
      const gapLen = 3
      if (line.axis === 'h') {
        // Horizontal line at posPt from bottom of trim box
        const y = trimBox.y + posPt
        let x = trimBox.x
        while (x < trimBox.x + trimBox.width) {
          page.drawLine({
            start: { x, y },
            end: { x: Math.min(x + dashLen, trimBox.x + trimBox.width), y },
            thickness: 0.5,
            color: gray,
          })
          x += dashLen + gapLen
        }
      } else {
        // Vertical line at posPt from left of trim box
        const x = trimBox.x + posPt
        let y = trimBox.y
        while (y < trimBox.y + trimBox.height) {
          page.drawLine({
            start: { x, y },
            end: { x, y: Math.min(y + dashLen, trimBox.y + trimBox.height) },
            thickness: 0.5,
            color: gray,
          })
          y += dashLen + gapLen
        }
      }
    } else {
      // Corner marks only
      const tickLen = 8
      if (line.axis === 'h') {
        const y = trimBox.y + posPt
        page.drawLine({ start: { x: trimBox.x, y }, end: { x: trimBox.x + tickLen, y }, thickness: 0.5, color: gray })
        page.drawLine({ start: { x: trimBox.x + trimBox.width - tickLen, y }, end: { x: trimBox.x + trimBox.width, y }, thickness: 0.5, color: gray })
      } else {
        const x = trimBox.x + posPt
        page.drawLine({ start: { x, y: trimBox.y }, end: { x, y: trimBox.y + tickLen }, thickness: 0.5, color: gray })
        page.drawLine({ start: { x, y: trimBox.y + trimBox.height - tickLen }, end: { x, y: trimBox.y + trimBox.height }, thickness: 0.5, color: gray })
      }
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
  const {
    paperSize, orientation, bleedEnabled, cropMarks, watermark,
    numbering, canvasObjects, customSize,
    receiptsPerPage = 1,
    numberingEnabled = true,
    twoUpOrientation = 'v',
    perforationLines = [],
  } = config

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

  const { cols, rows } = getSlotGrid(receiptsPerPage, orientation, twoUpOrientation)
  const slotWPt = trimWidthPt / cols
  const slotHPt = trimHeightPt / rows
  const pdfPageCount = Math.ceil(numbering.total / receiptsPerPage)

  const doc = await PDFDocument.create()
  doc.setCreator('Kaynko Receipt Book')
  doc.setProducer('KRB / pdf-lib')

  const numbers = generateNumbers(numbering)

  for (let pageIdx = 0; pageIdx < pdfPageCount; pageIdx++) {
    const page = doc.addPage([pageWidthPt, pageHeightPt])

    if (bleedEnabled) {
      page.drawRectangle({
        x: 0, y: 0,
        width: pageWidthPt, height: pageHeightPt,
        color: rgb(1, 1, 1),
      })
    }

    for (let slotIdx = 0; slotIdx < receiptsPerPage; slotIdx++) {
      const receiptIdx = pageIdx * receiptsPerPage + slotIdx
      if (receiptIdx >= numbering.total) break

      const col = slotIdx % cols
      const row = Math.floor(slotIdx / cols)

      // PDF Y=0 is bottom; row 0 = top = highest Y in PDF coords
      const slotOffsetXPt = bleedPt + col * slotWPt
      const slotOffsetYPt = bleedPt + (rows - 1 - row) * slotHPt

      const effectiveNumber = numberingEnabled ? numbers[receiptIdx] : numbers[0]

      await renderObjectsToPage(
        page, doc, canvasObjects, effectiveNumber,
        slotOffsetXPt, slotOffsetYPt, slotHPt,
      )
    }

    if (receiptsPerPage > 1) {
      drawSlotDividers(page, trimBox, cols, rows)
    }

    if (perforationLines.length > 0) {
      drawPerforationLinesPDF(page, trimBox, perforationLines)
    }

    if (cropMarks) {
      drawCropMarks(page, trimBox, bleedMm > 0 ? bleedMm : 3)
    }

    if (watermark) {
      await drawWatermark(page, doc)
    }
  }

  return doc.save()
}
