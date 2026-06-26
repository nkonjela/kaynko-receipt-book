const RULER_BG = '#EDECEA'
const TICK_COLOR = '#999'
const LABEL_COLOR = '#777'
const THICKNESS = 20

interface RulerProps {
  lengthPx: number
  viewportTransform: number[]
  paperSizeMm: number
}

function getTickInterval(pxPerMm: number): { minor: number; major: number; label: number } {
  if (pxPerMm >= 8) return { minor: 1, major: 5, label: 10 }
  if (pxPerMm >= 3) return { minor: 2, major: 10, label: 20 }
  if (pxPerMm >= 1.5) return { minor: 5, major: 10, label: 20 }
  return { minor: 10, major: 20, label: 50 }
}

export function RulerH({ lengthPx, viewportTransform: vt, paperSizeMm }: RulerProps) {
  const scale = vt[0] || 1
  const offsetPx = vt[4]
  const pxPerMm = scale * (96 / 25.4)
  const { minor, major, label } = getTickInterval(pxPerMm)

  // Build ticks in mm space
  const startMm = Math.floor(-offsetPx / pxPerMm / minor) * minor - minor
  const endMm = startMm + (lengthPx / pxPerMm) + minor * 2

  const ticks: { mm: number; x: number; h: number; showLabel: boolean }[] = []
  for (let mm = startMm; mm <= endMm; mm += minor) {
    if (mm < 0 || mm > paperSizeMm + minor) continue
    const x = offsetPx + mm * pxPerMm
    if (x < -4 || x > lengthPx + 4) continue
    const isMajor = mm % major === 0
    ticks.push({ mm, x, h: isMajor ? 10 : 5, showLabel: mm % label === 0 && isMajor })
  }

  return (
    <svg
      width={lengthPx}
      height={THICKNESS}
      style={{ display: 'block', userSelect: 'none' }}
    >
      <rect width={lengthPx} height={THICKNESS} fill={RULER_BG} />
      {/* paper highlight band */}
      <rect
        x={offsetPx}
        y={0}
        width={paperSizeMm * pxPerMm}
        height={THICKNESS}
        fill="rgba(255,255,255,0.5)"
      />
      {ticks.map(({ mm, x, h, showLabel }) => (
        <g key={mm}>
          <line x1={x} y1={THICKNESS} x2={x} y2={THICKNESS - h} stroke={TICK_COLOR} strokeWidth={0.5} />
          {showLabel && (
            <text x={x + 1.5} y={THICKNESS - h - 1} fontSize={7} fill={LABEL_COLOR} fontFamily="monospace">
              {mm}
            </text>
          )}
        </g>
      ))}
      <line x1={0} y1={THICKNESS - 0.5} x2={lengthPx} y2={THICKNESS - 0.5} stroke={TICK_COLOR} strokeWidth={0.5} />
    </svg>
  )
}

export function RulerV({ lengthPx, viewportTransform: vt, paperSizeMm }: RulerProps) {
  const scale = vt[3] || 1
  const offsetPx = vt[5]
  const pxPerMm = scale * (96 / 25.4)
  const { minor, major, label } = getTickInterval(pxPerMm)

  const startMm = Math.floor(-offsetPx / pxPerMm / minor) * minor - minor
  const endMm = startMm + (lengthPx / pxPerMm) + minor * 2

  const ticks: { mm: number; y: number; w: number; showLabel: boolean }[] = []
  for (let mm = startMm; mm <= endMm; mm += minor) {
    if (mm < 0 || mm > paperSizeMm + minor) continue
    const y = offsetPx + mm * pxPerMm
    if (y < -4 || y > lengthPx + 4) continue
    const isMajor = mm % major === 0
    ticks.push({ mm, y, w: isMajor ? 10 : 5, showLabel: mm % label === 0 && isMajor })
  }

  return (
    <svg
      width={THICKNESS}
      height={lengthPx}
      style={{ display: 'block', userSelect: 'none' }}
    >
      <rect width={THICKNESS} height={lengthPx} fill={RULER_BG} />
      {/* paper highlight band */}
      <rect
        x={0}
        y={offsetPx}
        width={THICKNESS}
        height={paperSizeMm * pxPerMm}
        fill="rgba(255,255,255,0.5)"
      />
      {ticks.map(({ mm, y, w, showLabel }) => (
        <g key={mm}>
          <line x1={THICKNESS} y1={y} x2={THICKNESS - w} y2={y} stroke={TICK_COLOR} strokeWidth={0.5} />
          {showLabel && (
            <text
              x={-(y + 2)}
              y={THICKNESS - w - 1}
              fontSize={7}
              fill={LABEL_COLOR}
              fontFamily="monospace"
              transform="rotate(-90)"
            >
              {mm}
            </text>
          )}
        </g>
      ))}
      <line x1={THICKNESS - 0.5} y1={0} x2={THICKNESS - 0.5} y2={lengthPx} stroke={TICK_COLOR} strokeWidth={0.5} />
    </svg>
  )
}
