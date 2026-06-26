import { Canvas, StaticCanvas, Rect, Textbox, Group } from 'fabric'
import { getPaperDimensions } from '@/lib/paperSizes'
import type { PaperSizeName, Orientation, CustomSize } from '@/store/designStore'

export const SCHEMA_VERSION = 1
const SNAP_SIZE = 10

export interface KRBCanvasData {
  schemaVersion: number
  paperSize?: PaperSizeName
  orientation?: Orientation
}

// Fabric.js Canvas with KRB metadata attached
type AnnotatedCanvas = Canvas & { data: KRBCanvasData }

export function initCanvas(
  el: HTMLCanvasElement,
  paperSize: PaperSizeName,
  orientation: Orientation,
  customSize?: CustomSize | null,
): Canvas {
  const dims = getPaperDimensions(paperSize, orientation, customSize)

  const canvas = new Canvas(el, {
    width: dims.widthPx96,
    height: dims.heightPx96,
    backgroundColor: '#ffffff',
    selection: true,
  }) as AnnotatedCanvas

  canvas.on('object:moving', (e) => {
    const obj = e.target
    if (!obj) return
    obj.set({
      left: Math.round((obj.left ?? 0) / SNAP_SIZE) * SNAP_SIZE,
      top: Math.round((obj.top ?? 0) / SNAP_SIZE) * SNAP_SIZE,
    })
  })

  canvas.data = { schemaVersion: SCHEMA_VERSION, paperSize, orientation }

  return canvas
}

export function serializeCanvas(canvas: Canvas): string {
  const json = canvas.toJSON() as Record<string, unknown>
  // Fabric.js v7 toJSON() takes no args; attach our KRB metadata manually
  const annotated = canvas as AnnotatedCanvas
  json['data'] = annotated.data ?? { schemaVersion: SCHEMA_VERSION }
  return JSON.stringify(json)
}

export async function loadCanvas(canvas: StaticCanvas, json: string): Promise<void> {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const migrated = migrateSchema(parsed)
  await canvas.loadFromJSON(JSON.stringify(migrated))
  canvas.renderAll()
}

export function migrateSchema(json: Record<string, unknown>): Record<string, unknown> {
  const data = (json['data'] as Record<string, unknown> | undefined) ?? {}
  const version = (data['schemaVersion'] as number | undefined) ?? 0

  if (version < 1) {
    json = { ...json, data: { ...data, schemaVersion: 1 } }
  }

  return json
}

export function addNumberField(canvas: Canvas): Group {
  const bg = new Rect({
    width: 200,
    height: 44,
    fill: '#EFF6FF',
    stroke: '#3B82F6',
    strokeWidth: 1.5,
    strokeDashArray: [6, 3],
    rx: 4,
    ry: 4,
    originX: 'center',
    originY: 'center',
  })

  const label = new Textbox('[REC-0001]', {
    width: 190,
    fontSize: 14,
    fontFamily: 'Courier New, monospace',
    fill: '#1D4ED8',
    textAlign: 'center',
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  })

  const group = new Group([bg, label], { left: 60, top: 60 })
  Object.assign(group, { data: { type: 'number-field' } })

  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.renderAll()

  return group
}
