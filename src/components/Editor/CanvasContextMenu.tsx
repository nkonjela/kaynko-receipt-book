import { useEffect, useRef } from 'react'
import type { Canvas as FabricCanvas, FabricObject, Group } from 'fabric'
import { rebuildTable } from '@/lib/canvas'

interface Props {
  x: number
  y: number
  canvas: FabricCanvas
  target: FabricObject
  onClose: () => void
  onChanged: () => void
}

export default function CanvasContextMenu({ x, y, canvas, target, onClose, onChanged }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  function action(fn: () => void) {
    fn()
    onClose()
  }

  function duplicate() {
    action(() => {
      void target.clone().then((cloned: FabricObject) => {
        cloned.set({ left: (target.left ?? 0) + 10, top: (target.top ?? 0) + 10 })
        canvas.add(cloned)
        canvas.setActiveObject(cloned)
        canvas.requestRenderAll()
        onChanged()
      })
    })
  }

  function deleteObj() {
    action(() => {
      canvas.remove(target)
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      onChanged()
    })
  }

  function toFront() {
    action(() => {
      canvas.bringObjectToFront(target)
      canvas.requestRenderAll()
    })
  }

  function toBack() {
    action(() => {
      canvas.sendObjectToBack(target)
      canvas.requestRenderAll()
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableData = (target as any).data?.type === 'table' ? (target as any).data : null
  const tableRows: number = tableData?.rows ?? 0
  const tableCols: number = tableData?.cols ?? 0

  function tableAction(partial: { rows?: number; cols?: number }) {
    action(() => {
      rebuildTable(canvas, target as unknown as Group, partial)
      onChanged()
    })
  }

  const itemClass = 'w-full text-left px-4 py-2 text-sm hover:bg-krb-bg transition-colors'
  const disabledClass = 'w-full text-left px-4 py-2 text-sm text-krb-ink3 cursor-not-allowed opacity-50'

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: x, top: y, zIndex: 1000 }}
      className="bg-white border border-krb-rule rounded-xl shadow-xl overflow-hidden min-w-[180px]"
    >
      {tableData && (
        <>
          <div className="px-4 py-1.5 text-xs font-semibold text-krb-ink3 uppercase tracking-wider bg-krb-bg border-b border-krb-rule">Table</div>
          <button type="button" className={itemClass}
            onClick={() => tableAction({ rows: tableRows + 1 })}>
            Add row
          </button>
          {tableRows > 1
            ? <button type="button" className={itemClass}
                onClick={() => tableAction({ rows: tableRows - 1 })}>
                Remove last row
              </button>
            : <span className={disabledClass}>Remove last row</span>
          }
          <button type="button" className={itemClass}
            onClick={() => tableAction({ cols: tableCols + 1 })}>
            Add column
          </button>
          {tableCols > 1
            ? <button type="button" className={itemClass}
                onClick={() => tableAction({ cols: tableCols - 1 })}>
                Remove last column
              </button>
            : <span className={disabledClass}>Remove last column</span>
          }
          <div className="border-t border-krb-rule my-0.5" />
        </>
      )}
      <button type="button" className={itemClass} onClick={duplicate}>Duplicate</button>
      <button type="button" className={itemClass} onClick={toFront}>Bring to front</button>
      <button type="button" className={itemClass} onClick={toBack}>Send to back</button>
      <div className="border-t border-krb-rule my-0.5" />
      <button type="button" className={`${itemClass} text-red-500 hover:bg-red-50`} onClick={deleteObj}>Delete</button>
    </div>
  )
}
