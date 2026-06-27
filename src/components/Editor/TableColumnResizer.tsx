import { useRef, useState } from 'react'
import type { Canvas as FabricCanvas, Group } from 'fabric'
import { rebuildTable } from '@/lib/canvas'

interface Props {
  table: Group
  canvas: FabricCanvas
  vt: number[]
  onChanged: () => void
}

const MIN_COL_MM = 5

export default function TableColumnResizer({ table, canvas, vt, onChanged }: Props) {
  // Always track the latest group ref so drag operations use the post-rebuild group
  const tableRef = useRef(table)
  tableRef.current = table

  const [dragState, setDragState] = useState<{
    col: number
    startX: number
    startWidths: number[]
  } | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (table as any).data
  if (!data || data.type !== 'table') return null

  const colWidthsMm: number[] = data.colWidthsMm ?? []
  const cols: number = data.cols ?? 0
  if (cols < 2) return null

  const z = vt[0] || 1
  const PX = 96 / 25.4

  const tLeft = table.left ?? 0
  const tTop = table.top ?? 0
  const tScaleX = table.scaleX ?? 1
  const tScaleY = table.scaleY ?? 1
  const tHeight = (table.height ?? 0) * tScaleY

  // Column divider X positions in canvas space (group-local widths → canvas space)
  const dividerCanvasXs: number[] = []
  let accW = 0
  for (let c = 0; c < cols - 1; c++) {
    accW += (colWidthsMm[c] ?? 0) * PX * tScaleX
    dividerCanvasXs.push(tLeft + accW)
  }

  // Canvas space → canvas area absolute CSS position
  const toAbsX = (cx: number) => vt[4] + cx * z
  const toAbsY = (cy: number) => vt[5] + cy * z

  const handleTop = toAbsY(tTop)
  const handleHeight = Math.max(10, tHeight * z)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>, col: number) {
    e.preventDefault()
    setDragState({ col, startX: e.clientX, startWidths: [...colWidthsMm] })
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return
    const deltaScreenX = e.clientX - dragState.startX
    const deltaCanvasPx = deltaScreenX / z
    const deltaMm = deltaCanvasPx * 25.4 / 96

    const newWidths = [...dragState.startWidths]
    const newLeft = Math.max(MIN_COL_MM, newWidths[dragState.col] + deltaMm)
    const diff = newLeft - newWidths[dragState.col]
    newWidths[dragState.col] = newLeft
    // Shrink the next column by the same amount (balanced resize)
    if (dragState.col + 1 < newWidths.length) {
      newWidths[dragState.col + 1] = Math.max(MIN_COL_MM, newWidths[dragState.col + 1] - diff)
    }

    const newGroup = rebuildTable(canvas, tableRef.current, { colWidthsMm: newWidths })
    tableRef.current = newGroup
    onChanged()
  }

  function onPointerUp() {
    setDragState(null)
  }

  return (
    <>
      {/* Drag handles — only visible when not dragging */}
      {!dragState && dividerCanvasXs.map((divX, i) => (
        <div
          key={i}
          title="Drag to resize column"
          style={{
            position: 'absolute',
            left: toAbsX(divX) - 4,
            top: handleTop,
            width: 8,
            height: handleHeight,
            cursor: 'col-resize',
            zIndex: 10,
            // Subtle visual indicator: thin blue line
            borderLeft: '2px solid rgba(26,58,92,0.25)',
          }}
          onPointerDown={(e) => onPointerDown(e, i)}
        />
      ))}

      {/* Full-area overlay during drag to capture all pointer events */}
      {dragState && (
        <div
          style={{ position: 'absolute', inset: 0, cursor: 'col-resize', zIndex: 50 }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      )}
    </>
  )
}
