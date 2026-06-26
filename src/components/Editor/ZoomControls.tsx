interface Props {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
}

export default function ZoomControls({ zoom, onZoomIn, onZoomOut, onFit }: Props) {
  const pct = Math.round(zoom * 100)
  const btn = 'w-7 h-7 flex items-center justify-center rounded border border-krb-rule text-sm hover:bg-krb-bg transition-colors text-krb-ink3'

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white border border-krb-rule rounded-xl shadow-md px-3 py-1.5 select-none">
      <span className="text-xs font-mono text-krb-ink3 w-10 text-center">{pct}%</span>
      <button type="button" onClick={onZoomOut} className={btn} title="Zoom out (Ctrl−)">−</button>
      <button type="button" onClick={onZoomIn} className={btn} title="Zoom in (Ctrl+)">+</button>
      <button type="button" onClick={onFit} className={`${btn} px-2 text-xs`} title="Fit canvas (Ctrl+0)">Fit</button>
    </div>
  )
}
