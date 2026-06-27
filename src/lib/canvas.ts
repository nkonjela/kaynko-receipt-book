import { Canvas, StaticCanvas, Rect, Textbox, Group, Ellipse, Line, Point, FabricText, FabricObject } from 'fabric'
import { getPaperDimensions, getSlotDimensions } from '@/lib/paperSizes'
import type { ReceiptsPerPage } from '@/lib/paperSizes'
import { computeGuides, drawGuides } from '@/lib/guides'
import type { GuideLineSpec, UserGuide } from '@/lib/guides'
import type { PaperSizeName, Orientation, CustomSize, PerforationLine, BindingSide, BindingType } from '@/store/designStore'

// Ensure the custom `data` field is included in Fabric's JSON serialization for all objects.
// Without this, group.data (table metadata, number-field type, etc.) is silently dropped on
// canvas.toJSON() and lost when designs are saved and reloaded.
FabricObject.customProperties = ['data']

export const SCHEMA_VERSION = 1
const MIN_ZOOM = 0.05
const MAX_ZOOM = 8.0

export interface KRBCanvasData {
  schemaVersion: number
  paperSize?: PaperSizeName
  orientation?: Orientation
  paperWidthPx: number
  paperHeightPx: number
  bindingSide: BindingSide
  bindingType: BindingType
  perforationLines: PerforationLine[]
  showGrid: boolean
  gridSizeMm: number
  userGuides: UserGuide[]
  showSafeZone: boolean
  bleedEnabled: boolean
}

type AnnotatedCanvas = Canvas & { data: KRBCanvasData }

export function centrePos(canvas: Canvas, objW: number, objH: number) {
  const data = (canvas as AnnotatedCanvas).data
  const w = data?.paperWidthPx ?? canvas.width
  const h = data?.paperHeightPx ?? canvas.height
  return {
    left: Math.round(w / 2 - objW / 2),
    top: Math.round(h / 2 - objH / 2),
  }
}

export function applyZoom(canvas: Canvas, zoom: number, centre?: Point): void {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
  const pt = centre ?? new Point(canvas.width / 2, canvas.height / 2)
  canvas.zoomToPoint(pt, z)
}

export function fitToViewport(canvas: Canvas, containerW: number, containerH: number): void {
  if (containerW <= 0 || containerH <= 0) return
  const data = (canvas as AnnotatedCanvas).data
  const paperW = data?.paperWidthPx ?? canvas.width
  const paperH = data?.paperHeightPx ?? canvas.height
  canvas.setDimensions({ width: containerW, height: containerH })
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
    Math.min((containerW * 0.88) / paperW, (containerH * 0.88) / paperH)))
  const offsetX = (containerW - paperW * z) / 2
  const offsetY = (containerH - paperH * z) / 2
  canvas.setViewportTransform([z, 0, 0, z, offsetX, offsetY])
}

export function updateCanvasData(canvas: Canvas, updates: Partial<KRBCanvasData>): void {
  const data = (canvas as AnnotatedCanvas).data
  if (data) Object.assign(data, updates)
  canvas.requestRenderAll()
}

