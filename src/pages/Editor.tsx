import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Canvas as FabricCanvas, FabricObject } from 'fabric'
import { Textbox, Rect, Line, ActiveSelection } from 'fabric'
import {
  initCanvas, serializeCanvas, loadCanvas, addNumberField,
  attachZoomPan, applyZoom, fitToViewport,
  addCircle, addHighlight, addTable,
  addImagePlaceholder, addBlankField,
  centrePos,
} from '@/lib/canvas'
import { exportPDF } from '@/lib/pdf'
import { getPaperDimensions, getSlotDimensions } from '@/lib/paperSizes'
import { generateNumbers } from '@/lib/numbering'
import { supabase } from '@/lib/supabase'
import { useDesignStore } from '@/store/designStore'
import { useNumberingStore } from '@/store/numberingStore'
import { useUserStore } from '@/store/userStore'
import { maxPagesForTier, canExportWithoutWatermark } from '@/lib/featureGate'
import AIGenerateDialog from '@/components/Editor/AIGenerateDialog'
import PropertiesPanel from '@/components/Editor/PropertiesPanel'
import CanvasContextMenu from '@/components/Editor/CanvasContextMenu'
import PageSetupDialog, { type PageSetupSettings } from '@/components/Editor/PageSetupDialog'
import ZoomControls from '@/components/Editor/ZoomControls'
import LayersPanel from '@/components/Editor/LayersPanel'

