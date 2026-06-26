import { PDFDocument, PDFPage } from 'pdf-lib'
import { drawCropMarks, mmToCropPt, type Box } from './pdf'

// ─── drawCropMarks unit tests ─────────────────────────────────────────────────

describe('mmToCropPt', () => {
  it('converts mm to PDF points (1mm = 72/25.4 pt)', () => {
    expect(mmToCropPt(25.4)).toBeCloseTo(72, 2)
    expect(mmToCropPt(1)).toBeCloseTo(72 / 25.4, 4)
  })

  it('3mm converts to approximately 8.504 pt', () => {
    expect(mmToCropPt(3)).toBeCloseTo(8.504, 2)
  })
})

describe('drawCropMarks', () => {
  let page: PDFPage

  beforeEach(async () => {
    const doc = await PDFDocument.create()
    page = doc.addPage([200, 300]) // 200pt × 300pt page
  })

  it('does not throw for a valid trim box with 3mm bleed', () => {
    const trimBox: Box = { x: 0, y: 0, width: 200, height: 300 }
    expect(() => drawCropMarks(page, trimBox)).not.toThrow()
  })

  it('does not throw with explicit bleedMm', () => {
    const trimBox: Box = { x: 0, y: 0, width: 200, height: 300 }
    expect(() => drawCropMarks(page, trimBox, 3)).not.toThrow()
  })

  it('accepts a trim box inset from the page edge (bleed already added to page size)', () => {
    // Page is 200+6=206 pt wide (3mm bleed each side = ~8.5pt each)
    const bleedPt = mmToCropPt(3)
    const page2Ref = { drawLine: vi.fn(), getWidth: () => 200 + bleedPt * 2, getHeight: () => 300 + bleedPt * 2 } as unknown as PDFPage
    const trimBox: Box = { x: bleedPt, y: bleedPt, width: 200, height: 300 }
    expect(() => drawCropMarks(page2Ref, trimBox, 3)).not.toThrow()
  })
})

// ─── exportPDF integration test ───────────────────────────────────────────────

import { exportPDF, type ExportConfig } from './pdf'

describe('exportPDF', () => {
  it('returns a Uint8Array starting with %PDF-', async () => {
    const config: ExportConfig = {
      paperSize: 'A5',
      orientation: 'portrait',
      bleedEnabled: false,
      cropMarks: false,
      watermark: false,
      cmyk: false,
      numbering: { prefix: 'TST-', start: 1, digits: 3, step: 1, suffix: '', total: 3 },
      canvasObjects: [],
    }

    const bytes = await exportPDF(config)
    expect(bytes).toBeInstanceOf(Uint8Array)

    const header = new TextDecoder().decode(bytes.slice(0, 8))
    expect(header).toMatch(/^%PDF-/)
  }, 15000)

  it('produces the correct number of pages', async () => {
    const config: ExportConfig = {
      paperSize: 'A6',
      orientation: 'portrait',
      bleedEnabled: false,
      cropMarks: false,
      watermark: false,
      cmyk: false,
      numbering: { prefix: '', start: 1, digits: 4, step: 1, suffix: '', total: 5 },
      canvasObjects: [],
    }

    const bytes = await exportPDF(config)
    const reloaded = await PDFDocument.load(bytes)
    expect(reloaded.getPageCount()).toBe(5)
  }, 15000)

  it('page dimensions match the paper size (A5 portrait ≈ 420×595 pt)', async () => {
    const config: ExportConfig = {
      paperSize: 'A5',
      orientation: 'portrait',
      bleedEnabled: false,
      cropMarks: false,
      watermark: false,
      cmyk: false,
      numbering: { prefix: '', start: 1, digits: 1, step: 1, suffix: '', total: 1 },
      canvasObjects: [],
    }

    const bytes = await exportPDF(config)
    const reloaded = await PDFDocument.load(bytes)
    const { width, height } = reloaded.getPage(0).getSize()
    // A5 = 148×210mm → 419.5×595.3 pt (allow ±2pt rounding)
    expect(width).toBeGreaterThan(417)
    expect(width).toBeLessThan(422)
    expect(height).toBeGreaterThan(593)
    expect(height).toBeLessThan(598)
  }, 15000)

  it('crop marks flag does not crash', async () => {
    const config: ExportConfig = {
      paperSize: 'A6',
      orientation: 'portrait',
      bleedEnabled: true,
      cropMarks: true,
      watermark: false,
      cmyk: false,
      numbering: { prefix: 'REC-', start: 1, digits: 4, step: 1, suffix: '', total: 2 },
      canvasObjects: [],
    }
    await expect(exportPDF(config)).resolves.toBeInstanceOf(Uint8Array)
  }, 15000)

  it('watermark flag does not crash', async () => {
    const config: ExportConfig = {
      paperSize: 'A6',
      orientation: 'portrait',
      bleedEnabled: false,
      cropMarks: false,
      watermark: true,
      cmyk: false,
      numbering: { prefix: '', start: 1, digits: 1, step: 1, suffix: '', total: 1 },
      canvasObjects: [],
    }
    await expect(exportPDF(config)).resolves.toBeInstanceOf(Uint8Array)
  }, 15000)
})