// Zoom on scroll, Space+drag or middle-click+drag pans. containerEl should be canvasAreaRef.
export function attachZoomPan(canvas: Canvas, containerEl: HTMLElement): () => void {
  let isPanning = false
  let panStart = { x: 0, y: 0 }

  // Use Fabric's own mouse:wheel event — avoids the upper-canvas event interception issue
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleWheel = (opt: any) => {
    const e = opt.e as WheelEvent
    e.preventDefault()
    e.stopPropagation()
    const zoom = canvas.getZoom() * (0.999 ** e.deltaY)
    const rect = containerEl.getBoundingClientRect()
    applyZoom(canvas, zoom, new Point(e.clientX - rect.left, e.clientY - rect.top))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(canvas as any).on('mouse:wheel', handleWheel)

  function onKeyDown(e: KeyboardEvent) {
    const el = document.activeElement
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
    if (e.code === 'Space' && !isPanning) {
      isPanning = true
      canvas.defaultCursor = 'grab'
      canvas.selection = false
      e.preventDefault()
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
    // e.button is meaningless in mousemove — use e.buttons bitmask instead
    const isMiddleDrag = (e.buttons & 4) !== 0
    if (!isPanning && !isMiddleDrag) return
    if (e.buttons === 0) return
    const dx = e.clientX - panStart.x
    const dy = e.clientY - panStart.y
    canvas.relativePan(new Point(dx, dy))
    panStart = { x: e.clientX, y: e.clientY }
  }

  function onMouseUp() {
    canvas.defaultCursor = isPanning ? 'grab' : 'default'
  }

  containerEl.addEventListener('mousedown', onMouseDown)
  containerEl.addEventListener('mousemove', onMouseMove)
  containerEl.addEventListener('mouseup', onMouseUp)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(canvas as any).off('mouse:wheel', handleWheel)
    containerEl.removeEventListener('mousedown', onMouseDown)
    containerEl.removeEventListener('mousemove', onMouseMove)
    containerEl.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }
}

function drawBindingEdge(
  ctx: CanvasRenderingContext2D,
  vt: number[],
  paperW: number,
  paperH: number,
  side: BindingSide,
  bindingType: BindingType,
): void {
  if (bindingType === 'none') return
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])
  const z = vt[0] || 1
  const stripe = 12 / z

  // Fill stripe
  ctx.fillStyle = 'rgba(26,58,92,0.18)'
  if (side === 'left') ctx.fillRect(0, 0, stripe, paperH)
  else if (side === 'right') ctx.fillRect(paperW - stripe, 0, stripe, paperH)
  else if (side === 'top') ctx.fillRect(0, 0, paperW, stripe)
  else ctx.fillRect(0, paperH - stripe, paperW, stripe)

  // Solid border line on the binding edge
  ctx.strokeStyle = 'rgba(26,58,92,0.55)'
  ctx.lineWidth = 1.5 / z
  ctx.setLineDash([])
  ctx.beginPath()
  if (side === 'left') { ctx.moveTo(stripe, 0); ctx.lineTo(stripe, paperH) }
  else if (side === 'right') { ctx.moveTo(paperW - stripe, 0); ctx.lineTo(paperW - stripe, paperH) }
  else if (side === 'top') { ctx.moveTo(0, stripe); ctx.lineTo(paperW, stripe) }
  else { ctx.moveTo(0, paperH - stripe); ctx.lineTo(paperW, paperH - stripe) }
  ctx.stroke()

  // Label text
  ctx.fillStyle = 'rgba(26,58,92,0.65)'
  ctx.font = `bold ${10 / z}px Arial`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (side === 'bottom') {
    ctx.fillText('── BINDING ──', paperW / 2, paperH - stripe / 2)
  } else if (side === 'top') {
    ctx.fillText('── BINDING ──', paperW / 2, stripe / 2)
  } else if (side === 'left') {
    ctx.save()
    ctx.translate(stripe / 2, paperH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('── BINDING ──', 0, 0)
    ctx.restore()
  } else {
    ctx.save()
    ctx.translate(paperW - stripe / 2, paperH / 2)
    ctx.rotate(Math.PI / 2)
    ctx.fillText('── BINDING ──', 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

function drawPerforations(
  ctx: CanvasRenderingContext2D,
  vt: number[],
  paperW: number,
  paperH: number,
  lines: PerforationLine[],
): void {
  if (lines.length === 0) return
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])
  const z = vt[0] || 1
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 0.75 / z

  for (const line of lines) {
    const posPx = line.positionMm * (96 / 25.4)
    if (line.style === 'dashes') {
      ctx.setLineDash([7 / z, 4 / z])
      ctx.beginPath()
      if (line.axis === 'h') {
        ctx.moveTo(0, posPx)
        ctx.lineTo(paperW, posPx)
      } else {
        ctx.moveTo(posPx, 0)
        ctx.lineTo(posPx, paperH)
      }
      ctx.stroke()
    } else {
      ctx.setLineDash([])
      const tickLen = 10 / z
      ctx.beginPath()
      if (line.axis === 'h') {
        ctx.moveTo(0, posPx); ctx.lineTo(tickLen, posPx)
        ctx.moveTo(paperW - tickLen, posPx); ctx.lineTo(paperW, posPx)
      } else {
        ctx.moveTo(posPx, 0); ctx.lineTo(posPx, tickLen)
        ctx.moveTo(posPx, paperH - tickLen); ctx.lineTo(posPx, paperH)
      }
      ctx.stroke()
    }
  }
  ctx.setLineDash([])
  ctx.restore()
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  vt: number[],
  paperW: number,
  paperH: number,
  gridSizeMm: number,
): void {
  const gridSizePx = gridSizeMm * (96 / 25.4)
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])
  const z = vt[0] || 1
  ctx.strokeStyle = 'rgba(160,170,200,0.45)'
  ctx.lineWidth = 0.5 / z
  ctx.setLineDash([])
  for (let x = 0; x <= paperW + gridSizePx; x += gridSizePx) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, paperH); ctx.stroke()
  }
  for (let y = 0; y <= paperH + gridSizePx; y += gridSizePx) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(paperW, y); ctx.stroke()
  }
  ctx.restore()
}