export default function Editor() {
  const { designId } = useParams()
  const navigate = useNavigate()

  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<FabricCanvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null)
  const [selectedObj, setSelectedObj] = useState<FabricObject | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: FabricObject } | null>(null)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [zoom, setZoom] = useState(1.0)
  const [rightTab, setRightTab] = useState<'properties' | 'layers'>('properties')
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png'>('pdf')
  const [showTableConfig, setShowTableConfig] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const designStore = useDesignStore()
  const numberingStore = useNumberingStore()
  const user = useUserStore((s) => s.user)
  const tier = useUserStore((s) => s.tier)

  const paperSize = designStore.paperSize
  const orientation = designStore.orientation
  const receiptsPerPage = designStore.receiptsPerPage
  const numbering = numberingStore

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Init Fabric canvas
  useEffect(() => {
    const el = canvasElRef.current
    if (!el) return

    const canvas = initCanvas(el, paperSize, orientation, designStore.customSize, receiptsPerPage)
    fabricCanvasRef.current = canvas
    setFabricCanvas(canvas)

    const cleanupZoomPan = attachZoomPan(canvas)

    canvas.on('after:render', () => setZoom(canvas.getZoom()))

    canvas.on('object:modified', () => {
      const json = serializeCanvas(canvas)
      designStore.pushHistory(json)
    })

    canvas.on('selection:created', () => setSelectedObj(canvas.getActiveObject() ?? null))
    canvas.on('selection:updated', () => setSelectedObj(canvas.getActiveObject() ?? null))
    canvas.on('selection:cleared', () => setSelectedObj(null))

    canvas.on('mouse:down', (opt) => {
      if ((opt.e as MouseEvent).button === 2) {
        const target = opt.target
        if (target) {
          canvas.setActiveObject(target)
          canvas.requestRenderAll()
          setContextMenu({ x: (opt.e as MouseEvent).clientX, y: (opt.e as MouseEvent).clientY, target })
        }
      } else {
        setContextMenu(null)
      }
    })

    const wrapper = el.parentElement
    const preventCtx = (e: Event) => e.preventDefault()
    wrapper?.addEventListener('contextmenu', preventCtx)

    // Fit on first load
    requestAnimationFrame(() => {
      const cont = containerRef.current
      if (cont) fitToViewport(canvas, cont.offsetWidth, cont.offsetHeight)
    })

    return () => {
      wrapper?.removeEventListener('contextmenu', preventCtx)
      cleanupZoomPan()
      canvas.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load existing design
  useEffect(() => {
    if (!designId || !fabricCanvas || !user) return
    supabase
      .from('designs')
      .select('name, canvas_json, paper_size, numbering_config')
      .eq('id', designId)
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        designStore.setName(data['name'] as string)
        if (data['canvas_json']) {
          void loadCanvas(fabricCanvas, data['canvas_json'] as string)
        }
        if (data['numbering_config']) {
          numberingStore.setConfig(data['numbering_config'] as Parameters<typeof numberingStore.setConfig>[0])
        }
      })
  }, [designId, fabricCanvas, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const objs = canvas.getActiveObjects()
        objs.forEach((o) => canvas.remove(o))
        canvas.discardActiveObject()
        canvas.requestRenderAll()
        e.preventDefault()
        return
      }

      if (e.key === 'Escape') {
        canvas.discardActiveObject()
        canvas.requestRenderAll()
        setContextMenu(null)
        return
      }

      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        const obj = canvas.getActiveObject()
        if (obj) {
          void obj.clone().then((cloned: FabricObject) => {
            cloned.set({ left: (obj.left ?? 0) + 10, top: (obj.top ?? 0) + 10 })
            canvas.add(cloned)
            canvas.setActiveObject(cloned)
            canvas.requestRenderAll()
          })
        }
        return
      }

      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const json = useDesignStore.getState().undo()
        if (json) void loadCanvas(canvas, json)
        return
      }

      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault()
        const json = useDesignStore.getState().redo()
        if (json) void loadCanvas(canvas, json)
        return
      }

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault()
        const all = canvas.getObjects()
        if (all.length > 0) {
          const sel = new ActiveSelection(all, { canvas })
          canvas.setActiveObject(sel)
          canvas.requestRenderAll()
        }
        return
      }

      // Zoom shortcuts
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault()
        applyZoom(canvas, canvas.getZoom() * 1.2)
        return
      }
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault()
        applyZoom(canvas, canvas.getZoom() / 1.2)
        return
      }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        const cont = containerRef.current
        if (cont) fitToViewport(canvas, cont.offsetWidth, cont.offsetHeight)
        return
      }

      // Arrow nudge
      const obj = canvas.getActiveObject()
      if (obj) {
        const nudge = e.shiftKey ? 10 : 1
        if (e.key === 'ArrowLeft') { obj.set({ left: (obj.left ?? 0) - nudge }); canvas.requestRenderAll(); e.preventDefault() }
        if (e.key === 'ArrowRight') { obj.set({ left: (obj.left ?? 0) + nudge }); canvas.requestRenderAll(); e.preventDefault() }
        if (e.key === 'ArrowUp') { obj.set({ top: (obj.top ?? 0) - nudge }); canvas.requestRenderAll(); e.preventDefault() }
        if (e.key === 'ArrowDown') { obj.set({ top: (obj.top ?? 0) + nudge }); canvas.requestRenderAll(); e.preventDefault() }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const saveDesign = useCallback(async () => {
    if (!fabricCanvas || !user) return
    setSaving(true)
    const json = serializeCanvas(fabricCanvas)
    const payload = {
      user_id: user.id,
      name: designStore.name,
      canvas_json: json,
      paper_size: paperSize,
      numbering_config: {
        prefix: numbering.prefix,
        start: numbering.start,
        digits: numbering.digits,
        step: numbering.step,
        suffix: numbering.suffix,
        total: numbering.total,
      },
    }

    if (designId) {
      await supabase.from('designs').update(payload).eq('id', designId)
    } else {
      const { data } = await supabase.from('designs').insert(payload).select('id').single()
      if (data?.['id']) navigate(`/editor/${data['id'] as string}`, { replace: true })
    }

    setSaving(false)
    setSaveMsg('Saved')
    setTimeout(() => setSaveMsg(''), 2000)
  }, [fabricCanvas, user, designId, designStore.name, paperSize, numbering, navigate])

  async function handleExportPDF() {
    if (!fabricCanvas) return
    const maxPages = maxPagesForTier(tier)
    const total = Math.min(numbering.total, maxPages)
    const watermark = !canExportWithoutWatermark(tier)

    const bytes = await exportPDF({
      paperSize,
      orientation,
      bleedEnabled: designStore.bleedEnabled,
      cropMarks: true,
      watermark,
      cmyk: false,
      receiptsPerPage,
      numberingEnabled: numberingStore.numberingEnabled,
      numbering: { ...numberingStore, total },
      canvasObjects: fabricCanvas.getObjects().map((obj) => {
        const o = obj as unknown as Record<string, unknown>
        return {
          type: String(o['type'] ?? 'rect'),
          left: Number(obj.left ?? 0),
          top: Number(obj.top ?? 0),
          width: Number(obj.width ?? 0),
          height: Number(obj.height ?? 0),
          scaleX: Number(obj.scaleX ?? 1),
          scaleY: Number(obj.scaleY ?? 1),
          text: o['text'] as string | undefined,
          fontSize: o['fontSize'] as number | undefined,
          fill: o['fill'] as string | undefined,
          data: o['data'] as { type?: string } | undefined,
        }
      }),
    })

    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${designStore.name.replace(/\s+/g, '-')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExportPNG() {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 300 / 96 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${designStore.name.replace(/\s+/g, '-')}.png`
    a.click()
  }

  async function handleExport() {
    setExporting(true)
    try {
      if (exportFormat === 'png') await handleExportPNG()
      else await handleExportPDF()
    } finally {
      setExporting(false)
    }
  }

  function handlePageSetupConfirm(settings: PageSetupSettings) {
    const store = useDesignStore.getState()
    store.setPaperSize(settings.paperSize)
    store.setOrientation(settings.orientation)
    store.setCustomSize(settings.customSize)
    store.setBleedEnabled(settings.bleedEnabled)
    store.setShowSafeZone(settings.showSafeZone)
    store.setBindingType(settings.bindingType)
    store.setReceiptsPerPage(settings.receiptsPerPage)
    setShowSetupDialog(false)

    const canvas = fabricCanvasRef.current
    if (canvas) {
      const dims = settings.receiptsPerPage > 1
        ? getSlotDimensions(settings.paperSize, settings.orientation, settings.receiptsPerPage, settings.customSize)
        : getPaperDimensions(settings.paperSize, settings.orientation, settings.customSize ?? undefined)
      canvas.setDimensions({ width: dims.widthPx96, height: dims.heightPx96 })
      canvas.requestRenderAll()
      const cont = containerRef.current
      if (cont) fitToViewport(canvas, cont.offsetWidth, cont.offsetHeight)
    }
  }

  // Add element helpers
  function addText() {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const t = new Textbox('Text here', { fontSize: 14, fill: '#1A1A1A', width: 150, ...centrePos(canvas, 150, 30) })
    canvas.add(t); canvas.setActiveObject(t); canvas.requestRenderAll()
  }

  function addRect() {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const r = new Rect({ width: 150, height: 80, fill: '#E8E5E0', stroke: '#1A1A1A', strokeWidth: 0.5, ...centrePos(canvas, 150, 80) })
    canvas.add(r); canvas.setActiveObject(r); canvas.requestRenderAll()
  }

  function addLine() {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    const pos = centrePos(canvas, 200, 0)
    const l = new Line([0, 0, 200, 0], { left: pos.left, top: pos.top, stroke: '#1A1A1A', strokeWidth: 1 })
    canvas.add(l); canvas.setActiveObject(l); canvas.requestRenderAll()
  }

  const dims = receiptsPerPage > 1
    ? getSlotDimensions(paperSize, orientation, receiptsPerPage, designStore.customSize)
    : getPaperDimensions(paperSize, orientation, designStore.customSize)

  const pdfPages = Math.ceil(numbering.total / receiptsPerPage)

  // Numbering preview
  const numberingPreview = generateNumbers({ ...numberingStore, total: 3 }).join(', ')

  if (isMobile) {
    return (
      <main className="min-h-screen bg-krb-bg flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-4xl mb-4">🖥️</div>
          <h2 className="text-xl font-bold text-krb-navy mb-2">Desktop only</h2>
          <p className="text-krb-ink3 text-sm">The receipt editor works best on a desktop or laptop. Open it on a larger screen to start designing.</p>
          <button type="button" onClick={() => navigate('/dashboard')} className="mt-6 text-sm text-krb-navy hover:underline">← Back to dashboard</button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-krb-bg flex flex-col">
      {/* Toolbar */}
      <header className="bg-white border-b border-krb-rule px-4 py-2 flex items-center gap-3">
        <button type="button" onClick={() => navigate('/dashboard')} className="text-krb-ink3 hover:text-krb-ink text-sm">← Dashboard</button>
        <div className="w-px h-5 bg-krb-rule" />

        <input
          type="text"
          title="Design name"
          aria-label="Design name"
          value={designStore.name}
          onChange={(e) => designStore.setName(e.target.value)}
          className="text-sm font-semibold text-krb-navy bg-transparent border-b border-transparent hover:border-krb-rule focus:border-krb-navy focus:outline-none px-1 py-0.5 w-48"
        />

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => setShowSetupDialog(true)}
          className="border border-krb-rule rounded-lg px-3 py-1.5 text-sm hover:bg-krb-bg flex items-center gap-1"
          title="Page setup"
        >
          ⚙ Page
        </button>

        <button
          type="button"
          onClick={() => setShowAIDialog(true)}
          className="border border-krb-rule rounded-lg px-3 py-1.5 text-sm hover:bg-krb-bg flex items-center gap-1.5"
        >
          ✨ AI Generate
        </button>

        <button
          type="button"
          onClick={saveDesign}
          disabled={saving}
          className="border border-krb-rule rounded-lg px-3 py-1.5 text-sm hover:bg-krb-bg disabled:opacity-50"
        >
          {saving ? 'Saving…' : saveMsg || 'Save'}
        </button>

        <div className="flex items-center gap-1">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'png')}
            title="Export format"
            className="border border-krb-rule rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-krb-navy"
          >
            <option value="pdf">PDF</option>
            <option value="png">PNG</option>
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="bg-krb-orange text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : `Export ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 bg-white border-r border-krb-rule flex flex-col p-3 shrink-0 overflow-y-auto">

          {/* Elements */}
          <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Elements</div>

          <button type="button" onClick={() => fabricCanvasRef.current && addNumberField(fabricCanvasRef.current)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg border border-dashed border-blue-300 text-blue-700 font-medium mb-1">
            + Number Field
          </button>
          <button type="button" onClick={addText} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Text</button>
          <button type="button" onClick={addRect} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Rectangle</button>
          <button type="button" onClick={() => fabricCanvasRef.current && addCircle(fabricCanvasRef.current)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Circle</button>
          <button type="button" onClick={addLine} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Line</button>
          <button type="button" onClick={() => fabricCanvasRef.current && addHighlight(fabricCanvasRef.current)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Highlight</button>
          <button type="button" onClick={() => fabricCanvasRef.current && addImagePlaceholder(fabricCanvasRef.current)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Image placeholder</button>
          <button type="button" onClick={() => fabricCanvasRef.current && addBlankField(fabricCanvasRef.current)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Blank field</button>

          {/* Table button + inline config */}
          <div className="relative mb-1">
            <button type="button" onClick={() => setShowTableConfig((v) => !v)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">+ Table</button>
            {showTableConfig && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-krb-rule rounded-xl shadow-xl p-3 z-50 w-44">
                <div className="text-xs font-semibold text-krb-ink3 mb-2">Table size</div>
                <div className="flex gap-2 mb-2">
                  <div className="flex-1">
                    <label className="text-xs text-krb-ink3 block mb-0.5">Rows</label>
                    <input type="number" min={1} max={20} value={tableRows}
                      onChange={(e) => setTableRows(Number(e.target.value))}
                      title="Table rows"
                      className="w-full border border-krb-rule rounded px-2 py-1 text-sm focus:outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-krb-ink3 block mb-0.5">Cols</label>
                    <input type="number" min={1} max={20} value={tableCols}
                      onChange={(e) => setTableCols(Number(e.target.value))}
                      title="Table columns"
                      className="w-full border border-krb-rule rounded px-2 py-1 text-sm focus:outline-none" />
                  </div>
                </div>
                <button type="button"
                  onClick={() => {
                    if (fabricCanvasRef.current) addTable(fabricCanvasRef.current, tableRows, tableCols)
                    setShowTableConfig(false)
                  }}
                  className="w-full bg-krb-orange text-white rounded-lg py-1.5 text-xs font-semibold">
                  Insert Table
                </button>
              </div>
            )}
          </div>

          <div className="text-xs text-krb-ink3 mt-1 mb-3 px-1 leading-relaxed">
            Del — delete · Ctrl+D — dup · Ctrl+scroll — zoom · Space+drag — pan
          </div>

          {/* Page */}
          <div className="border-t border-krb-rule pt-3 mt-1">
            <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Page</div>
            <div className="text-xs text-krb-ink3 mb-1 leading-relaxed">
              {paperSize} · {dims.widthMm.toFixed(0)} × {dims.heightMm.toFixed(0)} mm
            </div>
            {receiptsPerPage > 1 && (
              <div className="text-xs text-krb-ink3 mb-1">
                {receiptsPerPage}-up layout
              </div>
            )}
            <div className="text-xs text-krb-ink3 mb-2">
              {numbering.total} receipts ÷ {receiptsPerPage}/page = <strong className="text-krb-ink">{pdfPages} PDF pages</strong>
            </div>
            <button type="button" onClick={() => setShowSetupDialog(true)}
              className="w-full border border-krb-rule rounded-lg px-3 py-1.5 text-xs hover:bg-krb-bg mb-3">
              ⚙ Change page setup
            </button>

            <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
              <input type="checkbox" checked={designStore.bleedEnabled}
                onChange={(e) => designStore.setBleedEnabled(e.target.checked)} className="rounded" />
              3 mm bleed
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={designStore.showSafeZone}
                onChange={(e) => designStore.setShowSafeZone(e.target.checked)} className="rounded" />
              Show safe zone
            </label>

            {designStore.bindingType === 'wire-o' && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                Wire-O: keep content 8 mm from left edge.
              </div>
            )}
            {designStore.bindingType === 'saddle' && numbering.total % 4 !== 0 && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5">
                Saddle stitch needs pages in multiples of 4. Currently: {numbering.total}.
              </div>
            )}
          </div>

          {/* Numbering */}
          <div className="border-t border-krb-rule pt-3 mt-3">
            <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Numbering</div>

            <label className="flex items-center gap-2 text-sm cursor-pointer mb-3">
              <input type="checkbox" checked={numberingStore.numberingEnabled}
                onChange={(e) => numberingStore.setNumberingEnabled(e.target.checked)} className="rounded" />
              Enable numbering
            </label>

            <div className="space-y-2">
              {[
                { label: 'Prefix', key: 'prefix', type: 'text' as const },
                { label: 'Start', key: 'start', type: 'number' as const },
                { label: 'Step', key: 'step', type: 'number' as const },
                { label: 'Suffix', key: 'suffix', type: 'text' as const },
                { label: 'Total receipts', key: 'total', type: 'number' as const },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label htmlFor={`num-${key}`} className="text-xs text-krb-ink3 block mb-0.5">{label}</label>
                  <input
                    id={`num-${key}`}
                    type={type}
                    value={String(numberingStore[key as keyof typeof numberingStore])}
                    onChange={(e) => numberingStore.setConfig({ [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                    className="w-full border border-krb-rule rounded px-2 py-1 text-sm focus:outline-none focus:border-krb-navy"
                    min={type === 'number' ? (key === 'step' ? 1 : 0) : undefined}
                  />
                </div>
              ))}

              {/* Format dropdown */}
              <div>
                <label htmlFor="num-format" className="text-xs text-krb-ink3 block mb-0.5">Format</label>
                <select
                  id="num-format"
                  value={numberingStore.digits}
                  onChange={(e) => numberingStore.setConfig({ digits: Number(e.target.value) })}
                  className="w-full border border-krb-rule rounded px-2 py-1 text-sm focus:outline-none focus:border-krb-navy"
                >
                  <option value={1}>1, 2, 3 …</option>
                  <option value={2}>01, 02, 03 …</option>
                  <option value={3}>001, 002, 003 …</option>
                  <option value={4}>0001, 0002 … (default)</option>
                  <option value={5}>00001, 00002 …</option>
                </select>
              </div>

              {/* Live preview */}
              <div className="text-xs font-mono bg-krb-bg rounded px-2 py-1.5 text-krb-ink3 break-all">
                {numberingPreview}
              </div>
            </div>
          </div>
        </aside>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 overflow-auto bg-slate-200 flex items-start justify-center p-8 relative">
          <div className="shadow-xl">
            <canvas ref={canvasElRef} />
          </div>
          <ZoomControls
            zoom={zoom}
            onZoomIn={() => fabricCanvasRef.current && applyZoom(fabricCanvasRef.current, fabricCanvasRef.current.getZoom() * 1.2)}
            onZoomOut={() => fabricCanvasRef.current && applyZoom(fabricCanvasRef.current, fabricCanvasRef.current.getZoom() / 1.2)}
            onFit={() => {
              const canvas = fabricCanvasRef.current
              const cont = containerRef.current
              if (canvas && cont) fitToViewport(canvas, cont.offsetWidth, cont.offsetHeight)
            }}
          />
        </div>

        {/* Right panel: Properties | Layers tabs */}
        <aside className="w-56 bg-white border-l border-krb-rule flex flex-col shrink-0">
          <div className="flex border-b border-krb-rule">
            <button
              type="button"
              onClick={() => setRightTab('properties')}
              className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${rightTab === 'properties' ? 'text-krb-navy border-krb-navy' : 'text-krb-ink3 border-transparent hover:text-krb-ink'}`}
            >Properties</button>
            <button
              type="button"
              onClick={() => setRightTab('layers')}
              className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-colors ${rightTab === 'layers' ? 'text-krb-navy border-krb-navy' : 'text-krb-ink3 border-transparent hover:text-krb-ink'}`}
            >Layers</button>
          </div>
          {rightTab === 'properties' ? (
            <PropertiesPanel
              canvas={fabricCanvas}
              selectedObj={selectedObj}
              onChanged={() => {
                const canvas = fabricCanvasRef.current
                if (canvas) designStore.pushHistory(serializeCanvas(canvas))
              }}
            />
          ) : (
            <LayersPanel
              canvas={fabricCanvas}
              selectedObj={selectedObj}
              onSelectionChange={setSelectedObj}
            />
          )}
        </aside>
      </div>

      {/* Dialogs */}
      {showAIDialog && (
        <AIGenerateDialog canvas={fabricCanvas} onClose={() => setShowAIDialog(false)} />
      )}
      {showSetupDialog && (
        <PageSetupDialog
          title="Page Setup"
          initialSettings={{
            paperSize,
            orientation,
            customSize: designStore.customSize,
            bleedEnabled: designStore.bleedEnabled,
            showSafeZone: designStore.showSafeZone,
            bindingType: designStore.bindingType,
            receiptsPerPage,
          }}
          onConfirm={handlePageSetupConfirm}
          onClose={() => setShowSetupDialog(false)}
        />
      )}
      {contextMenu && fabricCanvas && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          canvas={fabricCanvas}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onChanged={() => {
            if (fabricCanvas) designStore.pushHistory(serializeCanvas(fabricCanvas))
          }}
        />
      )}
    </main>
  )
}
