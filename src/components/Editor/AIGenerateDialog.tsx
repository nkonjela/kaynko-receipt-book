import { useState, useRef, type ChangeEvent } from 'react'
import type { Canvas } from 'fabric'
import { generateFromImage, applyAILayoutToCanvas, type AIReceiptAnalysis } from '@/lib/aiToCanvas'

interface Props {
  canvas: Canvas | null
  onClose: () => void
}

type Step = 'upload' | 'analysing' | 'done' | 'error'

export default function AIGenerateDialog({ canvas, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [preview, setPreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string>('image/jpeg')
  const [errorMsg, setErrorMsg] = useState('')
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      // result is "data:image/png;base64,<data>"
      const base64 = result.split(',')[1] ?? ''
      setImageBase64(base64)
      setMimeType(file.type || 'image/jpeg')
      setPreview(result)
    }
    reader.readAsDataURL(file)
  }

  async function handleGenerate() {
    if (!imageBase64 || !canvas) return
    setStep('analysing')
    setErrorMsg('')

    try {
      const analysis: AIReceiptAnalysis = await generateFromImage(imageBase64, mimeType)
      await applyAILayoutToCanvas(canvas, analysis)
      setStep('done')
    } catch (err) {
      const isUpgrade = (err as Error & { upgradeRequired?: boolean }).upgradeRequired === true
      setUpgradeRequired(isUpgrade)
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }

  function handleDone() {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-krb-rule">
          <h2 className="font-bold text-krb-navy">Generate from sample document</h2>
          <button type="button" onClick={onClose} className="text-krb-ink3 hover:text-krb-ink text-xl leading-none">&times;</button>
        </div>

        <div className="p-5">
          {step === 'upload' && (
            <>
              <p className="text-sm text-krb-ink3 mb-4">
                Upload a sample document image. Claude AI will analyse the layout and recreate it on the canvas.
              </p>

              <div
                className="border-2 border-dashed border-krb-rule rounded-lg p-8 text-center cursor-pointer hover:border-krb-orange transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                {preview ? (
                  <img src={preview} alt="Receipt preview" className="max-h-48 mx-auto object-contain rounded" />
                ) : (
                  <>
                    <div className="text-3xl mb-2">📷</div>
                    <p className="text-sm font-medium text-krb-navy">Click to upload image</p>
                    <p className="text-xs text-krb-ink3 mt-1">JPEG, PNG, WebP · max 10MB</p>
                  </>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex gap-3 mt-5">
                <button type="button" onClick={onClose} className="flex-1 border border-krb-rule rounded-lg py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!imageBase64}
                  onClick={handleGenerate}
                  className="flex-1 bg-krb-navy text-white rounded-lg py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                >
                  Analyse document
                </button>
              </div>
            </>
          )}

          {step === 'analysing' && (
            <div className="py-10 text-center">
              <div className="w-10 h-10 border-4 border-krb-navy border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-medium text-krb-navy">Analysing your document…</p>
              <p className="text-sm text-krb-ink3 mt-1">This usually takes 5–10 seconds.</p>
            </div>
          )}

          {step === 'done' && (
            <div className="py-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-krb-navy mb-2">Template generated!</p>
              <p className="text-sm text-krb-ink3 mb-6">
                Review the layout on the canvas and adjust as needed. The number field is already placed.
              </p>
              <button
                type="button"
                onClick={handleDone}
                className="bg-krb-orange text-white rounded-lg px-6 py-2 text-sm font-semibold hover:opacity-90"
              >
                Start editing
              </button>
            </div>
          )}

          {step === 'error' && (
            <div className="py-6">
              {upgradeRequired ? (
                <>
                  <div className="text-center mb-4">
                    <div className="text-3xl mb-2">⚡</div>
                    <p className="font-bold text-krb-navy">AI generation limit reached</p>
                    <p className="text-sm text-krb-ink3 mt-1">Free accounts get 3 AI generations/month.</p>
                  </div>
                  <a
                    href="/pricing"
                    className="block w-full bg-krb-orange text-white rounded-lg py-2 text-sm font-semibold text-center hover:opacity-90"
                  >
                    Upgrade to Starter — $3/mo
                  </a>
                  <button type="button" onClick={onClose} className="block w-full mt-3 text-sm text-krb-ink3 hover:underline">
                    Maybe later
                  </button>
                </>
              ) : (
                <>
                  <p className="text-red-600 text-sm mb-4 text-center">{errorMsg}</p>
                  <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 border border-krb-rule rounded-lg py-2 text-sm">Cancel</button>
                    <button type="button" onClick={() => setStep('upload')} className="flex-1 bg-krb-navy text-white rounded-lg py-2 text-sm font-semibold">Try again</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
