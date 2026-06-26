import type { FabricObject } from 'fabric'

export const GUIDE_THRESHOLD = 8
export const SNAP_GUIDE_COLOR = '#E85D24'
export const CENTER_GUIDE_COLOR = '#E91E8C'  // magenta — matches Canva

export interface GuideLineSpec {
  orientation: 'h' | 'v'
  position: number
  type: 'snap' | 'center'
}

export interface UserGuide {
  axis: 'h' | 'v'
  positionMm: number
}

function getObjBounds(obj: FabricObject) {
  const left = obj.left ?? 0
  const top = obj.top ?? 0
  const w = (obj.width ?? 0) * (obj.scaleX ?? 1)
  const h = (obj.height ?? 0) * (obj.scaleY ?? 1)
  return { left, top, right: left + w, bottom: top + h, cx: left + w / 2, cy: top + h / 2, w, h }
}

interface Candidate {
  pos: number
  type: 'snap' | 'center'
}

export function computeGuides(
  obj: FabricObject,
  others: FabricObject[],
  canvasW: number,
  canvasH: number,
  userGuides: UserGuide[] = [],
): { left: number; top: number; guides: GuideLineSpec[] } {
  const b = getObjBounds(obj)
  const T = GUIDE_THRESHOLD
  const guides: GuideLineSpec[] = []
  let { left, top } = b

  // X candidates: page edges (snap), page centre (center), other objects (snap/center)
  const xCands: Candidate[] = [
    { pos: 0, type: 'snap' },
    { pos: canvasW / 2, type: 'center' },
    { pos: canvasW, type: 'snap' },
  ]
  // Y candidates
  const yCands: Candidate[] = [
    { pos: 0, type: 'snap' },
    { pos: canvasH / 2, type: 'center' },
    { pos: canvasH, type: 'snap' },
  ]

  for (const other of others) {
    const ob = getObjBounds(other)
    xCands.push(
      { pos: ob.left, type: 'snap' },
      { pos: ob.cx, type: 'center' },
      { pos: ob.right, type: 'snap' },
    )
    yCands.push(
      { pos: ob.top, type: 'snap' },
      { pos: ob.cy, type: 'center' },
      { pos: ob.bottom, type: 'snap' },
    )
  }

  const MM_TO_PX = 96 / 25.4
  for (const g of userGuides) {
    const posPx = g.positionMm * MM_TO_PX
    if (g.axis === 'v') xCands.push({ pos: posPx, type: 'snap' })
    else yCands.push({ pos: posPx, type: 'snap' })
  }

  // X: check object left, centre, right against candidates
  let bestXDist = T
  let bestX: { snapLeft: number; guide: number; type: 'snap' | 'center' } | null = null
  for (const cand of xCands) {
    const cx = cand.pos
    const checks = [
      { snapLeft: cx, dist: Math.abs(b.left - cx) },
      { snapLeft: cx - b.w / 2, dist: Math.abs(b.cx - cx) },
      { snapLeft: cx - b.w, dist: Math.abs(b.right - cx) },
    ]
    for (const c of checks) {
      if (c.dist < bestXDist) {
        bestXDist = c.dist
        bestX = { snapLeft: c.snapLeft, guide: cx, type: cand.type }
      }
    }
  }
  if (bestX) {
    left = bestX.snapLeft
    guides.push({ orientation: 'v', position: bestX.guide, type: bestX.type })
  }

  // Y: check object top, centre, bottom against candidates
  let bestYDist = T
  let bestY: { snapTop: number; guide: number; type: 'snap' | 'center' } | null = null
  for (const cand of yCands) {
    const cy = cand.pos
    const checks = [
      { snapTop: cy, dist: Math.abs(b.top - cy) },
      { snapTop: cy - b.h / 2, dist: Math.abs(b.cy - cy) },
      { snapTop: cy - b.h, dist: Math.abs(b.bottom - cy) },
    ]
    for (const c of checks) {
      if (c.dist < bestYDist) {
        bestYDist = c.dist
        bestY = { snapTop: c.snapTop, guide: cy, type: cand.type }
      }
    }
  }
  if (bestY) {
    top = bestY.snapTop
    guides.push({ orientation: 'h', position: bestY.guide, type: bestY.type })
  }

  return { left, top, guides }
}

export function drawGuides(
  ctx: CanvasRenderingContext2D,
  guides: GuideLineSpec[],
  vt: number[],
  canvasW: number,
  canvasH: number,
): void {
  if (guides.length === 0) return
  const z = vt[0] || 1
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])

  const snapGuides = guides.filter((g) => g.type === 'snap')
  const centerGuides = guides.filter((g) => g.type === 'center')

  // Snap guides — orange dashed, extends full paper
  if (snapGuides.length > 0) {
    ctx.strokeStyle = SNAP_GUIDE_COLOR
    ctx.lineWidth = 1 / z
    ctx.setLineDash([4 / z, 4 / z])
    ctx.globalAlpha = 0.85
    for (const g of snapGuides) {
      ctx.beginPath()
      if (g.orientation === 'v') {
        ctx.moveTo(g.position, 0); ctx.lineTo(g.position, canvasH)
      } else {
        ctx.moveTo(0, g.position); ctx.lineTo(canvasW, g.position)
      }
      ctx.stroke()
    }
  }

  // Centre guides — magenta solid, extends full paper (matches Canva)
  if (centerGuides.length > 0) {
    ctx.strokeStyle = CENTER_GUIDE_COLOR
    ctx.lineWidth = 1 / z
    ctx.setLineDash([])
    ctx.globalAlpha = 0.75
    for (const g of centerGuides) {
      ctx.beginPath()
      if (g.orientation === 'v') {
        ctx.moveTo(g.position, 0); ctx.lineTo(g.position, canvasH)
      } else {
        ctx.moveTo(0, g.position); ctx.lineTo(canvasW, g.position)
      }
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