function drawUserGuides(
  ctx: CanvasRenderingContext2D,
  vt: number[],
  paperW: number,
  paperH: number,
  guides: UserGuide[],
): void {
  if (guides.length === 0) return
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])
  const z = vt[0] || 1
  ctx.strokeStyle = 'rgba(0,110,200,0.65)'
  ctx.lineWidth = 0.75 / z
  ctx.setLineDash([])
  for (const g of guides) {
    const posPx = g.positionMm * (96 / 25.4)
    ctx.beginPath()
    if (g.axis === 'v') {
      ctx.moveTo(posPx, 0); ctx.lineTo(posPx, paperH)
    } else {
      ctx.moveTo(0, posPx); ctx.lineTo(paperW, posPx)
    }
    ctx.stroke()
  }
  ctx.restore()
}

function drawPaperCenterLines(
  ctx: CanvasRenderingContext2D,
  vt: number[],
  paperW: number,
  paperH: number,
): void {
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])
  const z = vt[0] || 1
  ctx.strokeStyle = '#C8C4BD'
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 0.5 / z
  ctx.setLineDash([3 / z, 6 / z])

  // Vertical center line
  ctx.beginPath(); ctx.moveTo(paperW / 2, 0); ctx.lineTo(paperW / 2, paperH); ctx.stroke()
  // Horizontal center line
  ctx.beginPath(); ctx.moveTo(0, paperH / 2); ctx.lineTo(paperW, paperH / 2); ctx.stroke()

  // Origin crosshair at (0, 0)
  ctx.setLineDash([])
  const arm = 6 / z
  ctx.beginPath()
  ctx.moveTo(-arm, -arm); ctx.lineTo(arm, arm)
  ctx.moveTo(arm, -arm); ctx.lineTo(-arm, arm)
  ctx.stroke()

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}

function drawRectLabels(
  ctx: CanvasRenderingContext2D,
  vt: number[],
  canvas: Canvas,
): void {
  const rects = canvas.getObjects().filter((o) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return o.type === 'rect' && !!((o as any).data?.labelText)
  })
  if (rects.length === 0) return
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '14px Arial, sans-serif'
  ctx.fillStyle = '#1A1A1A'
  for (const obj of rects) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const label = (obj as any).data.labelText as string
    const cx = (obj.left ?? 0) + (obj.width ?? 0) * (obj.scaleX ?? 1) / 2
    const cy = (obj.top  ?? 0) + (obj.height ?? 0) * (obj.scaleY ?? 1) / 2
    ctx.fillText(label, cx, cy)
  }
  ctx.restore()
}

export interface DimensionInfo {
  x: number
  y: number
  label: string
}

export interface InitCanvasOptions {
  bindingSide?: BindingSide
  bindingType?: BindingType
  perforationLines?: PerforationLine[]
  showGrid?: boolean
  gridSizeMm?: number
  userGuides?: UserGuide[]
  showSafeZone?: boolean
  bleedEnabled?: boolean
  onDimensions?: (info: DimensionInfo | null) => void
}

