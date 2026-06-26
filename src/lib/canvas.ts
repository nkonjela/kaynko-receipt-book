import { Canvas, StaticCanvas, Rect, Textbox, Group, Ellipse, Line, Point, FabricText } from 'fabric'
import type { FabricObject } from 'fabric'
import { getPaperDimensions, getSlotDimensions } from '@/lib/paperSizes'
import type { ReceiptsPerPage } from '@/lib/paperSizes'
import { computeGuides, drawGuides } from '@/lib/guides'
import type { GuideLineSpec } from '@/lib/guides'
import type { PaperSizeName, Orientation, CustomSize } from '@/store/designStore'

export const SCHEMA_VERSION = 1
const SNAP_SIZE = 10
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4.0

export interface KRBCanvasData {
  schemaVersion: number
  paperSize?: PaperSizeName
  orientation?: Orientation
}

type AnnotatedCanvas = Canvas & { data: KRBCanvasData }

export function centrePos(canvas: Canvas, objW: number, objH: number) {
  return {
    left: Math.round(canvas.width / 2 - objW / 2),
    top: Math.round(canvas.height / 2 - objH / 2),
  }
}

export function applyZoom(canvas: Canvas, zoom: number, centre?: Point): void {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  const pt = centre ?? new Point(canvas.width / 2, canvas.height / 2)
  canvas.zoomToPoint(pt, z)
}

export function fitToViewport(canvas: Canvas, containerW: number, containerH: number): void {
  const scale = Math.min(containerW / canvas.width, containerH / canvas.height) * 0.9
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))
  const offsetX = (containerW - canvas.width * z) / 2
  const offsetY = (containerH - canvas.height * z) / 2
  canvas.setViewportTransform([z, 0, 0, z, offsetX, offsetY])
}

export function attachZoomPan(canvas: Canvas): () => void {
  const wrapper = canvas.wrapperEl as HTMLElement
  let isPanning = false
  let panStart = { x: 0, y: 0 }

  function onWheel(e: WheelEvent) {
    if (!e.ctrlKey) return
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY
    const zoom = canvas.getZoom() * (0.999 ** delta)
    applyZoom(canvas, zoom, new Point(e.offsetX, e.offsetY))
  }

  function onKeyDown(e: KeyboardEvent) {
    const el = document.activeElement
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
    if (e.code === 'Space' && !isPanning) {
      isPanning = true
      canvas.defaultCursor = 'grab'
      canvas.selection = false
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      isPanning = false
      canvas.defaultCursor = 'default'
      canvas.selection = true
    }
  }

  function onMouseDown(e: MouseEvent) {
    if (isPanning || e.button === 1) {
      panStart = { x: e.clientX, y: e.clientY }
      canvas.defaultCursor = 'grabbing'
      e.preventDefault()
    }
  }

  function onMouseMove(e: MouseEvent) {
    if ((!isPanning && e.button !== 1) || e.buttons === 0) return
    if (!isPanning && !(e.buttons & 4)) return
    const dx = e.clientX - panStart.x
    const dy = e.clientY - panStart.y
    canvas.relativePan(new Point(dx, dy))
    panStart = { x: e.clientX, y: e.clientY }
  }

  function onMouseUp() {
    if (isPanning) canvas.defaultCursor = 'grab'
    else canvas.defaultCursor = 'default'
  }

  wrapper.addEventListener('wheel', onWheel, { passive: false })
  wrapper.addEventListener('mousedown', onMouseDown)
  wrapper.addEventListener('mousemove', onMouseMove)
  wrapper.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  return () => {
    wrapper.removeEventListener('wheel', onWheel)
    wrapper.removeEventListener('mousedown', onMouseDown)
    wrapper.removeEventListener('mousemove', onMouseMove)
    wrapper.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }
}

