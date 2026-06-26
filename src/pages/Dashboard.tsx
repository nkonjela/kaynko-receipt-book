import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useUserStore } from '@/store/userStore'
import { useDesignStore } from '@/store/designStore'

interface Design {
  id: string
  name: string
  paper_size: string
  updated_at: string
}

export default function Dashboard() {
  const user = useUserStore((s) => s.user)
  const tier = useUserStore((s) => s.tier)
  const reset = useDesignStore((s) => s.reset)
  const navigate = useNavigate()

  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('designs')
      .select('id, name, paper_size, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setDesigns((data as Design[] | null) ?? [])
        setLoading(false)
      })
  }, [user])

  async function deleteDesign(id: string) {
    setDeleting(id)
    await supabase.from('designs').delete().eq('id', id)
    setDesigns((prev) => prev.filter((d) => d.id !== id))
    setDeleting(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/auth/login')
  }

  function newDesign() {
    reset()
    navigate('/editor')
  }

  const tierBadgeColor = tier === 'pro' ? 'bg-purple-100 text-purple-700' : tier === 'starter' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'

  return (
    <main className="min-h-screen bg-krb-bg">
      {/* Top nav */}
      <header className="bg-white border-b border-krb-rule px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-krb-orange rounded-lg flex items-center justify-center text-white font-black text-xs">KRB</div>
          <span className="font-bold text-krb-navy">Kaynko Receipt Book</span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${tierBadgeColor}`}>{tier}</span>
          <span className="text-sm text-krb-ink3">{user?.email}</span>
          <button type="button" onClick={signOut} className="text-sm text-krb-ink3 hover:text-krb-ink">Sign out</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-krb-navy">My Designs</h1>
          <div className="flex gap-3">
            <button type="button" onClick={() => navigate('/templates')} className="border border-krb-rule rounded-lg px-4 py-2 text-sm hover:bg-white">
              Browse templates
            </button>
            <button type="button" onClick={newDesign} className="bg-krb-orange text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90">
              + New design
            </button>
          </div>
        </div>

        {tier === 'free' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-8 flex items-center justify-between">
            <p className="text-sm text-amber-800">
              Free plan: 3 designs/month, 10 pages max, watermark on export.
            </p>
            <a href="/pricing" className="text-sm font-semibold text-krb-orange hover:underline ml-4 shrink-0">Upgrade →</a>
          </div>
        )}

        {loading ? (
          <div className="text-krb-ink3 text-sm">Loading your designs…</div>
        ) : designs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📒</div>
            <h2 className="text-lg font-bold text-krb-navy mb-2">No designs yet</h2>
            <p className="text-krb-ink3 text-sm mb-6">Create your first receipt book or pick a template to get started.</p>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={() => navigate('/templates')} className="border border-krb-rule rounded-lg px-4 py-2 text-sm">Browse templates</button>
              <button type="button" onClick={newDesign} className="bg-krb-orange text-white rounded-lg px-4 py-2 text-sm font-semibold">Create blank</button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5">
            {designs.map((design) => (
              <div key={design.id} className="bg-white border border-krb-rule rounded-xl overflow-hidden">
                <div
                  className="h-32 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center cursor-pointer hover:opacity-90"
                  onClick={() => navigate(`/editor/${design.id}`)}
                >
                  <div className="w-16 h-20 bg-white border border-slate-200 rounded shadow-sm flex items-center justify-center">
                    <span className="text-xl">📄</span>
                  </div>
                </div>
                <div className="p-4">
                  <div
                    className="font-semibold text-krb-navy text-sm cursor-pointer hover:underline"
                    onClick={() => navigate(`/editor/${design.id}`)}
                  >
                    {design.name}
                  </div>
                  <div className="text-xs text-krb-ink3 mt-0.5">
                    {design.paper_size} · {new Date(design.updated_at).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/editor/${design.id}`)}
                      className="flex-1 bg-krb-navy text-white rounded-lg py-1.5 text-xs font-semibold hover:opacity-90"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDesign(design.id)}
                      disabled={deleting === design.id}
                      className="border border-red-200 text-red-500 rounded-lg px-3 py-1.5 text-xs hover:bg-red-50 disabled:opacity-50"
                    >
                      {deleting === design.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
