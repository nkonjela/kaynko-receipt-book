import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/store/userStore'
import { useDesignStore } from '@/store/designStore'
import { useNumberingStore } from '@/store/numberingStore'
import { TEMPLATES, type Template } from '@/templates'

type Category = 'all' | 'receipt' | 'invoice' | 'slip'

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'receipt', label: 'Receipt' },
  { key: 'invoice', label: 'Invoice' },
  { key: 'slip', label: 'Slip / Delivery' },
]

export default function Templates() {
  const tier = useUserStore((s) => s.tier)
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const designStore = useDesignStore()
  const numberingStore = useNumberingStore()

  const filtered = activeCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.category === activeCategory)

  function useTemplate(template: Template) {
    const isLocked = template.tier === 'starter' && tier === 'free'
    if (isLocked) {
      navigate('/pricing')
      return
    }

    designStore.setPaperSize(template.paperSize)
    designStore.setOrientation(template.orientation)
    numberingStore.setConfig({
      ...template.defaultNumbering,
      total: 50,
    })

    navigate('/editor')
  }

  return (
    <main className="min-h-screen bg-krb-bg">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-krb-navy">Templates</h1>
            <p className="text-krb-ink3 text-sm mt-1">Start with a professionally designed template.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="text-sm text-krb-navy hover:underline"
          >
            ← My designs
          </button>
        </div>

        <div className="flex gap-2 mb-8">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activeCategory === cat.key
                  ? 'bg-krb-navy text-white border-krb-navy'
                  : 'border-krb-rule text-krb-ink hover:border-krb-navy'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
          {filtered.map((template) => {
            const isLocked = template.tier === 'starter' && tier === 'free'

            return (
              <div key={template.id} className="bg-white border border-krb-rule rounded-xl overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative">
                  <div className="w-20 h-28 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center">
                    <span className="text-2xl">📄</span>
                  </div>
                  {isLocked && (
                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                      <span className="text-xs font-bold text-krb-orange bg-white border border-krb-orange rounded-full px-3 py-1">
                        Starter+
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="font-semibold text-krb-navy text-sm">{template.name}</div>
                  <div className="text-xs text-krb-ink3 mt-0.5 capitalize">{template.category} · {template.paperSize}</div>
                  <button
                    type="button"
                    onClick={() => useTemplate(template)}
                    className={`mt-3 w-full rounded-lg py-1.5 text-sm font-semibold transition-colors ${
                      isLocked
                        ? 'border border-krb-orange text-krb-orange hover:bg-krb-orange hover:text-white'
                        : 'bg-krb-navy text-white hover:opacity-90'
                    }`}
                  >
                    {isLocked ? 'Upgrade to use' : 'Use this template'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