export function initCanvas(
  el: HTMLCanvasElement,
  paperSize: PaperSizeName,
  orientation: Orientation,
  customSize?: CustomSize | null,
  receiptsPerPage?: ReceiptsPerPage,
): Canvas {
  const dims = receiptsPerPage && receiptsPerPage > 1
    ? getSlotDimensions(paperSize, orientation, receiptsPerPage, customSize)
    : getPaperDimensions(paperSize, orientation, customSize)

  const canvas = new Canvas(el, {
    width: dims.widthPx96,
    height: dims.heightPx96,
    backgroundColor: '#ffffff',
    selection: true,
  }) as AnnotatedCanvas

  let activeGuides: GuideLineSpec[] = []

  canvas.on('object:moving', (e) => {
    const obj = e.target
    if (!obj) return
    // Grid snap
    obj.set({
      left: Math.round((obj.left ?? 0) / SNAP_SIZE) * SNAP_SIZE,
      top: Math.round((obj.top ?? 0) / SNAP_SIZE) * SNAP_SIZE,
    })
    // Smart guides (override grid snap for proximity snaps)
    const others = canvas.getObjects().filter((o: FabricObject) => o !== obj)
    const result = computeGuides(obj, others, canvas.width, canvas.height)
    obj.set({ left: result.left, top: result.top })
    activeGuides = result.guides
  })

  canvas.on('object:modified', () => { activeGuides = []; canvas.requestRenderAll() })
  canvas.on('selection:cleared', () => { activeGuides = []; canvas.requestRenderAll() })

  canvas.on('after:render', ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    if (activeGuides.length === 0) return
    drawGuides(ctx, activeGuides, canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0], canvas.width, canvas.height)
  })

  canvas.data = { schemaVersion: SCHEMA_VERSION, paperSize, orientation }

  return canvas
}

export function serializeCanvas(canvas: Canvas): string {
  const json = canvas.toJSON() as Record<string, unknown>
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

  const group = new Group([bg, label], { ...centrePos(canvas, 200, 44) })
  Object.assign(group, { data: { type: 'number-field' } })
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.renderAll()
  return group
}

export function addCircle(canvas: Canvas): Ellipse {
  const e = new Ellipse({
    rx: 50,
    ry: 50,
    fill: '#E8E5E0',
    stroke: '#1A1A1A',
    strokeWidth: 0.5,
    ...centrePos(canvas, 100, 100),
  })
  canvas.add(e)
  canvas.setActiveObject(e)
  canvas.requestRenderAll()
  return e
}

export function addHighlight(canvas: Canvas): Rect {
  const r = new Rect({
    width: 200,
    height: 40,
    fill: '#FFD700',
    opacity: 0.4,
    strokeWidth: 0,
    ...centrePos(canvas, 200, 40),
  })
  Object.assign(r, { data: { type: 'highlight' } })
  canvas.add(r)
  canvas.setActiveObject(r)
  canvas.requestRenderAll()
  return r
}

export function addTable(canvas: Canvas, rows: number, cols: number): Group {
  const cellW = 60
  const cellH = 25
  const totalW = cols * cellW
  const totalH = rows * cellH

  const items: FabricObject[] = []

  // Outer border
  items.push(new Rect({
    width: totalW,
    height: totalH,
    fill: 'transparent',
    stroke: '#1A1A1A',
    strokeWidth: 1,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
  }))

  // Horizontal inner lines
  for (let r = 1; r < rows; r++) {
    const y = r * cellH - totalH / 2
    items.push(new Line([-totalW / 2, y, totalW / 2, y], {
      stroke: '#1A1A1A',
      strokeWidth: 0.5,
      selectable: false,
      evented: false,
    }))
  }

  // Vertical inner lines
  for (let c = 1; c < cols; c++) {
    const x = c * cellW - totalW / 2
    items.push(new Line([x, -totalH / 2, x, totalH / 2], {
      stroke: '#1A1A1A',
      strokeWidth: 0.5,
      selectable: false,
      evented: false,
    }))
  }

  const group = new Group(items, { ...centrePos(canvas, totalW, totalH) })
  Object.assign(group, { data: { type: 'table', rows, cols } })
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
  return group
}

export function addImagePlaceholder(canvas: Canvas): Group {
  const W = 180, H = 120
  const bg = new Rect({
    width: W, height: H,
    fill: '#f0f0f0', stroke: '#aaa', strokeWidth: 1.5,
    strokeDashArray: [6, 4],
    originX: 'center', originY: 'center',
  })
  const lbl = new FabricText('Drop image here', {
    fontSize: 12, fill: '#aaa',
    originX: 'center', originY: 'center',
    selectable: false, evented: false,
  })
  const group = new Group([bg, lbl], { ...centrePos(canvas, W, H) })
  Object.assign(group, { data: { type: 'image-placeholder' } })
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
  return group
}

export function addBlankField(canvas: Canvas): Group {
  const W = 200
  const lbl = new FabricText('Name:', {
    fontSize: 11, fill: '#555',
    left: -W / 2, top: -16,
    selectable: false, evented: false,
  })
  const ln = new Line([-W / 2, 6, W / 2, 6], {
    stroke: '#1A1A1A', strokeWidth: 1,
    selectable: false, evented: false,
  })
  const group = new Group([lbl, ln], { ...centrePos(canvas, W, 30) })
  Object.assign(group, { data: { type: 'blank-field', label: 'Name' } })
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
  return group
}
