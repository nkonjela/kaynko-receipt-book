import { useEffect, useRef, useState } from 'react'
import type { Canvas as FabricCanvas, FabricObject, Group } from 'fabric'
import { Textbox } from 'fabric'
import { rebuildTable } from '@/lib/canvas'
import type { TableConfig } from '@/lib/canvas'

const PX_TO_MM = 25.4 / 96
const MM_TO_PX = 96 / 25.4

const FONT_FAMILIES = [
  'Arial', 'Helvetica', 'Times New Roman', 'Courier New',
  'Georgia', 'Verdana', 'Trebuchet MS', 'Impact',
]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96]

const DASH_PRESETS: { key: string; title: string; value: number[] }[] = [
  { key: 'solid',   title: 'Solid',     value: [] },
  { key: 'dash',    title: 'Dashed',    value: [8, 4] },
  { key: 'ldash',   title: 'Long dash', value: [16, 6] },
  { key: 'dot',     title: 'Dotted',    value: [2, 4] },
  { key: 'dashdot', title: 'Dash-dot',  value: [8, 4, 2, 4] },
]

const DASH_ICONS = ['─', '╌', '╴', '·', '·╴']

function ColourInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [textVal, setTextVal] = useState(value)
  useEffect(() => setTextVal(value), [value])
  return (
    <div>
      {label && <div className="text-xs text-krb-ink3 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => inputRef.current?.click()}
          style={{ backgroundColor: value }}
          className="w-7 h-7 rounded border border-krb-rule flex-shrink-0 cursor-pointer shadow-sm"
          title="Pick colour" />
        <input ref={inputRef} type="color" value={value}
          onChange={(e) => { onChange(e.target.value); setTextVal(e.target.value) }}
          className="sr-only" />
        <input type="text" value={textVal} maxLength={7}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={(e) => {
            let v = e.target.value.trim()
            if (!v.startsWith('#')) v = '#' + v
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
            else setTextVal(value)
          }}
          className="border border-krb-rule rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none focus:border-krb-navy" />
      </div>
    </div>
  )
}

interface Props {
  canvas: FabricCanvas | null
  selectedObj: FabricObject | null
  onChanged: () => void
}

