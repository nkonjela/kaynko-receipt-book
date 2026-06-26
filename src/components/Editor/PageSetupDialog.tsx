import { useState } from 'react'
import type { PaperSizeName, Orientation, BindingType, BindingSide, CustomSize, ReceiptsPerPage } from '@/store/designStore'

export interface PageSetupSettings {
  paperSize: PaperSizeName
  orientation: Orientation
  customSize: CustomSize | null
  bleedEnabled: boolean
  showSafeZone: boolean
  bindingType: BindingType
  bindingSide: BindingSide
  twoUpOrientation: 'h' | 'v'
  receiptsPerPage: ReceiptsPerPage
}

const RPP_OPTIONS: { value: ReceiptsPerPage; label: string; cols: number; rows: number }[] = [
  { value: 1, label: '1-up', cols: 1, rows: 1 },
  { value: 2, label: '2-up', cols: 1, rows: 2 },
  { value: 4, label: '4-up', cols: 2, rows: 2 },
  { value: 6, label: '6-up', cols: 3, rows: 2 },
  { value: 8, label: '8-up', cols: 4, rows: 2 },
]

function SlotGridIcon({ cols, rows, size = 32 }: { cols: number; rows: number; size?: number }) {
  const gap = 1
  const cellW = (size - gap * (cols + 1)) / cols
  const cellH = (size - gap * (rows + 1)) / rows
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <rect
            key={`${r}-${c}`}
            x={gap + c * (cellW + gap)}
            y={gap + r * (cellH + gap)}
            width={cellW}
            height={cellH}
            rx={1}
            fill="currentColor"
          />
        ))
      )}
    </svg>
  )
}

interface Preset {
  label: string
  paperSize: PaperSizeName
  widthMm: number
  heightMm: number
}

const PRESET_GROUPS: Record<string, Preset[]> = {
  ISO: [
    { label: 'A6 — 105 × 148 mm', paperSize: 'A6', widthMm: 105, heightMm: 148 },
    { label: 'A5 — 148 × 210 mm', paperSize: 'A5', widthMm: 148, heightMm: 210 },
    { label: 'A4 — 210 × 297 mm', paperSize: 'A4', widthMm: 210, heightMm: 297 },
    { label: 'A3 — 297 × 420 mm', paperSize: 'A3', widthMm: 297, heightMm: 420 },
    { label: 'DL — 99 × 210 mm', paperSize: 'DL', widthMm: 99, heightMm: 210 },
  ],
  US: [
    { label: 'Letter — 215.9 × 279.4 mm', paperSize: 'US Letter', widthMm: 215.9, heightMm: 279.4 },
    { label: 'Half Letter — 139.7 × 215.9 mm', paperSize: 'Half Letter', widthMm: 139.7, heightMm: 215.9 },
  ],
  Receipt: [
    { label: 'Slip/Register — 215.9 × 83.8 mm', paperSize: 'Slip/Register', widthMm: 215.9, heightMm: 83.8 },
    { label: '80mm Roll — 80 × 297 mm', paperSize: 'Custom', widthMm: 80, heightMm: 297 },
  ],
  Custom: [],
}

type UnitKey = 'mm' | 'in' | 'cm'

function toUnit(mm: number, unit: UnitKey): string {
  if (unit === 'in') return (mm / 25.4).toFixed(3)
  if (unit === 'cm') return (mm / 10).toFixed(2)
  return mm.toFixed(1)
}

function toMm(value: number, unit: UnitKey): number {
  if (unit === 'in') return value * 25.4
  if (unit === 'cm') return value * 10
  return value
}

interface Props {
  title?: string
  initialSettings?: Partial<PageSetupSettings>
  onConfirm: (settings: PageSetupSettings) => void
  onClose: () => void
}