function fireDimensions(obj: FabricObject, canvas: Canvas, cb?: (info: DimensionInfo | null) => void) {
  if (!cb) return
  const wMm = ((obj.width ?? 0) * (obj.scaleX ?? 1) / (96 / 25.4)).toFixed(1)
  const hMm = ((obj.height ?? 0) * (obj.scaleY ?? 1) / (96 / 25.4)).toFixed(1)
  const vt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
  const screenX = (obj.left ?? 0) * vt[0] + vt[4] + (obj.width ?? 0) * (obj.scaleX ?? 1) * vt[0] + 10
  const screenY = (obj.top ?? 0) * vt[3] + vt[5]
  cb({ label: `${wMm} × ${hMm} mm`, x: screenX, y: screenY })
}

export function initCanvas(
  el: HTMLCanvasElement,
  paperSize: PaperSizeName,
  orientation: Orientation,
  customSize?: CustomSize | null,
  receiptsPerPage?: ReceiptsPerPage,
  options?: InitCanvasOptions,
): Canvas {
  const dims = receiptsPerPage && receiptsPerPage > 1
    ? getSlotDimensions(paperSize, orientation, receiptsPerPage, customSize)
    : getPaperDimensions(paperSize, orientation, customSize)

  const canvas = new Canvas(el, {
    width: dims.widthPx96,
    height: dims.heightPx96,
    backgroundColor: '',
    selection: true,
  }) as AnnotatedCanvas

  canvas.data = {
    schemaVersion: SCHEMA_VERSION,
    paperSize,
    orientation,
    paperWidthPx: dims.widthPx96,
    paperHeightPx: dims.heightPx96,
    bindingSide: options?.bindingSide ?? 'bottom',
    bindingType: options?.bindingType ?? 'none',
    perforationLines: options?.perforationLines ?? [],
    showGrid: options?.showGrid ?? false,
    gridSizeMm: options?.gridSizeMm ?? 5,
    userGuides: options?.userGuides ?? [],
    showSafeZone: options?.showSafeZone ?? true,
    bleedEnabled: options?.bleedEnabled ?? true,
  }

  let activeGuides: GuideLineSpec[] = []
  let _pendingTableCell: Textbox | null = null

  canvas.on('object:moving', (e) => {
    const obj = e.target
    if (!obj) return
    const data = (canvas as AnnotatedCanvas).data
    const pw = data?.paperWidthPx ?? canvas.width
    const ph = data?.paperHeightPx ?? canvas.height

    // Grid snap (if grid is visible and snap enabled)
    if (data?.showGrid) {
      const gridPx = (data.gridSizeMm ?? 5) * (96 / 25.4)
      obj.set({
        left: Math.round((obj.left ?? 0) / gridPx) * gridPx,
        top: Math.round((obj.top ?? 0) / gridPx) * gridPx,
      })
    }

    // Smart guides (override grid snap near snap points)
    const others = canvas.getObjects().filter((o: FabricObject) => o !== obj)
    const result = computeGuides(obj, others, pw, ph, data?.userGuides ?? [])
    obj.set({ left: result.left, top: result.top })
    activeGuides = result.guides

    // Dimension tooltip
    fireDimensions(obj, canvas, options?.onDimensions)
  })

  canvas.on('object:scaling', (e) => {
    if (e.target) fireDimensions(e.target, canvas, options?.onDimensions)
  })

  canvas.on('object:modified', () => {
    activeGuides = []
    _pendingTableCell = null
    options?.onDimensions?.(null)
    canvas.requestRenderAll()
  })
  canvas.on('selection:cleared', () => {
    activeGuides = []
    _pendingTableCell = null
    canvas.requestRenderAll()
  })

  // Track which table cell the pointer is over so dblclick can enter edit mode.
  // Fabric 7 does not reliably populate subTargets on the synthetic dblclick event,
  // so we detect the hit cell during mouse:down and consume it in mouse:dblclick.
  canvas.on('mouse:down', (e) => {
    _pendingTableCell = null
    const group = e.target
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!group || group.type !== 'group' || (group as any).data?.type !== 'table') return
    const pointer = (e as unknown as { absolutePointer: { x: number; y: number } }).absolutePointer
    const gScaleX = group.scaleX ?? 1
    const gScaleY = group.scaleY ?? 1
    // Group children use group-local coords where (0,0) = group center.
    // Group.left/top is the top-left corner of the group bounding box.
    const gCenterX = (group.left ?? 0) + (group.width ?? 0) * gScaleX / 2
    const gCenterY = (group.top  ?? 0) + (group.height ?? 0) * gScaleY / 2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const child of (group as any).getObjects() as FabricObject[]) {
      if (child.type !== 'textbox') continue
      const childLeft = gCenterX + (child.left ?? 0) * gScaleX
      const childTop  = gCenterY + (child.top  ?? 0) * gScaleY
      const childW    = (child.width  ?? 0) * gScaleX
      const childH    = (child.height ?? 0) * gScaleY
      if (pointer.x >= childLeft && pointer.x <= childLeft + childW &&
          pointer.y >= childTop  && pointer.y <= childTop  + childH) {
        _pendingTableCell = child as Textbox
        break
      }
    }
  })

  canvas.on('mouse:dblclick', (e) => {
    // Table cell editing
    if (e.target?.type === 'group' && _pendingTableCell) {
      const parentGroup = e.target
      const cell = _pendingTableCell
      _pendingTableCell = null
      canvas.setActiveObject(cell)
      cell.enterEditing()
      cell.selectAll()
      cell.once('editing:exited', () => {
        canvas.setActiveObject(parentGroup)
        canvas.requestRenderAll()
      })
      canvas.requestRenderAll()
      return
    }
    _pendingTableCell = null

    // Rect text label editing: double-click any rect to set/edit a centered label.
    const target = e.target
    if (target && target.type === 'rect') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const obj = target as any
      const existing: string = obj.data?.labelText ?? ''
      const tb = new Textbox(existing, {
        left: obj.left ?? 0,
        top: obj.top ?? 0,
        width: (obj.width ?? 100) * (obj.scaleX ?? 1),
        fontSize: 14,
        fill: '#1A1A1A',
        textAlign: 'center',
        editable: true,
        hasControls: false,
        selectable: true,
      })
      canvas.add(tb)
      canvas.setActiveObject(tb)
      tb.enterEditing()
      tb.selectAll()
      tb.once('editing:exited', () => {
        obj.data = { ...(obj.data ?? {}), labelText: tb.text ?? '' }
        canvas.remove(tb)
        // Trigger history push via the object:modified pipeline
        canvas.fire('object:modified', { target: obj })
        canvas.requestRenderAll()
      })
      canvas.requestRenderAll()
    }
  })

  canvas.on('after:render', ({ ctx }: { ctx: CanvasRenderingContext2D }) => {
    const data = (canvas as AnnotatedCanvas).data
    const vt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    const pw = data?.paperWidthPx ?? canvas.width
    const ph = data?.paperHeightPx ?? canvas.height

    drawPaperCenterLines(ctx, vt, pw, ph)
    if (data?.showGrid) drawGrid(ctx, vt, pw, ph, data.gridSizeMm ?? 5)
    if ((data?.userGuides ?? []).length > 0) drawUserGuides(ctx, vt, pw, ph, data.userGuides ?? [])
    drawBindingEdge(ctx, vt, pw, ph, data?.bindingSide ?? 'bottom', data?.bindingType ?? 'none')
    drawPerforations(ctx, vt, pw, ph, data?.perforationLines ?? [])
    drawRectLabels(ctx, vt, canvas)
    if (activeGuides.length > 0) drawGuides(ctx, activeGuides, vt, pw, ph)
  })

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

