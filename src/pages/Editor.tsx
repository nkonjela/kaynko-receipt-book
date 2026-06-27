import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Canvas as FabricCanvas, FabricObject } from 'fabric'
import { Textbox, Rect, Line, ActiveSelection } from 'fabric'
import {
  initCanvas, serializeCanvas, loadCanvas, addNumberField,
  attachZoomPan, applyZoom, fitToViewport, updateCanvasData,
  addCircle, addHighlight, addTable, addRoundedRect, addArrow,
  addImagePlaceholder, addBlankField,
  centrePos,
} from '@/lib/canvas'
import type { InitCanvasOptions, DimensionInfo } from '@/lib/canvas'
import { exportPDF } from '@/lib/pdf'
import { getPaperDimensions, getSlotDimensions } from '@/lib/paperSizes'
import { generateNumbers } from '@/lib/numbering'
import { supabase } from '@/lib/supabase'
import { useDesignStore } from '@/store/designStore'
import type { PerforationLine } from '@/store/designStore'
import { useNumberingStore } from '@/store/numberingStore'
import { useUserStore } from '@/store/userStore'
import { maxPagesForTier, canExportWithoutWatermark } from '@/lib/featureGate'
import AIGenerateDialog from '@/components/Editor/AIGenerateDialog'
import PropertiesPanel from '@/components/Editor/PropertiesPanel'
import CanvasContextMenu from '@/components/Editor/CanvasContextMenu'
import PageSetupDialog, { type PageSetupSettings } from '@/components/Editor/PageSetupDialog'
import ZoomControls from '@/components/Editor/ZoomControls'
import LayersPanel from '@/components/Editor/LayersPanel'
import { RulerH, RulerV } from '@/components/Editor/Ruler'
import PreviewModal from '@/components/Editor/PreviewModal'

function SidebarSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="border-t border-krb-rule group">
      <summary className="py-2 px-1 text-xs font-semibold text-krb-ink3 uppercase tracking-wider cursor-pointer select-none list-none flex items-center justify-between hover:text-krb-ink transition-colors">
        {title}
        <span className="text-[9px] transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="pb-3">{children}</div>
    </details>
  )
}

