import { useEffect, useState } from 'react'
import type { Canvas as FabricCanvas, FabricObject } from 'fabric'

interface LayerRow {
  obj: FabricObject
  name: string
  visible: boolean
}

const TYPE_ICON: Record<string, string> = {
  textbox: 'T',
  rect: '▭',
  line: '—',
  group: '⊞',
  ellipse: '○',
}

function getDataType(obj: FabricObject): string | undefined {
  return (obj as FabricObject & { data?: { type?: string } }).data?.type
}

function deriveName(obj: FabricObject, index: number): string {
  const dt = getDataType(obj)
  if (dt === 'number-field') return 'Number Field'
  if (dt === 'image-placeholder') return 'Image'
  if (dt === 'table') return 'Table'
  if (dt === 'blank-field') return 'Blank Field'
  if (dt === 'highlight') return `Highlight ${index}`
  const t = obj.type ?? 'object'
  const label = t === 'textbox' ? 'Text' : t === 'rect' ? 'Rect' : t === 'line' ? 'Line' : t === 'group' ? 'Group' : t === 'ellipse' ? 'Circle' : 'Object'
  return `${label} ${index}`
}

function buildRows(canvas: FabricCanvas): LayerRow[] {
  const objs = canvas.getObjects()
  const typeCount: Record<string, number> = {}
  return [...objs].reverse().map((obj) => {
    const key = getDataType(obj) ?? obj.type ?? 'object'
    typeCount[key] = (typeCount[key] ?? 0) + 1
    return {
      obj,
      name: deriveName(obj, typeCount[key]),
      visible: obj.visible !== false,
    }
  })
}

interface Props {
  canvas: FabricCanvas | null
  selectedObj: FabricObject | null
  onSelectionChange: (obj: FabricObject | null) => void
}

export default function LayersPanel({ canvas, selectedObj, onSelectionChange }: Props) {
  const [rows, setRows] = useState<LayerRow[]>([])

  useEffect(() => {
    if (!canvas) return
    const refresh = () => setRows(buildRows(canvas))
    canvas.on('object:added', refresh)
    canvas.on('object:removed', refresh)
    canvas.on('object:modified', refresh)
    canvas.on('selection:created', refresh)
    canvas.on('selection:updated', refresh)
    canvas.on('selection:cleared', refresh)
    refresh()
    return () => {
      canvas.off('object:added', refresh)
      canvas.off('object:removed', refresh)
      canvas.off('object:modified', refresh)
      canvas.off('selection:created', refresh)
      canvas.off('selection:updated', refresh)
      canvas.off('selection:cleared', refresh)
    }
  }, [canvas])

  function selectRow(obj: FabricObject) {
    if (!canvas) return
    canvas.setActiveObject(obj)
    canvas.requestRenderAll()
    onSelectionChange(obj)
  }

  function toggleVisibility(row: LayerRow) {
    row.obj.set({ visible: !row.visible })
    canvas?.requestRenderAll()
    setRows(buildRows(canvas!))
  }

  function moveUp(obj: FabricObject) {
    if (!canvas) return
    canvas.bringObjectForward(obj)
    canvas.requestRenderAll()
    setRows(buildRows(canvas))
  }

  function moveDown(obj: FabricObject) {
    if (!canvas) return
    canvas.sendObjectBackwards(obj)
    canvas.requestRenderAll()
    setRows(buildRows(canvas))
  }

  function deleteRow(obj: FabricObject) {
    if (!canvas) return
    canvas.remove(obj)
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    onSelectionChange(null)
  }

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-xs text-krb-ink3 text-center">No objects yet. Add elements to see them here.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {rows.map((row, i) => {
        const isSelected = row.obj === selectedObj
        const icon = TYPE_ICON[row.obj.type ?? ''] ?? '◻'
        return (
          <div
            key={i}
            onClick={() => selectRow(row.obj)}
            className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer border-b border-krb-rule/50 ${
              isSelected ? 'bg-krb-navy/10 border-l-2 border-l-krb-navy' : 'hover:bg-krb-bg'
            }`}
          >
            <span className="text-xs text-krb-ink3 w-4 text-center flex-shrink-0">{icon}</span>
            <span className="text-xs flex-1 truncate text-krb-ink">{row.name}</span>
            <button
              type="button"
              title={row.visible ? 'Hide' : 'Show'}
              onClick={(e) => { e.stopPropagation(); toggleVisibility(row) }}
              className="text-xs opacity-50 hover:opacity-100 flex-shrink-0 w-5 text-center"
            >
              {row.visible ? '👁' : '🙈'}
            </button>
            <button
              type="button"
              title="Move up"
              onClick={(e) => { e.stopPropagation(); moveUp(row.obj) }}
              className="text-xs opacity-50 hover:opacity-100 flex-shrink-0 w-4 text-center"
            >↑</button>
            <button
              type="button"
              title="Move down"
              onClick={(e) => { e.stopPropagation(); moveDown(row.obj) }}
              className="text-xs opacity-50 hover:opacity-100 flex-shrink-0 w-4 text-center"
            >↓</button>
            <button
              type="button"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); deleteRow(row.obj) }}
              className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 w-4 text-center"
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}