export default function PropertiesPanel({ canvas, selectedObj, onChanged }: Props) {
  // Text
  const [fontFamily, setFontFamily] = useState('Arial')
  const [fontSize, setFontSize] = useState(14)
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [strikethrough, setStrikethrough] = useState(false)
  const [textAlign, setTextAlign] = useState('left')
  const [textColor, setTextColor] = useState('#1A1A1A')
  const [charSpacing, setCharSpacing] = useState(0)
  const [lineHeight, setLineHeight] = useState(1.2)
  // Fill / stroke
  const [fillColor, setFillColor] = useState('#E8E5E0')
  const [strokeColor, setStrokeColor] = useState('#1A1A1A')
  const [strokeWidth, setStrokeWidth] = useState(0.5)
  const [dashArray, setDashArray] = useState<number[]>([])
  const [lineCap, setLineCap] = useState<'butt' | 'round' | 'square'>('butt')
  // Misc
  const [opacity, setOpacity] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [borderRadius, setBorderRadius] = useState(0)
  // Position & size
  const [xMm, setXMm] = useState('0')
  const [yMm, setYMm] = useState('0')
  const [wMm, setWMm] = useState('0')
  const [hMm, setHMm] = useState('0')
  // Table
  const [tableRows, setTableRows] = useState(2)
  const [tableCols, setTableCols] = useState(2)
  const [tableRowHeights, setTableRowHeights] = useState<number[]>([10, 10])
  const [tableColWidths, setTableColWidths] = useState<number[]>([30, 30])
  const [tableBorderColor, setTableBorderColor] = useState('#1A1A1A')
  const [tableBorderWidth, setTableBorderWidth] = useState(1)
  const [tableHeaderBg, setTableHeaderBg] = useState('#E8F0FE')
  const [tableHeaderEnabled, setTableHeaderEnabled] = useState(false)
  const [tableAltRowBg, setTableAltRowBg] = useState('#F8F9FA')
  const [tableAltEnabled, setTableAltEnabled] = useState(false)
  const [tableCellPaddingMm, setTableCellPaddingMm] = useState(1)

  const isText = selectedObj instanceof Textbox
  const objType = selectedObj?.type ?? ''
  const isLine = objType === 'line'
  const isGroup = objType === 'group'
  const isRect = objType === 'rect'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableData = isGroup ? (selectedObj as any).data : null
  const isTable = tableData?.type === 'table'
  const hasStroke = isRect || isLine

  useEffect(() => {
    if (!selectedObj) return

    if (isText) {
      const t = selectedObj as Textbox
      setFontFamily(t.fontFamily ?? 'Arial')
      setFontSize(t.fontSize ?? 14)
      setBold(t.fontWeight === 'bold')
      setItalic(t.fontStyle === 'italic')
      setUnderline(t.underline ?? false)
      setStrikethrough(t.linethrough ?? false)
      setTextAlign(t.textAlign ?? 'left')
      setTextColor(typeof t.fill === 'string' ? t.fill : '#1A1A1A')
      setCharSpacing((t.charSpacing ?? 0) / 100)
      setLineHeight(t.lineHeight ?? 1.2)
    }

    if (!isLine && !isGroup) {
      setFillColor(typeof selectedObj.fill === 'string' ? selectedObj.fill : '#E8E5E0')
    }

    if (hasStroke) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = selectedObj as any
      setStrokeColor(typeof s.stroke === 'string' ? s.stroke : '#1A1A1A')
      setStrokeWidth(s.strokeWidth ?? 1)
      setDashArray(s.strokeDashArray ?? [])
      if (isLine) setLineCap(s.strokeLineCap ?? 'butt')
    }

    if (isRect) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setBorderRadius((selectedObj as any).rx ?? 0)
    }

    if (isTable && tableData) {
      const d = tableData
      const r = d.rows ?? 2
      const c = d.cols ?? 2
      setTableRows(r)
      setTableCols(c)
      setTableRowHeights(d.rowHeightsMm ?? Array<number>(r).fill(d.cellHMm ?? 10))
      setTableColWidths(d.colWidthsMm ?? Array<number>(c).fill(d.cellWMm ?? 30))
      setTableBorderColor(d.borderColor ?? '#1A1A1A')
      setTableBorderWidth(d.borderWidth ?? 1)
      setTableHeaderEnabled(!!d.headerBg)
      setTableHeaderBg(d.headerBg || '#E8F0FE')
      setTableAltEnabled(!!d.altRowBg)
      setTableAltRowBg(d.altRowBg || '#F8F9FA')
      setTableCellPaddingMm(d.cellPaddingMm ?? 1)
    }

    setOpacity(Math.round((selectedObj.opacity ?? 1) * 100))
    setRotation(Math.round(selectedObj.angle ?? 0))

    const w = (selectedObj.width ?? 0) * (selectedObj.scaleX ?? 1)
    const h = (selectedObj.height ?? 0) * (selectedObj.scaleY ?? 1)
    setXMm(((selectedObj.left ?? 0) * PX_TO_MM).toFixed(1))
    setYMm(((selectedObj.top ?? 0) * PX_TO_MM).toFixed(1))
    setWMm((w * PX_TO_MM).toFixed(1))
    setHMm((h * PX_TO_MM).toFixed(1))
  }, [selectedObj, isText, isLine, isGroup, isRect, isTable, tableData, hasStroke])

  function update(props: Record<string, unknown>) {
    if (!selectedObj || !canvas) return
    selectedObj.set(props as Parameters<typeof selectedObj.set>[0])
    canvas.requestRenderAll()
    onChanged()
  }

  function applyTable(partial: Partial<TableConfig>) {
    if (!canvas || !selectedObj || !isTable) return
    rebuildTable(canvas, selectedObj as unknown as Group, partial)
    onChanged()
  }

  function setPos(field: 'left' | 'top', mmVal: string) {
    const px = parseFloat(mmVal) * MM_TO_PX
    if (!isNaN(px)) update({ [field]: px })
  }

  function setSize(field: 'scaleX' | 'scaleY', mmVal: string, basePx: number) {
    const px = parseFloat(mmVal) * MM_TO_PX
    if (!isNaN(px) && basePx > 0) update({ [field]: px / basePx })
  }

  function duplicateObj() {
    if (!selectedObj || !canvas) return
    void selectedObj.clone().then((cloned: FabricObject) => {
      cloned.set({ left: (selectedObj.left ?? 0) + 10, top: (selectedObj.top ?? 0) + 10 })
      canvas.add(cloned)
      canvas.setActiveObject(cloned)
      canvas.requestRenderAll()
      onChanged()
    })
  }

  function deleteObj() {
    if (!selectedObj || !canvas) return
    canvas.remove(selectedObj)
    canvas.discardActiveObject()
    canvas.requestRenderAll()
    onChanged()
  }

  const inp = 'w-full border border-krb-rule rounded px-2 py-1 text-sm focus:outline-none focus:border-krb-navy'
  const lbl = 'text-xs text-krb-ink3 block mb-1'
  const sec = 'space-y-3 pb-4 mb-1 border-b border-krb-rule'
  const togBtn = (active: boolean) =>
    `w-8 h-8 rounded border text-sm font-semibold transition-colors ${active ? 'bg-krb-navy text-white border-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy'}`

  const lineLengthMm = isLine ? (() => {
    const w = (selectedObj!.width ?? 0) * (selectedObj!.scaleX ?? 1)
    const h = (selectedObj!.height ?? 0) * (selectedObj!.scaleY ?? 1)
    return (Math.sqrt(w * w + h * h) * PX_TO_MM).toFixed(1)
  })() : '0'

  const currentDash = JSON.stringify(dashArray ?? [])

  if (!selectedObj) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-3xl mb-2 opacity-20">◻</div>
        <p className="text-xs text-krb-ink3 text-center leading-relaxed">Select an object to edit its properties</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col p-3 overflow-y-auto">
      <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-3">Properties</div>

      {/* ── Table ── */}
      {isTable && (
        <div className={sec}>
          <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Table</div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Rows</label>
              <input type="number" min={1} max={30} value={tableRows}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value))
                  setTableRows(v)
                  const next = [...tableRowHeights]
                  while (next.length < v) next.push(next[next.length - 1] ?? 10)
                  applyTable({ rows: v, rowHeightsMm: next.slice(0, v) })
                }}
                className={inp} />
            </div>
            <div>
              <label className={lbl}>Cols</label>
              <input type="number" min={1} max={12} value={tableCols}
                onChange={(e) => {
                  const v = Math.max(1, Number(e.target.value))
                  setTableCols(v)
                  const next = [...tableColWidths]
                  while (next.length < v) next.push(next[next.length - 1] ?? 30)
                  applyTable({ cols: v, colWidthsMm: next.slice(0, v) })
                }}
                className={inp} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={lbl}>Row heights (mm)</span>
              <button type="button" className="text-xs text-krb-navy hover:underline"
                onClick={() => {
                  const avg = tableRowHeights.reduce((a, b) => a + b, 0) / tableRowHeights.length
                  const eq = tableRowHeights.map(() => parseFloat(avg.toFixed(1)))
                  setTableRowHeights(eq)
                  applyTable({ rowHeightsMm: eq })
                }}>Equalize</button>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {tableRowHeights.map((h, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs text-krb-ink3 w-4 shrink-0">{i + 1}</span>
                  <input type="number" step="0.5" min="3" defaultValue={h}
                    key={`rh-${i}-${h}`}
                    onBlur={(e) => {
                      const v = Math.max(3, Number(e.target.value))
                      const next = [...tableRowHeights]
                      next[i] = v
                      setTableRowHeights(next)
                      applyTable({ rowHeightsMm: next })
                    }}
                    className="flex-1 border border-krb-rule rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-krb-navy" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={lbl}>Col widths (mm)</span>
              <button type="button" className="text-xs text-krb-navy hover:underline"
                onClick={() => {
                  const avg = tableColWidths.reduce((a, b) => a + b, 0) / tableColWidths.length
                  const eq = tableColWidths.map(() => parseFloat(avg.toFixed(1)))
                  setTableColWidths(eq)
                  applyTable({ colWidthsMm: eq })
                }}>Equalize</button>
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {tableColWidths.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs text-krb-ink3 w-4 shrink-0">{i + 1}</span>
                  <input type="number" step="0.5" min="5" defaultValue={w}
                    key={`cw-${i}-${w}`}
                    onBlur={(e) => {
                      const v = Math.max(5, Number(e.target.value))
                      const next = [...tableColWidths]
                      next[i] = v
                      setTableColWidths(next)
                      applyTable({ colWidthsMm: next })
                    }}
                    className="flex-1 border border-krb-rule rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-krb-navy" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ColourInput label="Border colour" value={tableBorderColor}
              onChange={(v) => { setTableBorderColor(v); applyTable({ borderColor: v }) }} />
            <div>
              <label className={lbl}>Border width</label>
              <input type="number" step="0.25" min="0.25" defaultValue={tableBorderWidth}
                key={`bw-${tableBorderWidth}`}
                onBlur={(e) => { const v = Math.max(0.25, Number(e.target.value)); setTableBorderWidth(v); applyTable({ borderWidth: v }) }}
                className={inp} />
            </div>
          </div>

          <div>
            <label className={lbl}>Cell padding (mm)</label>
            <input type="number" step="0.5" min="0" max="5" defaultValue={tableCellPaddingMm}
              key={`cp-${tableCellPaddingMm}`}
              onBlur={(e) => { const v = Math.max(0, Number(e.target.value)); setTableCellPaddingMm(v); applyTable({ cellPaddingMm: v }) }}
              className={inp} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="hdrEnabled" checked={tableHeaderEnabled}
                onChange={(e) => { setTableHeaderEnabled(e.target.checked); applyTable({ headerBg: e.target.checked ? tableHeaderBg : '' }) }}
                className="accent-krb-navy" />
              <label htmlFor="hdrEnabled" className="text-xs text-krb-ink3 cursor-pointer flex-1">Header row colour</label>
              {tableHeaderEnabled && (
                <input type="color" value={tableHeaderBg}
                  onChange={(e) => { setTableHeaderBg(e.target.value); applyTable({ headerBg: e.target.value }) }}
                  className="w-7 h-7 rounded border border-krb-rule cursor-pointer" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="altEnabled" checked={tableAltEnabled}
                onChange={(e) => { setTableAltEnabled(e.target.checked); applyTable({ altRowBg: e.target.checked ? tableAltRowBg : '' }) }}
                className="accent-krb-navy" />
              <label htmlFor="altEnabled" className="text-xs text-krb-ink3 cursor-pointer flex-1">Alternating rows</label>
              {tableAltEnabled && (
                <input type="color" value={tableAltRowBg}
                  onChange={(e) => { setTableAltRowBg(e.target.value); applyTable({ altRowBg: e.target.value }) }}
                  className="w-7 h-7 rounded border border-krb-rule cursor-pointer" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Text ── */}
      {isText && (
        <div className={sec}>
          <div>
            <label className={lbl}>Font family</label>
            <select value={fontFamily}
              onChange={(e) => { setFontFamily(e.target.value); update({ fontFamily: e.target.value }) }}
              className={inp}>
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className={lbl}>Size (pt)</label>
              <input type="number" value={fontSize} min={4} max={400}
                onChange={(e) => { const v = Number(e.target.value); setFontSize(v); update({ fontSize: v }) }}
                className={inp} />
            </div>
            <select value="" onChange={(e) => { const v = Number(e.target.value); setFontSize(v); update({ fontSize: v }) }}
              className="border border-krb-rule rounded px-1 py-1 text-xs focus:outline-none w-10" title="Quick sizes">
              <option value="">▾</option>
              {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex gap-1">
            <button type="button" title="Bold" onClick={() => { const v = !bold; setBold(v); update({ fontWeight: v ? 'bold' : 'normal' }) }} className={`${togBtn(bold)} font-bold`}>B</button>
            <button type="button" title="Italic" onClick={() => { const v = !italic; setItalic(v); update({ fontStyle: v ? 'italic' : 'normal' }) }} className={`${togBtn(italic)} italic`}>I</button>
            <button type="button" title="Underline" onClick={() => { const v = !underline; setUnderline(v); update({ underline: v }) }} className={`${togBtn(underline)} underline`}>U</button>
            <button type="button" title="Strikethrough" onClick={() => { const v = !strikethrough; setStrikethrough(v); update({ linethrough: v }) }} className={`${togBtn(strikethrough)} line-through`}>S</button>
          </div>

          <div className="flex gap-1">
            {(['left', 'center', 'right', 'justify'] as const).map((a, i) => (
              <button key={a} type="button" title={`Align ${a}`}
                onClick={() => { setTextAlign(a); update({ textAlign: a }) }}
                className={`flex-1 h-8 rounded border text-xs transition-colors ${textAlign === a ? 'bg-krb-navy text-white border-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy'}`}>
                {['⬛', '▣', '⬜', '▤'][i]}
              </button>
            ))}
          </div>

          <ColourInput label="Text colour" value={textColor} onChange={(v) => { setTextColor(v); update({ fill: v }) }} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Spacing</label>
              <input type="number" step="0.5" value={charSpacing}
                onChange={(e) => { const v = Number(e.target.value); setCharSpacing(v); update({ charSpacing: v * 100 }) }}
                className={inp} />
            </div>
            <div>
              <label className={lbl}>Line ht</label>
              <input type="number" step="0.1" min="0.5" max="5" value={lineHeight}
                onChange={(e) => { const v = Number(e.target.value); setLineHeight(v); update({ lineHeight: v }) }}
                className={inp} />
            </div>
          </div>
        </div>
      )}

      {/* ── Fill ── */}
      {!isLine && !isGroup && (
        <div className={sec}>
          <ColourInput label="Fill colour" value={fillColor} onChange={(v) => { setFillColor(v); update({ fill: v }) }} />
          {isRect && (
            <div>
              <label className={lbl}>Corner radius (px)</label>
              <input type="number" min={0} max={200} step={1} value={borderRadius}
                onChange={(e) => { const v = Math.max(0, Number(e.target.value)); setBorderRadius(v); update({ rx: v, ry: v }) }}
                className={inp} />
            </div>
          )}
        </div>
      )}

      {/* ── Stroke ── */}
      {hasStroke && (
        <div className={sec}>
          <ColourInput label="Stroke colour" value={strokeColor} onChange={(v) => { setStrokeColor(v); update({ stroke: v }) }} />
          <div>
            <label className={lbl}>Stroke width (pt)</label>
            <input type="number" step="0.5" min={0} value={strokeWidth}
              onChange={(e) => { const v = Number(e.target.value); setStrokeWidth(v); update({ strokeWidth: v }) }}
              className={inp} />
          </div>
          <div>
            <label className={lbl}>Dash style</label>
            <div className="flex gap-1">
              {DASH_PRESETS.map((p, i) => (
                <button key={p.key} type="button" title={p.title}
                  onClick={() => {
                    setDashArray(p.value)
                    update({ strokeDashArray: p.value.length ? p.value : null })
                  }}
                  className={`flex-1 h-7 rounded border text-base transition-colors ${currentDash === JSON.stringify(p.value) ? 'bg-krb-navy text-white border-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy'}`}>
                  {DASH_ICONS[i]}
                </button>
              ))}
            </div>
          </div>
          {isLine && (
            <div>
              <label className={lbl}>Line cap</label>
              <div className="flex gap-1">
                {(['butt', 'round', 'square'] as const).map((cap) => (
                  <button key={cap} type="button"
                    onClick={() => { setLineCap(cap); update({ strokeLineCap: cap }) }}
                    className={`flex-1 h-7 rounded border text-xs capitalize transition-colors ${lineCap === cap ? 'bg-krb-navy text-white border-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy'}`}>
                    {cap}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Opacity ── */}
      <div className={sec}>
        <label className={lbl}>Opacity: {opacity}%</label>
        <input type="range" min={0} max={100} value={opacity}
          onChange={(e) => { const v = Number(e.target.value); setOpacity(v); update({ opacity: v / 100 }) }}
          className="w-full accent-krb-navy" />
      </div>

      {/* ── Rotation ── */}
      <div className={sec}>
        <label className={lbl}>Rotation (°)</label>
        <input type="number" min={0} max={359} step={1} value={rotation}
          onChange={(e) => { const v = ((Number(e.target.value) % 360) + 360) % 360; setRotation(v); update({ angle: v }) }}
          className={inp} />
      </div>

      {/* ── Position & size ── */}
      <div className={sec}>
        <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Position (mm)</div>
        {isLine ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>X</label>
              <input type="number" step="0.1" value={xMm}
                onChange={(e) => setXMm(e.target.value)}
                onBlur={(e) => setPos('left', e.target.value)}
                className={inp} />
            </div>
            <div>
              <label className={lbl}>Y</label>
              <input type="number" step="0.1" value={yMm}
                onChange={(e) => setYMm(e.target.value)}
                onBlur={(e) => setPos('top', e.target.value)}
                className={inp} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Length</label>
              <div className="border border-krb-rule rounded px-2 py-1 text-sm bg-krb-bg text-krb-ink3">{lineLengthMm} mm</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'X', val: xMm, setVal: setXMm, onBlur: (v: string) => setPos('left', v) },
              { label: 'Y', val: yMm, setVal: setYMm, onBlur: (v: string) => setPos('top', v) },
              { label: 'W', val: wMm, setVal: setWMm, onBlur: (v: string) => setSize('scaleX', v, selectedObj.width ?? 0) },
              { label: 'H', val: hMm, setVal: setHMm, onBlur: (v: string) => setSize('scaleY', v, selectedObj.height ?? 0) },
            ].map(({ label: l, val, setVal, onBlur }) => (
              <div key={l}>
                <label className={lbl}>{l}</label>
                <input type="number" step="0.1" value={val}
                  onChange={(e) => setVal(e.target.value)}
                  onBlur={(e) => onBlur(e.target.value)}
                  className={inp} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="space-y-2 pt-1">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={duplicateObj} className="border border-krb-rule rounded-lg py-1.5 text-xs hover:bg-krb-bg">Duplicate</button>
          <button type="button" onClick={deleteObj} className="border border-red-200 text-red-500 rounded-lg py-1.5 text-xs hover:bg-red-50">Delete</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button"
            onClick={() => { if (canvas && selectedObj) { canvas.bringObjectToFront(selectedObj); canvas.requestRenderAll() } }}
            className="border border-krb-rule rounded-lg py-1.5 text-xs hover:bg-krb-bg">To Front</button>
          <button type="button"
            onClick={() => { if (canvas && selectedObj) { canvas.sendObjectToBack(selectedObj); canvas.requestRenderAll() } }}
            className="border border-krb-rule rounded-lg py-1.5 text-xs hover:bg-krb-bg">To Back</button>
        </div>
      </div>
    </div>
  )
}
