import type { FabricObject } from 'fabric'

export const GUIDE_THRESHOLD = 8
export const GUIDE_COLOR = '#E85D24'

export interface GuideLineSpec {
  orientation: 'h' | 'v'
  position: number
}

function getObjBounds(obj: FabricObject) {
  const left = obj.left ?? 0
  const top = obj.top ?? 0
  const w = (obj.width ?? 0) * (obj.scaleX ?? 1)
  const h = (obj.height ?? 0) * (obj.scaleY ?? 1)
  return { left, top, right: left + w, bottom: top + h, cx: left + w / 2, cy: top + h / 2, w, h }
}

export function computeGuides(
  obj: FabricObject,
  others: FabricObject[],
  canvasW: number,
  canvasH: number,
): { left: number; top: number; guides: GuideLineSpec[] } {
  const b = getObjBounds(obj)
  const T = GUIDE_THRESHOLD
  const guides: GuideLineSpec[] = []
  let { left, top } = b

  // Candidate X snap points: canvas edges + centre + other objects
  const xCandidates: number[] = [0, canvasW / 2, canvasW]
  const yCandidates: number[] = [0, canvasH / 2, canvasH]

  for (const other of others) {
    const ob = getObjBounds(other)
    xCandidates.push(ob.left, ob.cx, ob.right)
    yCandidates.push(ob.top, ob.cy, ob.bottom)
  }

  // X: check object left, centre, right against candidates
  let bestXDist = T
  let bestX: { snapLeft: number; guide: number } | null = null
  for (const cx of xCandidates) {
    const checks = [
      { snapLeft: cx, dist: Math.abs(b.left - cx) },            // obj left → candidate
      { snapLeft: cx - b.w / 2, dist: Math.abs(b.cx - cx) },   // obj centre → candidate
      { snapLeft: cx - b.w, dist: Math.abs(b.right - cx) },     // obj right → candidate
    ]
    for (const c of checks) {
      if (c.dist < bestXDist) { bestXDist = c.dist; bestX = { snapLeft: c.snapLeft, guide: cx } }
    }
  }
  if (bestX) {
    left = bestX.snapLeft
    guides.push({ orientation: 'v', position: bestX.guide })
  }

  // Y: check object top, centre, bottom against candidates
  let bestYDist = T
  let bestY: { snapTop: number; guide: number } | null = null
  for (const cy of yCandidates) {
    const checks = [
      { snapTop: cy, dist: Math.abs(b.top - cy) },
      { snapTop: cy - b.h / 2, dist: Math.abs(b.cy - cy) },
      { snapTop: cy - b.h, dist: Math.abs(b.bottom - cy) },
    ]
    for (const c of checks) {
      if (c.dist < bestYDist) { bestYDist = c.dist; bestY = { snapTop: c.snapTop, guide: cy } }
    }
  }
  if (bestY) {
    top = bestY.snapTop
    guides.push({ orientation: 'h', position: bestY.guide })
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
  ctx.save()
  ctx.setTransform(vt[0], vt[1], vt[2], vt[3], vt[4], vt[5])
  ctx.strokeStyle = GUIDE_COLOR
  ctx.lineWidth = 1 / (vt[0] || 1)
  ctx.setLineDash([4, 4])
  ctx.globalAlpha = 0.8

  for (const g of guides) {
    ctx.beginPath()
    if (g.orientation === 'v') {
      ctx.moveTo(g.position, 0)
      ctx.lineTo(g.position, canvasH)
    } else {
      ctx.moveTo(0, g.position)
      ctx.lineTo(canvasW, g.position)
    }
    ctx.stroke()
  }
  ctx.restore()
}