export function addRoundedRect(canvas: Canvas, rx = 10): Rect {
  const r = new Rect({
    width: 150,
    height: 80,
    rx,
    ry: rx,
    fill: '#E8E5E0',
    stroke: '#1A1A1A',
    strokeWidth: 0.5,
    ...centrePos(canvas, 150, 80),
  })
  canvas.add(r)
  canvas.setActiveObject(r)
  canvas.requestRenderAll()
  return r
}

export function addArrow(canvas: Canvas): Group {
  const len = 120
  const headSize = 14
  const line = new Line([0, 0, len - headSize, 0], {
    stroke: '#1A1A1A',
    strokeWidth: 2,
    originX: 'left',
    originY: 'center',
    selectable: false,
    evented: false,
  })
  const head = new FabricText('▶', {
    fontSize: headSize,
    fill: '#1A1A1A',
    originX: 'left',
    originY: 'center',
    left: len - headSize - 2,
    top: 0,
    selectable: false,
    evented: false,
  })
  const group = new Group([line, head], {
    ...centrePos(canvas, len, headSize),
  })
  Object.assign(group, { data: { type: 'arrow' } })
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
  return group
}

export interface TableConfig {
  rows: number
  cols: number
  rowHeightsMm: number[]
  colWidthsMm: number[]
  borderColor: string
  borderWidth: number
  headerBg: string
  altRowBg: string
  cellPaddingMm: number
  cellTexts?: string[][]
}

