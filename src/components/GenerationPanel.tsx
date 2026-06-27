import { useState, useMemo } from 'react'
import { useNumberingStore } from '@/store/numberingStore'
import { useDesignStore } from '@/store/designStore'
import { useUserStore } from '@/store/userStore'
import { exportPDF } from '@/lib/pdf'
import type { CanvasObject } from '@/lib/pdf'
import { maxPagesForTier, canExportWithoutWatermark } from '@/lib/featureGate'
import { generateNumbers } from '@/lib/numbering'

interface Props {
  onClose: () => void
  getCanvasObjects: () => CanvasObject[]
  designName: string
}

export default function GenerationPanel({ onClose, getCanvasObjects, designName }: Props) {
  const numberingStore = useNumberingStore()
  const designStore = useDesignStore()
  const { tier } = useUserStore()

  // Local state — initialized from stores; written back to stores on Generate
  const [mode, setMode] = useState<'standard' | 'books'>(numberingStore.booksCount > 1 ? 'books' : 'standard')
  const [prefix, setPrefix] = useState(numberingStore.prefix)
  const [start, setStart] = useState(numberingStore.start)
  const [digits, setDigits] = useState(numberingStore.digits)
  const [suffix, setSuffix] = useState(numberingStore.suffix)
  const step = numberingStore.step
  const [total, setTotal] = useState(numberingStore.total)
  const [booksCount, setBooksCount] = useState(Math.max(1, numberingStore.booksCount))
  const [itemsPerBook, setItemsPerBook] = useState(Math.max(1, numberingStore.itemsPerBook))
  const [copiesPerItem, setCopiesPerItem] = useState<1 | 2 | 3>(numberingStore.copiesPerItem)
  const [cropMarks, setCropMarks] = useState(true)
  const [exporting, setExporting] = useState(false)

  const slotsPerPage = designStore.receiptsPerPage
  const effectiveTotal = mode === 'books' ? booksCount * itemsPerBook : total
  const totalSlots = effectiveTotal * copiesPerItem
  const rawPageCount = Math.ceil(totalSlots / slotsPerPage)
  const tierMax = maxPagesForTier(tier)
  const pageCount = Math.min(rawPageCount, tierMax)
  const isOverLimit = rawPageCount > tierMax

  const preview = useMemo(() => {
    const cfg = { prefix, start, digits, step, suffix, total: Math.min(effectiveTotal, 3) }
    return generateNumbers(cfg).join(', ')
  }, [prefix, start, digits, step, suffix, effectiveTotal])

  const firstBook = mode === 'books' && booksCount > 0 && itemsPerBook > 0
    ? `${prefix}${String(start).padStart(digits, '0')}${suffix} → ${prefix}${String(start + itemsPerBook - 1).padStart(digits, '0')}${suffix}`
    : null

  async function handleGenerate() {
    setExporting(true)
    try {
      // Persist generation settings back to store
      numberingStore.setConfig({ prefix, start, digits, step, suffix, total: effectiveTotal })
      numberingStore.setBooksCount(mode === 'books' ? booksCount : 1)
      numberingStore.setItemsPerBook(itemsPerBook)
      numberingStore.setCopiesPerItem(copiesPerItem)

      const clampedTotal = Math.min(effectiveTotal, tierMax)

      const bytes = await exportPDF({
        paperSize: designStore.paperSize,
        orientation: designStore.orientation,
        customSize: designStore.customSize,
        bleedEnabled: designStore.bleedEnabled,
        cropMarks,
        watermark: !canExportWithoutWatermark(tier),
        cmyk: false,
        receiptsPerPage: designStore.receiptsPerPage,
        numberingEnabled: numberingStore.numberingEnabled,
        twoUpOrientation: designStore.twoUpOrientation,
        perforationLines: designStore.perforationLines,
        copiesPerItem,
        numbering: { prefix, start, digits, step, suffix, total: clampedTotal },
        canvasObjects: getCanvasObjects(),
      })

      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${designName.replace(/\s+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-krb-rule shrink-0">
          <div>
            <h2 className="font-bold text-krb-navy text-lg leading-tight">Generate PDF</h2>
            <p className="text-xs text-krb-ink3 mt-0.5">Design once — generate thousands</p>
          </div>
          <button type="button" onClick={onClose} className="text-krb-ink3 hover:text-krb-ink text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-krb-bg">&times;</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Output Mode */}
          <section>
            <h3 className="text-[11px] font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Output Mode</h3>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(['standard', 'books'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${mode === m ? 'border-krb-navy bg-krb-navy/5 text-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy/40'}`}>
                  {m === 'standard' ? '📄  Standard' : '📚  Books'}
                </button>
              ))}
            </div>

            {mode === 'standard' && (
              <div>
                <label className="text-xs text-krb-ink3 block mb-1">Total items</label>
                <input type="number" min={1} value={total} title="Total items"
                  onChange={(e) => setTotal(Math.max(1, Number(e.target.value)))}
                  className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy" />
              </div>
            )}

            {mode === 'books' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-krb-ink3 block mb-1">Number of books</label>
                    <input type="number" min={1} value={booksCount} title="Number of books"
                      onChange={(e) => setBooksCount(Math.max(1, Number(e.target.value)))}
                      className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy" />
                  </div>
                  <div>
                    <label className="text-xs text-krb-ink3 block mb-1">Items per book</label>
                    <input type="number" min={1} value={itemsPerBook} title="Items per book"
                      onChange={(e) => setItemsPerBook(Math.max(1, Number(e.target.value)))}
                      className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy" />
                  </div>
                </div>
                <div className="bg-krb-bg rounded-lg px-3 py-2.5 text-xs text-krb-ink3 space-y-0.5">
                  <div>
                    <span className="font-semibold text-krb-navy">{booksCount.toLocaleString()}</span> book{booksCount !== 1 ? 's' : ''} × <span className="font-semibold text-krb-navy">{itemsPerBook}</span> items = <span className="font-semibold text-krb-navy">{effectiveTotal.toLocaleString()}</span> total
                  </div>
                  {firstBook && <div className="text-krb-ink3">Book 1: {firstBook}</div>}
                </div>
              </div>
            )}
          </section>

          {/* Numbering */}
          <section>
            <h3 className="text-[11px] font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Numbering</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-krb-ink3 block mb-1">Prefix</label>
                <input type="text" value={prefix} title="Prefix" onChange={(e) => setPrefix(e.target.value)}
                  className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy" />
              </div>
              <div>
                <label className="text-xs text-krb-ink3 block mb-1">Suffix</label>
                <input type="text" value={suffix} title="Suffix" onChange={(e) => setSuffix(e.target.value)}
                  className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy" />
              </div>
              <div>
                <label className="text-xs text-krb-ink3 block mb-1">Start number</label>
                <input type="number" min={0} value={start} title="Start number" onChange={(e) => setStart(Number(e.target.value))}
                  className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy" />
              </div>
              <div>
                <label className="text-xs text-krb-ink3 block mb-1">Format</label>
                <select value={digits} title="Number format" onChange={(e) => setDigits(Number(e.target.value))}
                  className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy">
                  <option value={1}>1, 2, 3 …</option>
                  <option value={2}>01, 02, 03 …</option>
                  <option value={3}>001, 002, 003 …</option>
                  <option value={4}>0001, 0002 … (default)</option>
                  <option value={5}>00001, 00002 …</option>
                  <option value={6}>000001, 000002 …</option>
                </select>
              </div>
            </div>
            <div className="mt-2 bg-krb-bg rounded-lg px-3 py-2 text-xs font-mono text-krb-ink3 break-all">
              {preview}, …
            </div>
          </section>

          {/* Copies per Item */}
          <section>
            <h3 className="text-[11px] font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Copies per Item</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                [1, 'Original'],
                [2, 'Duplicate'],
                [3, 'Triplicate'],
              ] as [1 | 2 | 3, string][]).map(([n, label]) => (
                <button key={n} type="button" onClick={() => setCopiesPerItem(n)}
                  className={`py-3 rounded-xl border-2 text-xs font-semibold transition-all ${copiesPerItem === n ? 'border-krb-navy bg-krb-navy/5 text-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy/40'}`}>
                  {label}
                </button>
              ))}
            </div>
            {copiesPerItem > 1 && (
              <p className="text-xs text-krb-ink3 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Each number prints {copiesPerItem}× consecutively — ideal for NCR / carbon copy books.
              </p>
            )}
          </section>

          {/* Layout summary */}
          <section>
            <h3 className="text-[11px] font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Output Summary</h3>
            <div className="bg-krb-bg rounded-xl px-4 py-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-krb-ink3">Paper size</span>
                <span className="font-medium text-krb-ink">{designStore.paperSize} · {designStore.orientation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-krb-ink3">Items per page</span>
                <span className="font-medium text-krb-ink">{slotsPerPage}-up</span>
              </div>
              <div className="flex justify-between">
                <span className="text-krb-ink3">Unique items</span>
                <span className="font-medium text-krb-ink">{effectiveTotal.toLocaleString()}</span>
              </div>
              {copiesPerItem > 1 && (
                <div className="flex justify-between">
                  <span className="text-krb-ink3">Total slots (×{copiesPerItem})</span>
                  <span className="font-medium text-krb-ink">{totalSlots.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-krb-rule">
                <span className="text-krb-ink3">PDF pages</span>
                <span className={`font-bold ${isOverLimit ? 'text-amber-600' : 'text-krb-navy'}`}>
                  {pageCount.toLocaleString()}
                  {isOverLimit && <span className="font-normal text-amber-600 ml-1">(capped — upgrade to unlock)</span>}
                </span>
              </div>
            </div>
          </section>

          {/* Print Marks */}
          <section>
            <h3 className="text-[11px] font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Print Marks</h3>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={cropMarks} onChange={(e) => setCropMarks(e.target.checked)} className="rounded" />
                <span>Crop marks</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={designStore.bleedEnabled} onChange={(e) => designStore.setBleedEnabled(e.target.checked)} className="rounded" />
                <span>Bleed (3 mm)</span>
              </label>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-krb-rule shrink-0 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-krb-rule rounded-xl py-2.5 text-sm font-medium hover:bg-krb-bg transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleGenerate}
            disabled={exporting || effectiveTotal === 0}
            className="flex-1 bg-krb-orange text-white rounded-xl py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity">
            {exporting ? 'Generating…' : `Generate ${pageCount.toLocaleString()} page${pageCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
