import type { FabricObject } from 'fabric'

export const GUIDE_THRESHOLD = 8
export const SNAP_GUIDE_COLOR = '#E85D24'
export const CENTER_GUIDE_COLOR = '#4A90D9'

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

  // Candidate X snap points: canvas edges + centre + other objects + user guides
  const xCandidates: number[] = [0, canvasW / 2, canvasW]
  const yCandidates: number[] = [0, canvasH / 2, canvasH]

  for (const other of others) {
    const ob = getObjBounds(other)
    xCandidates.push(ob.left, ob.cx, ob.right)
    yCandidates.push(ob.top, ob.cy, ob.bottom)
  }

  const MM_TO_PX = 96 / 25.4
  for (const g of userGuides) {
    const posPx = g.positionMm * MM_TO_PX
    if (g.axis === 'v') xCandidates.push(posPx)
    else yCandidates.push(posPx)
  }

  // X: check object left, centre, right against candidates
  let bestXDist = T
  let bestX: { snapLeft: number; guide: number } | null = null
  for (const cx of xCandidates) {
    const checks = [
      { snapLeft: cx, dist: Math.abs(b.left - cx) },
      { snapLeft: cx - b.w / 2, dist: Math.abs(b.cx - cx) },
      { snapLeft: cx - b.w, dist: Math.abs(b.right - cx) },
    ]
    for (const c of checks) {
      if (c.dist < bestXDist) { bestXDist = c.dist; bestX = { snapLeft: c.snapLeft, guide: cx } }
    }
  }
  if (bestX) {
    left = bestX.snapLeft
    guides.push({ orientation: 'v', position: bestX.guide, type: 'snap' })
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
    guides.push({ orientation: 'h', position: bestY.guide, type: 'snap' })
  }

  // Always add centre crosshair through the object's own centre (after snapping)
  const finalW = b.w
  const finalH = b.h
  const finalCx = left + finalW / 2
  const finalCy = top + finalH / 2
  guides.push({ orientation: 'v', position: finalCx, type: 'center' })
  guides.push({ orientation: 'h', position: finalCy, type: 'center' })

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
        ctx.moveTo(g.position, 0)
        ctx.lineTo(g.position, canvasH)
      } else {
        ctx.moveTo(0, g.position)
        ctx.lineTo(canvasW, g.position)
      }
      ctx.stroke()
    }
  }

  // Centre guides — blue dashed, extends full paper
  if (centerGuides.length === 2) {
    ctx.strokeStyle = CENTER_GUIDE_COLOR
    ctx.lineWidth = 0.75 / z
    ctx.setLineDash([3 / z, 6 / z])
    ctx.globalAlpha = 0.6
    for (const g of centerGuides) {
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

    // Draw + crosshair dot at object centre
    const vGuide = centerGuides.find((g) => g.orientation === 'v')
    const hGuide = centerGuides.find((g) => g.orientation === 'h')
    if (vGuide && hGuide) {
      const cx = vGuide.position
      const cy = hGuide.position
      const dot = 5 / z
      ctx.setLineDash([])
      ctx.strokeStyle = CENTER_GUIDE_COLOR
      ctx.lineWidth = 1.5 / z
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.moveTo(cx - dot, cy); ctx.lineTo(cx + dot, cy)
      ctx.moveTo(cx, cy - dot); ctx.lineTo(cx, cy + dot)
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 1
  ctx.setLineDash([])
  ctx.restore()
}
