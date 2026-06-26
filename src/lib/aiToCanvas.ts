import { Canvas, Rect, Line, Textbox, Group } from 'fabric'
import { getPaperDimensions } from '@/lib/paperSizes'
import { useDesignStore } from '@/store/designStore'
import { useNumberingStore } from '@/store/numberingStore'
import type { PaperSizeName, Orientation } from '@/store/designStore'

export interface AIElement {
  type: 'text' | 'image-placeholder' | 'table' | 'line' | 'rectangle' | 'number-field' | 'blank-field'
  x: number
  y: number
  width: number
  height: number
  text?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fill?: string
  rows?: number
  cols?: number
  label?: string
}

export interface AIReceiptAnalysis {
  paperSize: PaperSizeName
  orientation: Orientation
  colors: { primary: string; accent: string; background: string }
  elements: AIElement[]
  suggestedNumberingConfig: { prefix: string; digits: number; start: number }
}

function pctToPx(pct: number, dimension: number): number {
  return Math.round((pct / 100) * dimension)
}

function buildTableGroup(el: AIElement, widthPx: number, heightPx: number): Group {
  const rows = el.rows ?? 3
  const cols = el.cols ?? 2
  const lines: Line[] = []

  // Horizontal lines
  for (let r = 0; r <= rows; r++) {
    const y = (r / rows) * heightPx - heightPx / 2
    lines.push(new Line([0, y, widthPx, y], {
      stroke: '#1A1A1A', strokeWidth: 0.5, selectable: false, evented: false,
    }))
  }
  // Vertical lines
  for (let c = 0; c <= cols; c++) {
    const x = (c / cols) * widthPx - widthPx / 2
    lines.push(new Line([x, -heightPx / 2, x, heightPx / 2], {
      stroke: '#1A1A1A', strokeWidth: 0.5, selectable: false, evented: false,
    }))
  }
  const group = new Group(lines, { left: 0, top: 0 })
  Object.assign(group, { data: { type: 'table' } })
  return group
}

function buildNumberField(el: AIElement, widthPx: number, heightPx: number): Group {
  const bg = new Rect({
    width: widthPx, height: heightPx,
    fill: '#EFF6FF', stroke: '#3B82F6', strokeWidth: 1.5, strokeDashArray: [6, 3],
    rx: 4, ry: 4, originX: 'center', originY: 'center',
  })
  const label = new Textbox('[REC-0001]', {
    width: widthPx - 10, fontSize: Math.min(el.fontSize ?? 12, heightPx * 0.5),
    fontFamily: 'Courier New, monospace', fill: '#1D4ED8',
    textAlign: 'center', originX: 'center', originY: 'center',
    selectable: false, evented: false,
  })
  const group = new Group([bg, label], { left: 0, top: 0 })
  Object.assign(group, { data: { type: 'number-field' } })
  return group
}

export async function applyAILayoutToCanvas(
  canvas: Canvas,
  analysis: AIReceiptAnalysis,
): Promise<void> {
  const designStore = useDesignStore.getState()
  const numberingStore = useNumberingStore.getState()

  // Apply paper size from AI suggestion
  const paperSize = analysis.paperSize ?? 'A5'
  const orientation = analysis.orientation ?? 'portrait'
  designStore.setPaperSize(paperSize)
  designStore.setOrientation(orientation)

  const dims = getPaperDimensions(paperSize, orientation)
  const canvasWidthPx = dims.widthPx96
  const canvasHeightPx = dims.heightPx96

  // Resize canvas
  canvas.setDimensions({ width: canvasWidthPx, height: canvasHeightPx })

  if (analysis.colors?.background) {
    canvas.set('backgroundColor', analysis.colors.background)
  }

  // Clear existing objects
  canvas.clear()

  // Add elements
  for (const el of analysis.elements) {
    const xPx = pctToPx(el.x, canvasWidthPx)
    const yPx = pctToPx(el.y, canvasHeightPx)
    const wPx = pctToPx(el.width, canvasWidthPx)
    const hPx = pctToPx(el.height, canvasHeightPx)

    if (el.type === 'number-field') {
      const group = buildNumberField(el, wPx, hPx)
      group.set({ left: xPx, top: yPx })
      canvas.add(group)

    } else if (el.type === 'table') {
      const group = buildTableGroup(el, wPx, hPx)
      group.set({ left: xPx, top: yPx })
      canvas.add(group)

    } else if (el.type === 'image-placeholder') {
      const rect = new Rect({
        left: xPx, top: yPx, width: wPx, height: hPx,
        fill: '#F5F5F5', stroke: '#CCCCCC', strokeWidth: 1,
        strokeDashArray: [6, 3], rx: 2, ry: 2,
      })
      Object.assign(rect, { data: { type: 'image-placeholder', label: el.label ?? 'Logo' } })
      canvas.add(rect)

    } else if (el.type === 'line') {
      const line = new Line([xPx, yPx, xPx + wPx, yPx + hPx], {
        stroke: el.fill ?? '#1A1A1A', strokeWidth: 1,
      })
      canvas.add(line)

    } else if (el.type === 'rectangle') {
      const rect = new Rect({
        left: xPx, top: yPx, width: wPx, height: hPx,
        fill: el.fill ?? '#ffffff', stroke: '#1A1A1A', strokeWidth: 1,
      })
      canvas.add(rect)

    } else if (el.type === 'text' || el.type === 'blank-field') {
      const displayText = el.type === 'blank-field'
        ? (el.label ?? 'Fill in')
        : (el.text ?? '')

      const textbox = new Textbox(displayText, {
        left: xPx, top: yPx, width: wPx,
        fontSize: el.fontSize ?? 12,
        fontWeight: el.fontWeight ?? 'normal',
        fill: el.fill ?? '#1A1A1A',
      })

      if (el.type === 'blank-field') {
        textbox.set({ underline: true, fill: '#7A7A7A' })
        Object.assign(textbox, { data: { type: 'blank-field', label: el.label } })
      }

      canvas.add(textbox)
    }
  }

  // Apply numbering config from AI suggestion
  if (analysis.suggestedNumberingConfig) {
    const { prefix, digits, start } = analysis.suggestedNumberingConfig
    numberingStore.setConfig({ prefix, digits, start })
  }

  canvas.renderAll()
}

export async function generateFromImage(imageBase64: string, mimeType: string): Promise<AIReceiptAnalysis> {
  const { supabase } = await import('@/lib/supabase')
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Must be signed in')

  const response = await fetch('/api/ai/generate-receipt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ imageBase64, mimeType }),
  })

  if (response.status === 429) {
    const data = await response.json() as { message: string; upgradeRequired?: boolean }
    const err = new Error(data.message)
    ;(err as Error & { upgradeRequired?: boolean }).upgradeRequired = data.upgradeRequired
    throw err
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(data.message ?? 'AI generation failed')
  }

  return response.json() as Promise<AIReceiptAnalysis>
}