function buildTableGroup(cfg: TableConfig): Group {
  const PX = 96 / 25.4
  const pad = Math.max(1, Math.round(cfg.cellPaddingMm * PX))
  const rowHs = cfg.rowHeightsMm.map((h) => Math.max(8, Math.round(h * PX)))
  const colWs = cfg.colWidthsMm.map((w) => Math.max(10, Math.round(w * PX)))
  const totalW = colWs.reduce((a, b) => a + b, 0)
  const totalH = rowHs.reduce((a, b) => a + b, 0)

  // Cumulative row/col start positions in group-local space (origin = group center)
  const rowYs: number[] = []
  let yCur = -totalH / 2
  for (const h of rowHs) { rowYs.push(yCur); yCur += h }

  const colXs: number[] = []
  let xCur = -totalW / 2
  for (const w of colWs) { colXs.push(xCur); xCur += w }

  const items: FabricObject[] = []

  // Outer background + border
  items.push(new Rect({
    width: totalW, height: totalH,
    fill: '#ffffff',
    stroke: cfg.borderColor, strokeWidth: cfg.borderWidth,
    originX: 'center', originY: 'center',
    selectable: false, evented: false,
  }))

  // Row background fills (header + alternating rows)
  for (let r = 0; r < cfg.rows; r++) {
    const bg = r === 0 ? cfg.headerBg : (r % 2 === 0 ? cfg.altRowBg : '')
    if (bg) {
      items.push(new Rect({
        left: -totalW / 2, top: rowYs[r],
        width: totalW, height: rowHs[r],
        fill: bg, strokeWidth: 0,
        originX: 'left', originY: 'top',
        selectable: false, evented: false,
      }))
    }
  }

  const sepW = Math.max(0.25, cfg.borderWidth * 0.5)

  // Row separator lines
  for (let r = 1; r < cfg.rows; r++) {
    items.push(new Line([-totalW / 2, rowYs[r], totalW / 2, rowYs[r]], {
      stroke: cfg.borderColor, strokeWidth: sepW,
      selectable: false, evented: false,
    }))
  }

  // Column separator lines
  for (let c = 1; c < cfg.cols; c++) {
    items.push(new Line([colXs[c], -totalH / 2, colXs[c], totalH / 2], {
      stroke: cfg.borderColor, strokeWidth: sepW,
      selectable: false, evented: false,
    }))
  }

  // One Textbox per cell (row-major order)
  for (let r = 0; r < cfg.rows; r++) {
    for (let c = 0; c < cfg.cols; c++) {
      items.push(new Textbox(cfg.cellTexts?.[r]?.[c] ?? '', {
        left: colXs[c] + pad,
        top: rowYs[r] + pad,
        width: Math.max(6, colWs[c] - pad * 2),
        height: Math.max(6, rowHs[r] - pad * 2),
        fontSize: r === 0 ? 10 : 9,
        fontWeight: r === 0 ? 'bold' : 'normal',
        fill: '#1A1A1A',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'left',
        editable: true,
        lockMovementX: true, lockMovementY: true,
        lockScalingX: true, lockScalingY: true,
        hasControls: false, hasBorders: false,
        padding: 1,
      }))
    }
  }

  const group = new Group(items, { subTargetCheck: true })
  const avgCellW = cfg.colWidthsMm.reduce((a, b) => a + b, 0) / cfg.cols
  const avgCellH = cfg.rowHeightsMm.reduce((a, b) => a + b, 0) / cfg.rows
  Object.assign(group, { data: {
    type: 'table',
    rows: cfg.rows, cols: cfg.cols,
    cellWMm: avgCellW, cellHMm: avgCellH,
    rowHeightsMm: cfg.rowHeightsMm,
    colWidthsMm: cfg.colWidthsMm,
    borderColor: cfg.borderColor, borderWidth: cfg.borderWidth,
    headerBg: cfg.headerBg, altRowBg: cfg.altRowBg,
    cellPaddingMm: cfg.cellPaddingMm,
  } })
  return group
}