export default function Editor() {
  const { designId } = useParams()
  const navigate = useNavigate()

  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<FabricCanvas | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasAreaRef = useRef<HTMLDivElement>(null)

  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null)
  const [selectedObj, setSelectedObj] = useState<FabricObject | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: FabricObject } | null>(null)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [showSetupDialog, setShowSetupDialog] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [zoom, setZoom] = useState(1.0)
  const [viewportTransform, setViewportTransform] = useState<number[]>([1, 0, 0, 1, 0, 0])
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [rightTab, setRightTab] = useState<'properties' | 'layers'>('properties')
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png'>('pdf')
  const [showTableConfig, setShowTableConfig] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const [tableCellWMm, setTableCellWMm] = useState(30)
  const [tableCellHMm, setTableCellHMm] = useState(10)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [draggingGuide, setDraggingGuide] = useState<{ axis: 'h' | 'v'; screenPos: number } | null>(null)
  const [userGuides, setUserGuides] = useState<{ axis: 'h' | 'v'; positionMm: number }[]>([])
  const [dimTooltip, setDimTooltip] = useState<DimensionInfo | null>(null)

  const designStore = useDesignStore()
  const numberingStore = useNumberingStore()
  const user = useUserStore((s) => s.user)
  const tier = useUserStore((s) => s.tier)

  const paperSize = designStore.paperSize
  const orientation = designStore.orientation
  const receiptsPerPage = designStore.receiptsPerPage
  const twoUpOrientation = designStore.twoUpOrientation

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    updateCanvasData(canvas, {
      perforationLines: designStore.perforationLines,
      bindingSide: designStore.bindingSide,
      bindingType: designStore.bindingType,
    })
  }, [designStore.perforationLines, designStore.bindingSide, designStore.bindingType])

  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    updateCanvasData(canvas, { showGrid: designStore.showGrid, gridSizeMm: designStore.gridSizeMm })
  }, [designStore.showGrid, designStore.gridSizeMm])

  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    updateCanvasData(canvas, { showSafeZone: designStore.showSafeZone })
  }, [designStore.showSafeZone])

  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    updateCanvasData(canvas, { bleedEnabled: designStore.bleedEnabled })
  }, [designStore.bleedEnabled])

  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    updateCanvasData(canvas, { userGuides })
  }, [userGuides])

  useEffect(() => {
    const el = canvasElRef.current
    const area = canvasAreaRef.current
    if (!el || !area) return

    const opts: InitCanvasOptions = {
      bindingSide: designStore.bindingSide,
      bindingType: designStore.bindingType,
      perforationLines: designStore.perforationLines,
      showGrid: designStore.showGrid,
      gridSizeMm: designStore.gridSizeMm,
      userGuides,
      showSafeZone: designStore.showSafeZone,
      bleedEnabled: designStore.bleedEnabled,
      onDimensions: (info) => setDimTooltip(info),
    }

    const canvas = initCanvas(el, paperSize, orientation, designStore.customSize, receiptsPerPage, opts)
    fabricCanvasRef.current = canvas
    setFabricCanvas(canvas)

    const canvasContainer = el.parentElement
    if (canvasContainer) {
      Object.assign(canvasContainer.style, { position: 'absolute', top: '0', left: '0', zIndex: '1' })
    }

    const cleanupZoomPan = attachZoomPan(canvas, area)

    canvas.on('after:render', () => {
      setZoom(canvas.getZoom())
      setViewportTransform([...(canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0])])
    })

    canvas.on('object:modified', () => { designStore.pushHistory(serializeCanvas(canvas)) })
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

    const preventCtx = (e: Event) => e.preventDefault()
    canvasContainer?.addEventListener('contextmenu', preventCtx)

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setContainerSize({ w: width, h: height })
          fitToViewport(canvas, width, height)
        }
      }
    })
    ro.observe(area)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const { offsetWidth: w, offsetHeight: h } = area
        if (w > 0 && h > 0) fitToViewport(canvas, w, h)
      })
    })

    return () => {
      canvasContainer?.removeEventListener('contextmenu', preventCtx)
      ro.disconnect()
      cleanupZoomPan()
      canvas.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
        if (data['canvas_json']) void loadCanvas(fabricCanvas, data['canvas_json'] as string)
        if (data['numbering_config']) numberingStore.setConfig(data['numbering_config'] as Parameters<typeof numberingStore.setConfig>[0])
      })
  }, [designId, fabricCanvas, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return
      const canvas = fabricCanvasRef.current
      if (!canvas) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        canvas.getActiveObjects().forEach((o) => canvas.remove(o))
        canvas.discardActiveObject(); canvas.requestRenderAll(); e.preventDefault(); return
      }
      if (e.key === 'Escape') { canvas.discardActiveObject(); canvas.requestRenderAll(); setContextMenu(null); return }
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        const obj = canvas.getActiveObject()
        if (obj) void obj.clone().then((cloned: FabricObject) => {
          cloned.set({ left: (obj.left ?? 0) + 10, top: (obj.top ?? 0) + 10 })
          canvas.add(cloned); canvas.setActiveObject(cloned); canvas.requestRenderAll()
        })
        return
      }
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); const json = useDesignStore.getState().undo(); if (json) void loadCanvas(canvas, json); return
      }
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault(); const json = useDesignStore.getState().redo(); if (json) void loadCanvas(canvas, json); return
      }
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault()
        const all = canvas.getObjects()
        if (all.length > 0) { const sel = new ActiveSelection(all, { canvas }); canvas.setActiveObject(sel); canvas.requestRenderAll() }
        return
      }
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); applyZoom(canvas, canvas.getZoom() * 1.2); return }
      if (e.ctrlKey && e.key === '-') { e.preventDefault(); applyZoom(canvas, canvas.getZoom() / 1.2); return }
      if (e.ctrlKey && e.key === '0') {
        e.preventDefault()
        const area = canvasAreaRef.current
        if (area) fitToViewport(canvas, area.offsetWidth, area.offsetHeight)
        return
      }
      const obj = canvas.getActiveObject()
      if (obj) {
        const n = e.shiftKey ? 10 : 1
        if (e.key === 'ArrowLeft') { obj.set({ left: (obj.left ?? 0) - n }); canvas.requestRenderAll(); e.preventDefault() }
        if (e.key === 'ArrowRight') { obj.set({ left: (obj.left ?? 0) + n }); canvas.requestRenderAll(); e.preventDefault() }
        if (e.key === 'ArrowUp') { obj.set({ top: (obj.top ?? 0) - n }); canvas.requestRenderAll(); e.preventDefault() }
        if (e.key === 'ArrowDown') { obj.set({ top: (obj.top ?? 0) + n }); canvas.requestRenderAll(); e.preventDefault() }
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
      user_id: user.id, name: designStore.name, canvas_json: json, paper_size: paperSize,
      numbering_config: { prefix: numberingStore.prefix, start: numberingStore.start, digits: numberingStore.digits, step: numberingStore.step, suffix: numberingStore.suffix, total: numberingStore.total },
    }
    if (designId) {
      await supabase.from('designs').update(payload).eq('id', designId)
    } else {
      const { data } = await supabase.from('designs').insert(payload).select('id').single()
      if (data?.['id']) navigate(`/editor/${data['id'] as string}`, { replace: true })
    }
    setSaving(false); setSaveMsg('Saved'); setTimeout(() => setSaveMsg(''), 2000)
  }, [fabricCanvas, user, designId, designStore.name, paperSize, numberingStore, navigate])

  async function handleExport() {
    setExporting(true)
    try {
      if (exportFormat === 'png') {
        const canvas = fabricCanvasRef.current; if (!canvas) return
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 300 / 96 })
        const a = document.createElement('a'); a.href = dataUrl; a.download = `${designStore.name.replace(/\s+/g, '-')}.png`; a.click()
      } else {
        if (!fabricCanvas) return
        const total = Math.min(numberingStore.total, maxPagesForTier(tier))
        const bytes = await exportPDF({
          paperSize, orientation, bleedEnabled: designStore.bleedEnabled, cropMarks: true,
          watermark: !canExportWithoutWatermark(tier), cmyk: false, receiptsPerPage,
          numberingEnabled: numberingStore.numberingEnabled, twoUpOrientation,
          perforationLines: designStore.perforationLines, numbering: { ...numberingStore, total },
          canvasObjects: fabricCanvas.getObjects().map((obj) => {
            const o = obj as unknown as Record<string, unknown>
            // For groups, extract children in group-local coords so PDF renderer can flatten them.
            const children = obj.type === 'group'
              ? ((o['_objects'] ?? o['objects']) as unknown[] | undefined ?? []).map((c) => {
                  const ch = c as Record<string, unknown>
                  return { type: String(ch['type'] ?? 'rect'), left: Number(ch['left'] ?? 0), top: Number(ch['top'] ?? 0), width: Number(ch['width'] ?? 0), height: Number(ch['height'] ?? 0), scaleX: Number(ch['scaleX'] ?? 1), scaleY: Number(ch['scaleY'] ?? 1), text: ch['text'] as string | undefined, fontSize: ch['fontSize'] as number | undefined, fill: ch['fill'] as string | undefined, stroke: ch['stroke'] as string | undefined, strokeWidth: ch['strokeWidth'] as number | undefined, data: ch['data'] as { type?: string } | undefined }
                })
              : undefined
            return { type: String(o['type'] ?? 'rect'), left: Number(obj.left ?? 0), top: Number(obj.top ?? 0), width: Number(obj.width ?? 0), height: Number(obj.height ?? 0), scaleX: Number(obj.scaleX ?? 1), scaleY: Number(obj.scaleY ?? 1), text: o['text'] as string | undefined, fontSize: o['fontSize'] as number | undefined, fill: o['fill'] as string | undefined, stroke: o['stroke'] as string | undefined, strokeWidth: o['strokeWidth'] as number | undefined, data: o['data'] as { type?: string } | undefined, objects: children }
          }),
        })
        const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${designStore.name.replace(/\s+/g, '-')}.pdf`; a.click()
        URL.revokeObjectURL(url)
      }
    } finally { setExporting(false) }
  }

  function handlePageSetupConfirm(settings: PageSetupSettings) {
    const store = useDesignStore.getState()
    store.setPaperSize(settings.paperSize); store.setOrientation(settings.orientation)
    store.setCustomSize(settings.customSize); store.setBleedEnabled(settings.bleedEnabled)
    store.setShowSafeZone(settings.showSafeZone); store.setBindingType(settings.bindingType)
    store.setBindingSide(settings.bindingSide); store.setTwoUpOrientation(settings.twoUpOrientation)
    store.setReceiptsPerPage(settings.receiptsPerPage); setShowSetupDialog(false)

    const canvas = fabricCanvasRef.current
    if (canvas) {
      const dims = settings.receiptsPerPage > 1
        ? getSlotDimensions(settings.paperSize, settings.orientation, settings.receiptsPerPage, settings.customSize, settings.twoUpOrientation)
        : getPaperDimensions(settings.paperSize, settings.orientation, settings.customSize ?? undefined)
      updateCanvasData(canvas, { paperWidthPx: dims.widthPx96, paperHeightPx: dims.heightPx96, bindingSide: settings.bindingSide, bindingType: settings.bindingType })
      const area = canvasAreaRef.current
      if (area) fitToViewport(canvas, area.offsetWidth, area.offsetHeight)
    }
  }

  // Guide drag
  function handleGuideStart(axis: 'h' | 'v', e: React.MouseEvent) {
    e.preventDefault()
    const area = canvasAreaRef.current; if (!area) return
    const rect = area.getBoundingClientRect()
    const screenPos = axis === 'h' ? e.clientY - rect.top : e.clientX - rect.left
    setDraggingGuide({ axis, screenPos })
  }

  function handleGuideMouseMove(e: React.MouseEvent) {
    if (!draggingGuide) return
    const area = canvasAreaRef.current; if (!area) return
    const rect = area.getBoundingClientRect()
    const screenPos = draggingGuide.axis === 'h' ? e.clientY - rect.top : e.clientX - rect.left
    setDraggingGuide((g) => g ? { ...g, screenPos } : null)
  }

  function handleGuideMouseUp() {
    if (!draggingGuide) return
    const canvas = fabricCanvasRef.current
    if (!canvas) { setDraggingGuide(null); return }
    const vt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    const MM_TO_PX = 96 / 25.4
    let positionMm: number
    if (draggingGuide.axis === 'h') {
      positionMm = (draggingGuide.screenPos - vt[5]) / (vt[3] || 1) / MM_TO_PX
    } else {
      positionMm = (draggingGuide.screenPos - vt[4]) / (vt[0] || 1) / MM_TO_PX
    }
    if (positionMm > 0) setUserGuides((prev) => [...prev, { axis: draggingGuide.axis, positionMm }])
    setDraggingGuide(null)
  }

  function handleCanvasAreaDblClick(e: React.MouseEvent) {
    const canvas = fabricCanvasRef.current; if (!canvas) return
    const area = canvasAreaRef.current; if (!area) return
    const rect = area.getBoundingClientRect()
    const vt = canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0]
    const MM_TO_PX = 96 / 25.4
    const mx = ((e.clientX - rect.left) - vt[4]) / (vt[0] || 1) / MM_TO_PX
    const my = ((e.clientY - rect.top) - vt[5]) / (vt[3] || 1) / MM_TO_PX
    const T = 3
    const remaining = userGuides.filter((g) => g.axis === 'h' ? Math.abs(g.positionMm - my) > T : Math.abs(g.positionMm - mx) > T)
    if (remaining.length !== userGuides.length) setUserGuides(remaining)
  }

  function addText() {
    const canvas = fabricCanvasRef.current; if (!canvas) return
    const t = new Textbox('Text here', { fontSize: 14, fill: '#1A1A1A', width: 150, ...centrePos(canvas, 150, 30) })
    canvas.add(t); canvas.setActiveObject(t); canvas.requestRenderAll()
  }

  function addRect() {
    const canvas = fabricCanvasRef.current; if (!canvas) return
    const r = new Rect({ width: 150, height: 80, fill: '#E8E5E0', stroke: '#1A1A1A', strokeWidth: 0.5, ...centrePos(canvas, 150, 80) })
    canvas.add(r); canvas.setActiveObject(r); canvas.requestRenderAll()
  }

  function addLine() {
    const canvas = fabricCanvasRef.current; if (!canvas) return
    const pos = centrePos(canvas, 200, 0)
    const l = new Line([0, 0, 200, 0], { left: pos.left, top: pos.top, stroke: '#1A1A1A', strokeWidth: 1 })
    canvas.add(l); canvas.setActiveObject(l); canvas.requestRenderAll()
  }

  const dims = receiptsPerPage > 1
    ? getSlotDimensions(paperSize, orientation, receiptsPerPage, designStore.customSize, twoUpOrientation)
    : getPaperDimensions(paperSize, orientation, designStore.customSize)

  const pdfPages = Math.ceil(numberingStore.total / receiptsPerPage)
  const numberingPreview = generateNumbers({ ...numberingStore, total: 3 }).join(', ')

  const vt = viewportTransform
  const z = vt[0] || 1
  const paperDisplayW = dims.widthPx96 * z
  const paperDisplayH = dims.heightPx96 * (vt[3] || 1)
  const paperLeft = vt[4]
  const paperTop = vt[5]
  // Bleed (3mm) and safe zone (5mm) display sizes in screen pixels
  const BLEED_DISPLAY = 3 * (96 / 25.4) * z
  const SAFE_DISPLAY = 5 * (96 / 25.4) * z

  const rulerW = Math.max(0, containerSize.w - 20)
  const rulerH = Math.max(0, containerSize.h - 20)

  const guidePreviewStyle: React.CSSProperties | null = draggingGuide
    ? draggingGuide.axis === 'h'
      ? { position: 'absolute', left: 0, right: 0, top: draggingGuide.screenPos, height: 1, background: 'rgba(0,110,200,0.7)', pointerEvents: 'none', zIndex: 10 }
      : { position: 'absolute', top: 0, bottom: 0, left: draggingGuide.screenPos, width: 1, background: 'rgba(0,110,200,0.7)', pointerEvents: 'none', zIndex: 10 }
    : null

  if (isMobile) {
    return (
      <main className="min-h-screen bg-krb-bg flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-bold text-krb-navy mb-2">Desktop only</h2>
          <p className="text-krb-ink3 text-sm">Open the editor on a desktop or laptop.</p>
          <button type="button" onClick={() => navigate('/dashboard')} className="mt-6 text-sm text-krb-navy hover:underline">← Back</button>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-hidden bg-krb-bg flex flex-col">
      {/* Toolbar */}
      <header className="bg-white border-b border-krb-rule px-4 py-2 flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => navigate('/dashboard')} className="text-krb-ink3 hover:text-krb-ink text-sm">← Dashboard</button>
        <div className="w-px h-5 bg-krb-rule" />
        <input type="text" title="Design name" aria-label="Design name" value={designStore.name}
          onChange={(e) => designStore.setName(e.target.value)}
          className="text-sm font-semibold text-krb-navy bg-transparent border-b border-transparent hover:border-krb-rule focus:border-krb-navy focus:outline-none px-1 py-0.5 w-48" />
        <div className="flex-1" />
        <button type="button" onClick={() => setShowSetupDialog(true)} className="border border-krb-rule rounded-lg px-3 py-1.5 text-sm hover:bg-krb-bg">⚙ Page</button>
        <button type="button" onClick={() => setShowPreview(true)} disabled={!fabricCanvas} className="border border-krb-rule rounded-lg px-3 py-1.5 text-sm hover:bg-krb-bg disabled:opacity-40">▣ Preview</button>
        <button type="button" onClick={() => setShowAIDialog(true)} className="border border-krb-rule rounded-lg px-3 py-1.5 text-sm hover:bg-krb-bg">✨ AI</button>
        <button type="button" onClick={saveDesign} disabled={saving} className="border border-krb-rule rounded-lg px-3 py-1.5 text-sm hover:bg-krb-bg disabled:opacity-50">
          {saving ? 'Saving…' : saveMsg || 'Save'}
        </button>
        <div className="flex items-center gap-1">
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'png')} title="Export format"
            className="border border-krb-rule rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-krb-navy">
            <option value="pdf">PDF</option>
            <option value="png">PNG</option>
          </select>
          <button type="button" onClick={handleExport} disabled={exporting}
            className="bg-krb-orange text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {exporting ? 'Exporting…' : `Export ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 bg-white border-r border-krb-rule flex flex-col shrink-0 overflow-y-auto text-sm">

          <SidebarSection title="Draw Tools" defaultOpen>
            <button type="button" onClick={() => fabricCanvasRef.current && addNumberField(fabricCanvasRef.current)}
              className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-krb-bg border border-dashed border-blue-300 text-blue-700 font-medium mb-1 text-xs">
              # Number Field
            </button>
            <button type="button" onClick={addText} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-krb-bg text-xs">T  Text</button>
            <button type="button" onClick={() => fabricCanvasRef.current && addImagePlaceholder(fabricCanvasRef.current)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-krb-bg text-xs">⬜  Image</button>
            <button type="button" onClick={() => fabricCanvasRef.current && addBlankField(fabricCanvasRef.current)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-krb-bg text-xs">_  Blank field</button>
          </SidebarSection>

          <SidebarSection title="Shapes" defaultOpen>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: '▭ Rect', fn: addRect },
                { label: '▢ Rounded', fn: () => fabricCanvasRef.current && addRoundedRect(fabricCanvasRef.current) },
                { label: '○ Circle', fn: () => fabricCanvasRef.current && addCircle(fabricCanvasRef.current) },
                { label: '— Line', fn: addLine },
                { label: '→ Arrow', fn: () => fabricCanvasRef.current && addArrow(fabricCanvasRef.current) },
                { label: '▬ Highlight', fn: () => fabricCanvasRef.current && addHighlight(fabricCanvasRef.current) },
              ].map(({ label, fn }) => (
                <button key={label} type="button" onClick={fn} className="px-2 py-1.5 rounded-lg hover:bg-krb-bg text-left text-xs">{label}</button>
              ))}
            </div>
            {/* Table */}
            <div className="relative mt-1">
              <button type="button" onClick={() => setShowTableConfig((v) => !v)} className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-krb-bg text-xs">⊞  Table</button>
              {showTableConfig && (
                <div className="absolute left-0 top-full mt-1 bg-white border border-krb-rule rounded-xl shadow-xl p-3 z-50 w-48">
                  <p className="text-xs font-semibold text-krb-ink3 mb-2">Table</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div><label className="text-xs text-krb-ink3 block mb-0.5">Rows</label>
                      <input type="number" min={1} max={20} value={tableRows} title="Rows" onChange={(e) => setTableRows(Number(e.target.value))} className="w-full border border-krb-rule rounded px-2 py-1 text-xs focus:outline-none" /></div>
                    <div><label className="text-xs text-krb-ink3 block mb-0.5">Cols</label>
                      <input type="number" min={1} max={20} value={tableCols} title="Cols" onChange={(e) => setTableCols(Number(e.target.value))} className="w-full border border-krb-rule rounded px-2 py-1 text-xs focus:outline-none" /></div>
                    <div><label className="text-xs text-krb-ink3 block mb-0.5">Cell W (mm)</label>
                      <input type="number" min={10} max={120} value={tableCellWMm} title="Cell width mm" onChange={(e) => setTableCellWMm(Number(e.target.value))} className="w-full border border-krb-rule rounded px-2 py-1 text-xs focus:outline-none" /></div>
                    <div><label className="text-xs text-krb-ink3 block mb-0.5">Cell H (mm)</label>
                      <input type="number" min={5} max={60} value={tableCellHMm} title="Cell height mm" onChange={(e) => setTableCellHMm(Number(e.target.value))} className="w-full border border-krb-rule rounded px-2 py-1 text-xs focus:outline-none" /></div>
                  </div>
                  <p className="text-xs text-krb-ink3 mb-2">Row 1 = header. Double-click a cell to type.</p>
                  <button type="button"
                    onClick={() => { if (fabricCanvasRef.current) addTable(fabricCanvasRef.current, tableRows, tableCols, tableCellWMm, tableCellHMm); setShowTableConfig(false) }}
                    className="w-full bg-krb-orange text-white rounded-lg py-1.5 text-xs font-semibold">Insert Table</button>
                </div>
              )}
            </div>
            <p className="text-xs text-krb-ink3 mt-2 leading-relaxed px-1">Del · Ctrl+D · scroll=zoom · Space+drag=pan</p>
          </SidebarSection>

          <SidebarSection title="Page">
            <div className="px-1 space-y-1 text-xs text-krb-ink3 mb-2">
              <div>{paperSize} · {dims.widthMm.toFixed(0)} × {dims.heightMm.toFixed(0)} mm{receiptsPerPage > 1 ? ` · ${receiptsPerPage}-up` : ''}</div>
              <div>{numberingStore.total} receipts = <strong className="text-krb-ink">{pdfPages} PDF pages</strong></div>
            </div>
            <button type="button" onClick={() => setShowSetupDialog(true)} className="w-full border border-krb-rule rounded-lg px-2 py-1.5 text-xs hover:bg-krb-bg mb-3">⚙ Change page setup</button>
            <div className="flex items-center gap-2 mb-2 px-1">
              <label htmlFor="bg-color" className="text-xs text-krb-ink3 flex-1">Background</label>
              <input id="bg-color" type="color" value={designStore.pageBackgroundColor}
                onChange={(e) => designStore.setPageBackgroundColor(e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border border-krb-rule" title="Page background colour" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mb-1 px-1 text-xs">
              <input type="checkbox" checked={designStore.bleedEnabled} onChange={(e) => designStore.setBleedEnabled(e.target.checked)} className="rounded" />3 mm bleed
            </label>
            <label className="flex items-center gap-2 cursor-pointer px-1 text-xs">
              <input type="checkbox" checked={designStore.showSafeZone} onChange={(e) => designStore.setShowSafeZone(e.target.checked)} className="rounded" />Safe zone
            </label>
          </SidebarSection>

          <SidebarSection title="Grid & Guides">
            <label className="flex items-center gap-2 cursor-pointer mb-2 px-1 text-xs">
              <input type="checkbox" checked={designStore.showGrid} onChange={(e) => designStore.setShowGrid(e.target.checked)} className="rounded" />Show grid
            </label>
            {designStore.showGrid && (
              <>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <label htmlFor="grid-size" className="text-xs text-krb-ink3 flex-1">Grid size</label>
                  <input id="grid-size" type="number" min={1} max={50} value={designStore.gridSizeMm}
                    onChange={(e) => designStore.setGridSizeMm(Number(e.target.value))}
                    className="w-14 border border-krb-rule rounded px-2 py-0.5 text-xs focus:outline-none focus:border-krb-navy" />
                  <span className="text-xs text-krb-ink3">mm</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer mb-2 px-1 text-xs">
                  <input type="checkbox" checked={designStore.snapToGrid} onChange={(e) => designStore.setSnapToGrid(e.target.checked)} className="rounded" />Snap to grid
                </label>
              </>
            )}
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs text-krb-ink3">Guides ({userGuides.length})</span>
              {userGuides.length > 0 && (
                <button type="button" onClick={() => setUserGuides([])} className="text-xs text-red-400 hover:text-red-600">Clear all</button>
              )}
            </div>
            <p className="text-xs text-krb-ink3 leading-relaxed px-1">Drag from ruler to add. Dbl-click near guide to delete.</p>
          </SidebarSection>

          <SidebarSection title="Binding & Perforation">
            {designStore.bindingType === 'none'
              ? <p className="text-xs text-krb-ink3 px-1 mb-2">Set binding type in Page Setup to enable binding options.</p>
              : (
                <div className="px-1 mb-3">
                  <p className="text-xs text-krb-ink3 mb-2">Tap which edge gets stapled or glued:</p>
                  {/* Book SVG grid — each shows a receipt book from above with spine on the correct edge */}
                  <div className="grid grid-cols-2 gap-1.5 select-none">
                    {(['left', 'top', 'right', 'bottom'] as const).map((side) => {
                      const sel = designStore.bindingSide === side
                      const sp = sel ? '#1A3A5C' : '#94A3B8'
                      const ln = '#E8E5E0'
                      const labels: Record<string, [string, string]> = {
                        left:   ['LEFT',   'opens right →'],
                        top:    ['TOP',    'flips upward ↑'],
                        right:  ['RIGHT',  '← opens left'],
                        bottom: ['BOTTOM', 'tears off ↓'],
                      }
                      const [title, desc] = labels[side]
                      return (
                        <button key={side} type="button"
                          onClick={() => designStore.setBindingSide(side)}
                          title={`${title} — ${desc}`}
                          className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border transition-all ${sel ? 'border-krb-navy bg-krb-navy/5 shadow-sm' : 'border-krb-rule hover:border-krb-navy/50'}`}>
                          <svg width="38" height="46" viewBox="0 0 38 46" fill="none">
                            {/* Book body */}
                            <rect x="1" y="1" width="36" height="44" rx="2" fill="white" stroke={sp} strokeWidth={sel ? 1.5 : 0.75}/>
                            {/* Spine strip */}
                            {side === 'left'   && <rect x="1"  y="1"  width="6"  height="44" rx="1.5" fill={sp}/>}
                            {side === 'right'  && <rect x="31" y="1"  width="6"  height="44" rx="1.5" fill={sp}/>}
                            {side === 'top'    && <rect x="1"  y="1"  width="36" height="7"  rx="1.5" fill={sp}/>}
                            {side === 'bottom' && <rect x="1"  y="38" width="36" height="7"  rx="1.5" fill={sp}/>}
                            {/* Receipt lines */}
                            {(side === 'left' || side === 'right') && [16, 22, 28, 34].map((y) => (
                              <line key={y} x1={side === 'left' ? 10 : 4} y1={y} x2={side === 'left' ? 34 : 28} y2={y} stroke={ln} strokeWidth="2"/>
                            ))}
                            {(side === 'top' || side === 'bottom') && [16, 22, 28].map((y) => (
                              <line key={y} x1="5" y1={y} x2="33" y2={y} stroke={ln} strokeWidth="2"/>
                            ))}
                          </svg>
                          <span className={`text-[9px] font-bold ${sel ? 'text-krb-navy' : 'text-krb-ink3'}`}>{title}</span>
                          <span className={`text-[8px] leading-tight text-center ${sel ? 'text-krb-navy/70' : 'text-krb-ink3/60'}`}>{desc}</span>
                        </button>
                      )
                    })}
                  </div>
                  {designStore.bindingType === 'wire-o' && <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">Keep content 8 mm from the spine edge.</p>}
                  {designStore.bindingType === 'saddle' && numberingStore.total % 4 !== 0 && <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">Saddle stitch works best with multiples of 4 pages.</p>}
                </div>
              )
            }
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-medium text-krb-ink3">Perforation</span>
              <button type="button" onClick={() => designStore.setPerforationLines([...designStore.perforationLines, { axis: 'h', positionMm: 50, style: 'dashes' }])} className="text-xs text-krb-navy hover:underline">+ Add</button>
            </div>
            {designStore.perforationLines.length === 0 && <p className="text-xs text-krb-ink3 px-1 leading-relaxed">Add cut guides for hand perforators.</p>}
            {designStore.perforationLines.map((line, idx) => (
              <div key={idx} className="mb-2 mx-1 p-2 border border-krb-rule rounded-lg space-y-1">
                <div className="flex gap-1">
                  {(['h', 'v'] as const).map((axis) => (
                    <button key={axis} type="button"
                      onClick={() => { const u = [...designStore.perforationLines]; u[idx] = { ...u[idx], axis }; designStore.setPerforationLines(u) }}
                      className={`flex-1 py-0.5 rounded text-xs border ${line.axis === axis ? 'bg-krb-navy text-white border-krb-navy' : 'border-krb-rule text-krb-ink3 hover:border-krb-navy'}`}>
                      {axis === 'h' ? '─ H' : '│ V'}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 items-center">
                  <input type="number" title="mm" value={line.positionMm} min={0} step={1}
                    onChange={(e) => { const u = [...designStore.perforationLines]; u[idx] = { ...u[idx], positionMm: Number(e.target.value) }; designStore.setPerforationLines(u) }}
                    className="flex-1 border border-krb-rule rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-krb-navy" />
                  <span className="text-xs text-krb-ink3">mm</span>
                </div>
                <div className="flex gap-1">
                  <select title="Style" value={line.style}
                    onChange={(e) => { const u = [...designStore.perforationLines]; u[idx] = { ...u[idx], style: e.target.value as PerforationLine['style'] }; designStore.setPerforationLines(u) }}
                    className="flex-1 border border-krb-rule rounded px-1 py-0.5 text-xs focus:outline-none">
                    <option value="dashes">Dashes</option>
                    <option value="corner-marks">Corner marks</option>
                  </select>
                  <button type="button" onClick={() => designStore.setPerforationLines(designStore.perforationLines.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 text-xs px-1.5">✕</button>
                </div>
              </div>
            ))}
          </SidebarSection>

          <SidebarSection title="Numbering" defaultOpen>
            <label className="flex items-center gap-2 cursor-pointer mb-2 px-1 text-xs">
              <input type="checkbox" checked={numberingStore.numberingEnabled} onChange={(e) => numberingStore.setNumberingEnabled(e.target.checked)} className="rounded" />Enable numbering
            </label>
            {numberingStore.numberingEnabled && (
              <div className="space-y-2 px-1">
                {([['Prefix', 'prefix', 'text'], ['Suffix', 'suffix', 'text'], ['Start', 'start', 'number'], ['Step', 'step', 'number'], ['Total receipts', 'total', 'number']] as [string, string, 'text' | 'number'][]).map(([label, key, type]) => (
                  <div key={key}>
                    <label htmlFor={`num-${key}`} className="text-xs text-krb-ink3 block mb-0.5">{label}</label>
                    <input id={`num-${key}`} type={type} value={String(numberingStore[key as keyof typeof numberingStore])}
                      onChange={(e) => numberingStore.setConfig({ [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
                      className="w-full border border-krb-rule rounded px-2 py-1 text-xs focus:outline-none focus:border-krb-navy"
                      min={type === 'number' ? (key === 'step' ? 1 : 0) : undefined} />
                  </div>
                ))}
                <div>
                  <label htmlFor="num-format" className="text-xs text-krb-ink3 block mb-0.5">Format</label>
                  <select id="num-format" value={numberingStore.digits} onChange={(e) => numberingStore.setConfig({ digits: Number(e.target.value) })}
                    className="w-full border border-krb-rule rounded px-2 py-1 text-xs focus:outline-none focus:border-krb-navy">
                    <option value={1}>1, 2, 3 …</option>
                    <option value={2}>01, 02, 03 …</option>
                    <option value={3}>001, 002, 003 …</option>
                    <option value={4}>0001, 0002 … (default)</option>
                    <option value={5}>00001, 00002 …</option>
                  </select>
                </div>
                <div className="text-xs font-mono bg-krb-bg rounded px-2 py-1.5 text-krb-ink3 break-all">{numberingPreview}</div>
              </div>
            )}
          </SidebarSection>
        </aside>

        {/* Canvas area with rulers */}
        <div ref={containerRef} className="flex-1 overflow-hidden"
          style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gridTemplateRows: '20px 1fr' }}>
          <div className="bg-slate-300 z-10" style={{ borderRight: '1px solid #aaa', borderBottom: '1px solid #aaa' }} />
          <div className="bg-slate-300 z-10 overflow-hidden" style={{ borderBottom: '1px solid #aaa' }}>
            {rulerW > 0 && <RulerH lengthPx={rulerW} viewportTransform={viewportTransform} paperSizeMm={dims.widthMm} onGuideStart={handleGuideStart} />}
          </div>
          <div className="bg-slate-300 z-10 overflow-hidden" style={{ borderRight: '1px solid #aaa' }}>
            {rulerH > 0 && <RulerV lengthPx={rulerH} viewportTransform={viewportTransform} paperSizeMm={dims.heightMm} onGuideStart={handleGuideStart} />}
          </div>
          <div ref={canvasAreaRef} className="relative overflow-hidden bg-slate-200"
            onMouseMove={handleGuideMouseMove}
            onMouseUp={handleGuideMouseUp}
            onMouseLeave={handleGuideMouseUp}
            onDoubleClick={handleCanvasAreaDblClick}>
            {/* Bleed boundary — 3 mm OUTSIDE the trim edge (behind the paper) */}
            {designStore.bleedEnabled && (
              <div style={{ position: 'absolute', left: paperLeft - BLEED_DISPLAY, top: paperTop - BLEED_DISPLAY, width: paperDisplayW + BLEED_DISPLAY * 2, height: paperDisplayH + BLEED_DISPLAY * 2, border: '1px dashed rgba(200,30,30,0.6)', zIndex: 0, pointerEvents: 'none', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, color: 'rgba(200,30,30,0.75)', fontFamily: 'Arial,sans-serif', fontWeight: 'bold', lineHeight: 1, whiteSpace: 'nowrap', userSelect: 'none' }}>BLEED 3mm</span>
              </div>
            )}
            {/* Paper background */}
            <div style={{ position: 'absolute', left: paperLeft, top: paperTop, width: paperDisplayW, height: paperDisplayH, background: designStore.pageBackgroundColor, boxShadow: '0 4px 20px rgba(0,0,0,0.18),0 1px 4px rgba(0,0,0,0.12)', zIndex: 1, pointerEvents: 'none' }} />
            <canvas ref={canvasElRef} />
            {/* Safe zone — 5 mm INSIDE the trim edge (above the canvas) */}
            {designStore.showSafeZone && (
              <div style={{ position: 'absolute', left: paperLeft + SAFE_DISPLAY, top: paperTop + SAFE_DISPLAY, width: paperDisplayW - SAFE_DISPLAY * 2, height: paperDisplayH - SAFE_DISPLAY * 2, border: '1px dashed rgba(0,140,200,0.6)', zIndex: 3, pointerEvents: 'none', boxSizing: 'border-box' }}>
                <span style={{ position: 'absolute', top: 2, left: 3, fontSize: 9, color: 'rgba(0,140,200,0.75)', fontFamily: 'Arial,sans-serif', fontWeight: 'bold', lineHeight: 1, whiteSpace: 'nowrap', userSelect: 'none' }}>SAFE ZONE</span>
              </div>
            )}
            {guidePreviewStyle && <div style={guidePreviewStyle} />}
            {dimTooltip && (
              <div style={{ position: 'absolute', left: dimTooltip.x, top: dimTooltip.y, zIndex: 30, background: 'rgba(30,30,30,0.85)', color: '#fff', fontSize: 11, fontFamily: 'monospace', padding: '2px 8px', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
                {dimTooltip.label}
              </div>
            )}
            <ZoomControls
              zoom={zoom}
              onZoomIn={() => fabricCanvasRef.current && applyZoom(fabricCanvasRef.current, fabricCanvasRef.current.getZoom() * 1.2)}
              onZoomOut={() => fabricCanvasRef.current && applyZoom(fabricCanvasRef.current, fabricCanvasRef.current.getZoom() / 1.2)}
              onFit={() => { const c = fabricCanvasRef.current; const a = canvasAreaRef.current; if (c && a) fitToViewport(c, a.offsetWidth, a.offsetHeight) }}
            />
          </div>
        </div>

        {/* Right panel */}
        <aside className="w-56 bg-white border-l border-krb-rule flex flex-col shrink-0">
          <div className="flex border-b border-krb-rule">
            {(['properties', 'layers'] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setRightTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 capitalize transition-colors ${rightTab === tab ? 'text-krb-navy border-krb-navy' : 'text-krb-ink3 border-transparent hover:text-krb-ink'}`}>
                {tab}
              </button>
            ))}
          </div>
          {rightTab === 'properties'
            ? <PropertiesPanel canvas={fabricCanvas} selectedObj={selectedObj} onChanged={() => { const c = fabricCanvasRef.current; if (c) designStore.pushHistory(serializeCanvas(c)) }} />
            : <LayersPanel canvas={fabricCanvas} selectedObj={selectedObj} onSelectionChange={setSelectedObj} />
          }
        </aside>
      </div>

      {showAIDialog && <AIGenerateDialog canvas={fabricCanvas} onClose={() => setShowAIDialog(false)} />}
      {showSetupDialog && (
        <PageSetupDialog title="Page Setup"
          initialSettings={{ paperSize, orientation, customSize: designStore.customSize, bleedEnabled: designStore.bleedEnabled, showSafeZone: designStore.showSafeZone, bindingType: designStore.bindingType, bindingSide: designStore.bindingSide, twoUpOrientation, receiptsPerPage }}
          onConfirm={handlePageSetupConfirm} onClose={() => setShowSetupDialog(false)} />
      )}
      {showPreview && fabricCanvas && (
        <PreviewModal canvas={fabricCanvas} receiptsPerPage={receiptsPerPage} twoUpOrientation={twoUpOrientation} orientation={orientation} onClose={() => setShowPreview(false)} />
      )}
      {contextMenu && fabricCanvas && (
        <CanvasContextMenu x={contextMenu.x} y={contextMenu.y} canvas={fabricCanvas} target={contextMenu.target}
          onClose={() => setContextMenu(null)} onChanged={() => { if (fabricCanvas) designStore.pushHistory(serializeCanvas(fabricCanvas)) }} />
      )}
    </main>
  )
}