export default function PageSetupDialog({ title = 'New Design', initialSettings, onConfirm, onClose }: Props) {
  const [category, setCategory] = useState('ISO')
  const [selectedPreset, setSelectedPreset] = useState<Preset>(PRESET_GROUPS['ISO'][1])
  const [widthMm, setWidthMm] = useState(initialSettings?.customSize?.widthMm ?? 148)
  const [heightMm, setHeightMm] = useState(initialSettings?.customSize?.heightMm ?? 210)
  const [unit, setUnit] = useState<UnitKey>('mm')
  const [orientation, setOrientation] = useState<Orientation>(initialSettings?.orientation ?? 'portrait')
  const [bleedEnabled, setBleedEnabled] = useState(initialSettings?.bleedEnabled ?? true)
  const [showSafeZone, setShowSafeZone] = useState(initialSettings?.showSafeZone ?? true)
  const [bindingType, setBindingType] = useState<BindingType>(initialSettings?.bindingType ?? 'pad')
  const [bindingSide, setBindingSide] = useState<BindingSide>(initialSettings?.bindingSide ?? 'bottom')
  const [twoUpOrientation, setTwoUpOrientation] = useState<'h' | 'v'>(initialSettings?.twoUpOrientation ?? 'v')
  const [receiptsPerPage, setReceiptsPerPage] = useState<ReceiptsPerPage>(initialSettings?.receiptsPerPage ?? 1)
  const [widthInput, setWidthInput] = useState(toUnit(148, 'mm'))
  const [heightInput, setHeightInput] = useState(toUnit(210, 'mm'))
  const [customError, setCustomError] = useState('')

  function applyPresetDims(preset: Preset, orient: Orientation) {
    let w = preset.widthMm
    let h = preset.heightMm
    if (orient === 'landscape' && w < h) { const t = w; w = h; h = t }
    if (orient === 'portrait' && w > h) { const t = w; w = h; h = t }
    setWidthMm(w)
    setHeightMm(h)
    setWidthInput(toUnit(w, unit))
    setHeightInput(toUnit(h, unit))
    setCustomError('')
  }

  function pickPreset(preset: Preset) {
    setSelectedPreset(preset)
    applyPresetDims(preset, orientation)
  }

  function pickCategory(cat: string) {
    setCategory(cat)
    if (cat !== 'Custom' && PRESET_GROUPS[cat].length > 0) {
      const first = PRESET_GROUPS[cat][0]
      setSelectedPreset(first)
      applyPresetDims(first, orientation)
    }
  }

  function changeOrientation(orient: Orientation) {
    setOrientation(orient)
    if ((orient === 'landscape' && widthMm < heightMm) || (orient === 'portrait' && widthMm > heightMm)) {
      const newW = heightMm
      const newH = widthMm
      setWidthMm(newW)
      setHeightMm(newH)
      setWidthInput(toUnit(newW, unit))
      setHeightInput(toUnit(newH, unit))
    }
  }

  function changeUnit(newUnit: UnitKey) {
    setUnit(newUnit)
    setWidthInput(toUnit(widthMm, newUnit))
    setHeightInput(toUnit(heightMm, newUnit))
  }

  function handleWidthChange(val: string) {
    setWidthInput(val)
    const mm = toMm(parseFloat(val), unit)
    if (!isNaN(mm) && mm > 0) setWidthMm(mm)
  }

  function handleHeightChange(val: string) {
    setHeightInput(val)
    const mm = toMm(parseFloat(val), unit)
    if (!isNaN(mm) && mm > 0) setHeightMm(mm)
  }

  function handleConfirm() {
    if (widthMm < 50 || widthMm > 1200 || heightMm < 50 || heightMm > 1200) {
      setCustomError('Dimensions must be between 50 mm and 1200 mm.')
      return
    }
    const isCustom = category === 'Custom' || selectedPreset.paperSize === 'Custom'
    const paperSizeName: PaperSizeName = isCustom ? 'Custom' : selectedPreset.paperSize
    onConfirm({
      paperSize: paperSizeName,
      orientation,
      customSize: paperSizeName === 'Custom' ? { widthMm, heightMm } : null,
      bleedEnabled,
      showSafeZone,
      bindingType,
      bindingSide,
      twoUpOrientation,
      receiptsPerPage,
    })
  }

  const presets = PRESET_GROUPS[category] ?? []

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-[500px] max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-krb-rule flex items-center justify-between">
          <h2 className="text-lg font-bold text-krb-navy">{title}</h2>
          <button type="button" onClick={onClose} className="text-krb-ink3 hover:text-krb-ink text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Receipts per page */}
          <div>
            <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block mb-2">Receipts per Page</label>
            <div className="flex gap-2 flex-wrap">
              {RPP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReceiptsPerPage(opt.value)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border-2 transition-colors ${
                    receiptsPerPage === opt.value
                      ? 'border-krb-navy bg-krb-navy/5 text-krb-navy'
                      : 'border-krb-rule text-krb-ink3 hover:border-krb-navy/40'
                  }`}
                >
                  <SlotGridIcon cols={opt.cols} rows={opt.rows} />
                  <span className="text-xs font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
            {receiptsPerPage > 1 && (
              <p className="text-xs text-krb-ink3 mt-2 bg-krb-bg rounded-lg px-3 py-2">
                You&apos;ll design one receipt slot — the PDF will tile {receiptsPerPage} copies per page automatically.
              </p>
            )}
            {receiptsPerPage === 2 && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block mb-2">2-up Arrangement</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTwoUpOrientation('v')}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition-colors text-xs font-medium ${
                      twoUpOrientation === 'v' ? 'border-krb-navy bg-krb-navy/5 text-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy/40'
                    }`}
                  >
                    <svg width="24" height="28" viewBox="0 0 24 28"><rect x="2" y="1" width="20" height="12" rx="2" fill="currentColor" opacity="0.7"/><rect x="2" y="15" width="20" height="12" rx="2" fill="currentColor" opacity="0.4"/></svg>
                    Stacked
                  </button>
                  <button
                    type="button"
                    onClick={() => setTwoUpOrientation('h')}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border-2 transition-colors text-xs font-medium ${
                      twoUpOrientation === 'h' ? 'border-krb-navy bg-krb-navy/5 text-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy/40'
                    }`}
                  >
                    <svg width="28" height="24" viewBox="0 0 28 24"><rect x="1" y="2" width="12" height="20" rx="2" fill="currentColor" opacity="0.7"/><rect x="15" y="2" width="12" height="20" rx="2" fill="currentColor" opacity="0.4"/></svg>
                    Side by Side
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Category tabs + preset select */}
          <div>
            <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block mb-2">Paper Size</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {Object.keys(PRESET_GROUPS).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => pickCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    category === cat
                      ? 'bg-krb-navy text-white border-krb-navy'
                      : 'border-krb-rule text-krb-ink3 hover:border-krb-navy hover:text-krb-navy'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {category !== 'Custom' && presets.length > 0 && (
              <select
                value={selectedPreset.label}
                onChange={(e) => {
                  const preset = presets.find((p) => p.label === e.target.value)
                  if (preset) pickPreset(preset)
                }}
                className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy"
              >
                {presets.map((p) => (
                  <option key={p.label} value={p.label}>{p.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Width / Height / Unit */}
          <div>
            <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block mb-2">Dimensions</label>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-krb-ink3 block mb-1">Width</label>
                <input
                  type="number"
                  step="any"
                  value={widthInput}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-krb-ink3 block mb-1">Height</label>
                <input
                  type="number"
                  step="any"
                  value={heightInput}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-krb-ink3 block mb-1">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => changeUnit(e.target.value as UnitKey)}
                  className="w-full border border-krb-rule rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-krb-navy"
                >
                  <option value="mm">mm</option>
                  <option value="in">inch</option>
                  <option value="cm">cm</option>
                </select>
              </div>
            </div>
            {customError && <p className="text-red-500 text-xs mt-1.5">{customError}</p>}
          </div>

          {/* Orientation */}
          <div>
            <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block mb-2">Orientation</label>
            <div className="flex gap-3">
              {(['portrait', 'landscape'] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => changeOrientation(o)}
                  className={`flex-1 flex items-center justify-center gap-3 py-3 rounded-xl border-2 transition-colors text-sm font-medium ${
                    orientation === o
                      ? 'border-krb-navy bg-krb-navy/5 text-krb-navy'
                      : 'border-krb-rule text-krb-ink3 hover:border-krb-navy/40'
                  }`}
                >
                  <span
                    className={`border-2 rounded-sm inline-block ${
                      o === 'portrait' ? 'w-4 h-6' : 'w-6 h-4'
                    } ${orientation === o ? 'border-krb-navy' : 'border-current'}`}
                  />
                  {o.charAt(0).toUpperCase() + o.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Print settings */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block">Print Settings</label>
            <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={bleedEnabled} onChange={(e) => setBleedEnabled(e.target.checked)} className="rounded" />
              <span>3 mm bleed <span className="text-krb-ink3 text-xs">(recommended for all print jobs)</span></span>
            </label>
            <label className="flex items-center gap-3 text-sm cursor-pointer select-none">
              <input type="checkbox" checked={showSafeZone} onChange={(e) => setShowSafeZone(e.target.checked)} className="rounded" />
              <span>Show safe zone overlay <span className="text-krb-ink3 text-xs">(5 mm from trim edge)</span></span>
            </label>
          </div>

          {/* Binding */}
          <div>
            <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block mb-2">Binding Type</label>
            <select
              value={bindingType}
              onChange={(e) => setBindingType(e.target.value as BindingType)}
              className="w-full border border-krb-rule rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-krb-navy"
            >
              <option value="none">None / Single page</option>
              <option value="pad">Pad binding — glued spine, tear-off (most common for receipt books)</option>
              <option value="saddle">Saddle stitch — stapled through fold (must be multiples of 4 pages)</option>
              <option value="wire-o">Wire-O / Spiral — keep content 8 mm from spine</option>
            </select>
            {bindingType === 'saddle' && (
              <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 rounded-lg px-3 py-2">
                Saddle stitch requires total pages to be a multiple of 4. Set your "Total pages" in the numbering panel accordingly.
              </p>
            )}
            {bindingType === 'wire-o' && (
              <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 rounded-lg px-3 py-2">
                Wire-O binding punches holes 6 mm from the left edge. Keep all text and logos at least 8 mm from the spine side.
              </p>
            )}
            {bindingType !== 'none' && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider block mb-2">Binding Edge</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setBindingSide(side)}
                      className={`py-1.5 rounded-lg border-2 text-xs font-medium capitalize transition-colors ${
                        bindingSide === side
                          ? 'border-krb-navy bg-krb-navy/5 text-krb-navy'
                          : 'border-krb-rule text-krb-ink3 hover:border-krb-navy/40'
                      }`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-krb-ink3 mt-1.5">
                  A guide stripe will mark the binding edge on your canvas.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3 border-t border-krb-rule pt-4">
          <button type="button" onClick={onClose} className="border border-krb-rule rounded-xl px-5 py-2.5 text-sm hover:bg-krb-bg">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="bg-krb-orange text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:opacity-90"
          >
            {title === 'New Design' ? 'Create design →' : 'Apply changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