export function addTable(canvas: Canvas, rows: number, cols: number, cellWMm = 30, cellHMm = 10): Group {
  const cfg: TableConfig = {
    rows, cols,
    rowHeightsMm: Array<number>(rows).fill(cellHMm),
    colWidthsMm: Array<number>(cols).fill(cellWMm),
    borderColor: '#1A1A1A', borderWidth: 1,
    headerBg: '', altRowBg: '', cellPaddingMm: 1,
  }
  const group = buildTableGroup(cfg)
  group.set(centrePos(canvas, group.width, group.height))
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
  return group
}

export function rebuildTable(canvas: Canvas, group: Group, newCfg: Partial<TableConfig>): Group {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (group as any).data as Record<string, unknown>
  const existingRows = Number(d?.['rows'] ?? 2)
  const existingCols = Number(d?.['cols'] ?? 2)

  // Extract current cell text from the textboxes (row-major order)
  const textboxes = group.getObjects().filter((o: FabricObject) => o.type === 'textbox') as Textbox[]
  const existingTexts: string[][] = []
  for (let r = 0; r < existingRows; r++) {
    existingTexts.push([])
    for (let c = 0; c < existingCols; c++) {
      existingTexts[r].push(textboxes[r * existingCols + c]?.text ?? '')
    }
  }

  const savedLeft = group.left
  const savedTop = group.top
  const savedScaleX = group.scaleX ?? 1
  const savedScaleY = group.scaleY ?? 1

  const cfg: TableConfig = {
    rows: Number(d?.['rows'] ?? 2),
    cols: Number(d?.['cols'] ?? 2),
    rowHeightsMm: (d?.['rowHeightsMm'] as number[] | undefined) ?? Array<number>(existingRows).fill(Number(d?.['cellHMm'] ?? 10)),
    colWidthsMm: (d?.['colWidthsMm'] as number[] | undefined) ?? Array<number>(existingCols).fill(Number(d?.['cellWMm'] ?? 30)),
    borderColor: String(d?.['borderColor'] ?? '#1A1A1A'),
    borderWidth: Number(d?.['borderWidth'] ?? 1),
    headerBg: String(d?.['headerBg'] ?? ''),
    altRowBg: String(d?.['altRowBg'] ?? ''),
    cellPaddingMm: Number(d?.['cellPaddingMm'] ?? 1),
    ...newCfg,
  }

  // Fit existing text into new cell grid (truncate extra rows/cols, fill new with '')
  const newTexts: string[][] = []
  for (let r = 0; r < cfg.rows; r++) {
    newTexts.push([])
    for (let c = 0; c < cfg.cols; c++) {
      newTexts[r].push(existingTexts[r]?.[c] ?? '')
    }
  }
  cfg.cellTexts = newTexts

  // Keep row/col arrays sized to match new row/col counts
  while (cfg.rowHeightsMm.length < cfg.rows) cfg.rowHeightsMm.push(cfg.rowHeightsMm[cfg.rowHeightsMm.length - 1] ?? 10)
  cfg.rowHeightsMm = cfg.rowHeightsMm.slice(0, cfg.rows)
  while (cfg.colWidthsMm.length < cfg.cols) cfg.colWidthsMm.push(cfg.colWidthsMm[cfg.colWidthsMm.length - 1] ?? 30)
  cfg.colWidthsMm = cfg.colWidthsMm.slice(0, cfg.cols)

  canvas.remove(group)
  const newGroup = buildTableGroup(cfg)
  newGroup.set({ left: savedLeft, top: savedTop, scaleX: savedScaleX, scaleY: savedScaleY })
  canvas.add(newGroup)
  canvas.setActiveObject(newGroup)
  canvas.requestRenderAll()
  return newGroup
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
