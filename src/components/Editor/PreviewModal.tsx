import { useEffect, useState } from 'react'
import type { Canvas as FabricCanvas } from 'fabric'
import { getSlotGrid } from '@/lib/paperSizes'
import type { ReceiptsPerPage } from '@/lib/paperSizes'
import type { Orientation } from '@/store/designStore'

interface Props {
  canvas: FabricCanvas
  receiptsPerPage: ReceiptsPerPage
  twoUpOrientation: 'h' | 'v'
  orientation: Orientation
  onClose: () => void
}

export default function PreviewModal({ canvas, receiptsPerPage, twoUpOrientation, orientation, onClose }: Props) {
  const [slotUrl, setSlotUrl] = useState<string | null>(null)

  useEffect(() => {
    // Capture current canvas as image
    const url = canvas.toDataURL({ format: 'png', multiplier: 1.5 })
    setSlotUrl(url)
  }, [canvas])

  const { cols, rows } = getSlotGrid(receiptsPerPage, orientation, twoUpOrientation)
  const total = cols * rows

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-krb-rule flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-krb-navy">Page Preview</h2>
            <p className="text-xs text-krb-ink3 mt-0.5">
              {receiptsPerPage === 1
                ? 'Single receipt per page'
                : `${receiptsPerPage}-up layout — ${cols} × ${rows} grid on one printed page`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-krb-ink3 hover:text-krb-ink text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-krb-bg"
          >
            &times;
          </button>
        </div>

        <div className="p-6 bg-slate-100 flex items-center justify-center min-h-[300px]">
          {slotUrl ? (
            <div
              className="bg-white shadow-xl border border-slate-200 inline-block"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, auto)`,
                gap: '1px',
                background: '#ccc',
                maxWidth: '100%',
                maxHeight: '60vh',
              }}
            >
              {Array.from({ length: total }).map((_, i) => (
                <div key={i} className="bg-white relative overflow-hidden">
                  <img
                    src={slotUrl}
                    alt={`Slot ${i + 1}`}
                    style={{
                      display: 'block',
                      maxWidth: cols === 1 ? '400px' : `${Math.floor(400 / cols)}px`,
                      width: '100%',
                      height: 'auto',
                    }}
                  />
                  {receiptsPerPage > 1 && (
                    <div className="absolute top-1 right-1 bg-black/30 text-white text-xs px-1 rounded font-mono leading-none py-0.5">
                      {i + 1}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-krb-ink3 text-sm">Rendering preview…</div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-krb-rule flex justify-between items-center">
          <p className="text-xs text-krb-ink3">
            This is how one printed page will look. Slot dividers are drawn at 0.25pt.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="border border-krb-rule rounded-lg px-4 py-1.5 text-sm hover:bg-krb-bg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
