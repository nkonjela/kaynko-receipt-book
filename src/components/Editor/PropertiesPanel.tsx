import { useEffect, useRef, useState } from 'react'
import type { Canvas as FabricCanvas, FabricObject } from 'fabric'
import { Textbox } from 'fabric'

const PX_TO_MM = 25.4 / 96
const MM_TO_PX = 96 / 25.4

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Georgia',
  'Verdana',
  'Trebuchet MS',
  'Impact',
]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96]

function ColourInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [textVal, setTextVal] = useState(value)

  useEffect(() => setTextVal(value), [value])

  return (
    <div>
      {label && <div className="text-xs text-krb-ink3 mb-1">{label}</div>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{ backgroundColor: value }}
          className="w-7 h-7 rounded border border-krb-rule flex-shrink-0 cursor-pointer shadow-sm"
          title="Pick colour"
        />
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => { onChange(e.target.value); setTextVal(e.target.value) }}
          className="sr-only"
        />
        <input
          type="text"
          value={textVal}
          maxLength={7}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={(e) => {
            let v = e.target.value.trim()
            if (!v.startsWith('#')) v = '#' + v
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
            else setTextVal(value)
          }}
          className="border border-krb-rule rounded px-2 py-1 text-xs font-mono w-20 focus:outline-none focus:border-krb-navy"
        />
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
  const [fontFamily, setFontFamily] = useState('Arial')
  const [fontSize, setFontSize] = useState(14)
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [textAlign, setTextAlign] = useState('left')
  const [textColor, setTextColor] = useState('#1A1A1A')
  const [charSpacing, setCharSpacing] = useState(0)
  const [lineHeight, setLineHeight] = useState(1.2)
  const [fillColor, setFillColor] = useState('#E8E5E0')
  const [strokeColor, setStrokeColor] = useState('#1A1A1A')
  const [strokeWidth, setStrokeWidth] = useState(0.5)
  const [opacity, setOpacity] = useState(100)
  const [xMm, setXMm] = useState('0')
  const [yMm, setYMm] = useState('0')
  const [wMm, setWMm] = useState('0')
  const [hMm, setHMm] = useState('0')

  const isText = selectedObj instanceof Textbox
  const objType = selectedObj?.type ?? ''
  const isLine = objType === 'line'
  const isGroup = objType === 'group'
  const hasStroke = objType === 'rect' || isLine

  useEffect(() => {
    if (!selectedObj) return

    if (isText) {
      const t = selectedObj as Textbox
      setFontFamily(t.fontFamily ?? 'Arial')
      setFontSize(t.fontSize ?? 14)
      setBold(t.fontWeight === 'bold')
      setItalic(t.fontStyle === 'italic')
      setUnderline(t.underline ?? false)
      setTextAlign(t.textAlign ?? 'left')
      setTextColor(typeof t.fill === 'string' ? t.fill : '#1A1A1A')
      setCharSpacing((t.charSpacing ?? 0) / 100)
      setLineHeight(t.lineHeight ?? 1.2)
    }

    if (!isLine && !isGroup) {
      setFillColor(typeof selectedObj.fill === 'string' ? selectedObj.fill : '#E8E5E0')
    }

    if (hasStroke) {
      const s = selectedObj as FabricObject & { stroke?: string; strokeWidth?: number }
      setStrokeColor(typeof s.stroke === 'string' ? s.stroke : '#1A1A1A')
      setStrokeWidth(s.strokeWidth ?? 1)
    }

    setOpacity(Math.round((selectedObj.opacity ?? 1) * 100))

    const left = selectedObj.left ?? 0
    const top = selectedObj.top ?? 0
    const w = (selectedObj.width ?? 0) * (selectedObj.scaleX ?? 1)
    const h = (selectedObj.height ?? 0) * (selectedObj.scaleY ?? 1)
    setXMm((left * PX_TO_MM).toFixed(1))
    setYMm((top * PX_TO_MM).toFixed(1))
    setWMm((w * PX_TO_MM).toFixed(1))
    setHMm((h * PX_TO_MM).toFixed(1))
  }, [selectedObj, isText, isLine, isGroup, hasStroke])

  function update(props: Record<string, unknown>) {
    if (!selectedObj || !canvas) return
    selectedObj.set(props as Parameters<typeof selectedObj.set>[0])
    canvas.requestRenderAll()
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

  if (!selectedObj) {
    return (
      <aside className="w-56 bg-white border-l border-krb-rule flex flex-col items-center justify-center p-4 shrink-0">
        <div className="text-3xl mb-2 opacity-20">◻</div>
        <p className="text-xs text-krb-ink3 text-center leading-relaxed">Select an object to edit its properties</p>
      </aside>
    )
  }

  return (
    <aside className="w-56 bg-white border-l border-krb-rule flex flex-col p-3 shrink-0 overflow-y-auto">
      <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-3">Properties</div>

      {/* ── Text ── */}
      {isText && (
        <div className={sec}>
          <div>
            <label className={lbl}>Font family</label>
            <select
              value={fontFamily}
              onChange={(e) => { setFontFamily(e.target.value); update({ fontFamily: e.target.value }) }}
              className={inp}
            >
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className={lbl}>Size (pt)</label>
              <input
                type="number"
                value={fontSize}
                min={4}
                max={400}
                onChange={(e) => { const v = Number(e.target.value); setFontSize(v); update({ fontSize: v }) }}
                className={inp}
              />
            </div>
            <select
              value=""
              onChange={(e) => { const v = Number(e.target.value); setFontSize(v); update({ fontSize: v }) }}
              className="border border-krb-rule rounded px-1 py-1 text-xs focus:outline-none w-10"
              title="Quick sizes"
            >
              <option value="">▾</option>
              {FONT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex gap-1">
            <button type="button" title="Bold" onClick={() => { const v = !bold; setBold(v); update({ fontWeight: v ? 'bold' : 'normal' }) }} className={`${togBtn(bold)} font-bold`}>B</button>
            <button type="button" title="Italic" onClick={() => { const v = !italic; setItalic(v); update({ fontStyle: v ? 'italic' : 'normal' }) }} className={`${togBtn(italic)} italic`}>I</button>
            <button type="button" title="Underline" onClick={() => { const v = !underline; setUnderline(v); update({ underline: v }) }} className={`${togBtn(underline)} underline`}>U</button>
          </div>

          <div className="flex gap-1">
            {(['left', 'center', 'right', 'justify'] as const).map((a, i) => (
              <button
                key={a}
                type="button"
                title={`Align ${a}`}
                onClick={() => { setTextAlign(a); update({ textAlign: a }) }}
                className={`flex-1 h-8 rounded border text-xs transition-colors ${textAlign === a ? 'bg-krb-navy text-white border-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy'}`}
              >
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
        </div>
      )}

      {/* ── Stroke ── */}
      {hasStroke && (
        <div className={sec}>
          <ColourInput label="Stroke colour" value={strokeColor} onChange={(v) => { setStrokeColor(v); update({ stroke: v }) }} />
          <div>
            <label className={lbl}>Stroke width (pt)</label>
            <input type="number" step="0.5" min="0" value={strokeWidth}
              onChange={(e) => { const v = Number(e.target.value); setStrokeWidth(v); update({ strokeWidth: v }) }}
              className={inp} />
          </div>
        </div>
      )}

      {/* ── Opacity ── */}
      <div className={sec}>
        <label className={lbl}>Opacity: {opacity}%</label>
        <input type="range" min="0" max="100" value={opacity}
          onChange={(e) => { const v = Number(e.target.value); setOpacity(v); update({ opacity: v / 100 }) }}
          className="w-full accent-krb-navy" />
      </div>

      {/* ── Position & size ── */}
      <div className={sec}>
        <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Position (mm)</div>
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
      </div>

      {/* ── Actions ── */}
      <div className="space-y-2 pt-1">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={duplicateObj} className="border border-krb-rule rounded-lg py-1.5 text-xs hover:bg-krb-bg">Duplicate</button>
          <button type="button" onClick={deleteObj} className="border border-red-200 text-red-500 rounded-lg py-1.5 text-xs hover:bg-red-50">Delete</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { if (canvas && selectedObj) { canvas.bringObjectToFront(selectedObj); canvas.requestRenderAll() } }}
            className="border border-krb-rule rounded-lg py-1.5 text-xs hover:bg-krb-bg">To Front</button>
          <button type="button" onClick={() => { if (canvas && selectedObj) { canvas.sendObjectToBack(selectedObj); canvas.requestRenderAll() } }}
            className="border border-krb-rule rounded-lg py-1.5 text-xs hover:bg-krb-bg">To Back</button>
        </div>
      </div>
    </aside>
  )
}
