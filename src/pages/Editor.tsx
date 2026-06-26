import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Canvas as FabricCanvas } from 'fabric'
import { Textbox, Rect, Line } from 'fabric'
import { initCanvas, serializeCanvas, loadCanvas, addNumberField } from '@/lib/canvas'
import { exportPDF } from '@/lib/pdf'
import { supabase } from '@/lib/supabase'
import { useDesignStore } from '@/store/designStore'
import { useNumberingStore } from '@/store/numberingStore'
import { useUserStore } from '@/store/userStore'
import { maxPagesForTier, canExportWithoutWatermark } from '@/lib/featureGate'
import AIGenerateDialog from '@/components/Editor/AIGenerateDialog'

export default function Editor() {
  const { designId } = useParams()
  const navigate = useNavigate()

  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null)
  const [showAIDialog, setShowAIDialog] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const designStore = useDesignStore()
  const numberingStore = useNumberingStore()
  const user = useUserStore((s) => s.user)
  const tier = useUserStore((s) => s.tier)

  const paperSize = designStore.paperSize
  const orientation = designStore.orientation
  const numbering = numberingStore

  // Detect mobile
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Init Fabric canvas
  useEffect(() => {
    const el = canvasElRef.current
    if (!el) return

    const canvas = initCanvas(el, paperSize, orientation)
    setFabricCanvas(canvas)

    canvas.on('object:modified', () => {
      const json = serializeCanvas(canvas)
      designStore.pushHistory(json)
    })

    return () => { canvas.dispose() }
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

  async function handleExport() {
    if (!fabricCanvas) return
    const maxPages = maxPagesForTier(tier)
    const total = Math.min(numbering.total, maxPages)
    const watermark = !canExportWithoutWatermark(tier)

    setExporting(true)
    try {
      const bytes = await exportPDF({
        paperSize,
        orientation,
        bleedEnabled: designStore.bleedEnabled,
        cropMarks: true,
        watermark,
        cmyk: false,
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
    } finally {
      setExporting(false)
    }
  }

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

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="bg-krb-orange text-white rounded-lg px-4 py-1.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — element tools */}
        <aside className="w-56 bg-white border-r border-krb-rule flex flex-col p-3 gap-1 shrink-0">
          <div className="text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Elements</div>

          <button type="button" onClick={() => fabricCanvas && addNumberField(fabricCanvas)}
            className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg border border-dashed border-blue-300 text-blue-700 font-medium">
            + Number Field
          </button>

          <button type="button" onClick={() => {
            if (!fabricCanvas) return
            const t = new Textbox('Text here', { left: 60, top: 60, fontSize: 14, fill: '#1A1A1A', width: 150 })
            fabricCanvas.add(t); fabricCanvas.setActiveObject(t); fabricCanvas.renderAll()
          }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">
            + Text
          </button>

          <button type="button" onClick={() => {
            if (!fabricCanvas) return
            const r = new Rect({ left: 60, top: 60, width: 150, height: 80, fill: '#E8E5E0', stroke: '#1A1A1A', strokeWidth: 0.5 })
            fabricCanvas.add(r); fabricCanvas.setActiveObject(r); fabricCanvas.renderAll()
          }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">
            + Rectangle
          </button>

          <button type="button" onClick={() => {
            if (!fabricCanvas) return
            const l = new Line([0, 0, 200, 0], { left: 60, top: 120, stroke: '#1A1A1A', strokeWidth: 1 })
            fabricCanvas.add(l); fabricCanvas.setActiveObject(l); fabricCanvas.renderAll()
          }} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-krb-bg">
            + Line
          </button>

          <div className="mt-4 text-xs font-semibold text-krb-ink3 uppercase tracking-wider mb-2">Numbering</div>

          <div className="space-y-2">
            {[
              { label: 'Prefix', key: 'prefix', type: 'text' as const },
              { label: 'Start', key: 'start', type: 'number' as const },
              { label: 'Digits', key: 'digits', type: 'number' as const },
              { label: 'Step', key: 'step', type: 'number' as const },
              { label: 'Suffix', key: 'suffix', type: 'text' as const },
              { label: 'Total pages', key: 'total', type: 'number' as const },
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
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={designStore.bleedEnabled}
                onChange={(e) => designStore.setBleedEnabled(e.target.checked)} className="rounded" />
              3mm bleed
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={designStore.showSafeZone}
                onChange={(e) => designStore.setShowSafeZone(e.target.checked)} className="rounded" />
              Show safe zone
            </label>
          </div>
        </aside>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-slate-200 flex items-start justify-center p-8">
          <div className="shadow-xl">
            <canvas ref={canvasElRef} />
          </div>
        </div>
      </div>

      {showAIDialog && (
        <AIGenerateDialog canvas={fabricCanvas} onClose={() => setShowAIDialog(false)} />
      )}
    </main>
  )
}
