import { useEffect, useRef } from 'react'
import type { Canvas as FabricCanvas, FabricObject } from 'fabric'

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

  const itemClass = 'w-full text-left px-4 py-2 text-sm hover:bg-krb-bg transition-colors'

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left: x, top: y, zIndex: 1000 }}
      className="bg-white border border-krb-rule rounded-xl shadow-xl overflow-hidden min-w-[160px]"
    >
      <button type="button" className={itemClass} onClick={duplicate}>Duplicate</button>
      <button type="button" className={itemClass} onClick={toFront}>Bring to front</button>
      <button type="button" className={itemClass} onClick={toBack}>Send to back</button>
      <div className="border-t border-krb-rule my-0.5" />
      <button type="button" className={`${itemClass} text-red-500 hover:bg-red-50`} onClick={deleteObj}>Delete</button>
    </div>
  )
}
