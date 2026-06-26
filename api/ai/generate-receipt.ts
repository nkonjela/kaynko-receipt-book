import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const config = { runtime: 'nodejs', maxDuration: 30 }

const RECEIPT_ANALYSIS_SYSTEM_PROMPT = `You are an expert at analysing receipt and invoice layouts.
When given an image of a receipt, analyse its layout and return ONLY valid JSON — no prose, no markdown fences.

The JSON must match this exact schema:
{
  "paperSize": "A4" | "A5" | "half-letter" | "letter" | "custom",
  "orientation": "portrait" | "landscape",
  "colors": {
    "primary": "<hex>",
    "accent": "<hex>",
    "background": "<hex>"
  },
  "elements": [
    {
      "type": "text" | "image-placeholder" | "table" | "line" | "rectangle" | "number-field" | "blank-field",
      "x": <0-100>,
      "y": <0-100>,
      "width": <0-100>,
      "height": <0-100>,
      "text": "<optional string for text/number-field>",
      "fontSize": <optional number>,
      "fontWeight": "normal" | "bold",
      "fill": "<optional hex color>",
      "rows": <optional number for table>,
      "cols": <optional number for table>,
      "label": "<optional string for blank-field>"
    }
  ],
  "suggestedNumberingConfig": {
    "prefix": "<string>",
    "digits": <number>,
    "start": <number>
  }
}

Rules:
- All x, y, width, height are PERCENTAGES of the page (0–100), not pixels
- Identify the receipt number / invoice number field as type "number-field"
- Identify blank lines the customer fills in as type "blank-field" with a descriptive label
- Use 5–20 elements maximum — do not over-fragment
- Infer suggestedNumberingConfig from any visible receipt numbers (e.g. "REC-0042" → prefix "REC-", digits 4, start 42)
- If no receipt number is visible, suggest prefix "REC-", digits 4, start 1
- Default paperSize to "A5" if unclear
- Default background to "#ffffff" if unclear`

type AllowedMimeType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // Verify Supabase auth
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabase = createClient(
    process.env['VITE_SUPABASE_URL'] ?? '',
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '',
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
  }

  // Check AI generation quota
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  const tier = subscription?.['tier'] ?? 'free'
  const maxGenerations = tier === 'free' ? 3 : Infinity

  if (isFinite(maxGenerations)) {
    const { data: usage } = await supabase
      .from('usage_monthly')
      .select('ai_generations_used')
      .eq('user_id', user.id)
      .eq('month', month)
      .maybeSingle()

    const used = (usage?.['ai_generations_used'] as number | undefined) ?? 0
    if (used >= maxGenerations) {
      return new Response(
        JSON.stringify({ message: 'AI generation limit reached', upgradeRequired: true }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  // Parse request body
  const body = await req.json() as { imageBase64?: string; mimeType?: string }
  const { imageBase64, mimeType } = body

  if (!imageBase64 || !mimeType) {
    return new Response(JSON.stringify({ message: 'imageBase64 and mimeType are required' }), { status: 400 })
  }

  if (!isAllowedMimeType(mimeType)) {
    return new Response(JSON.stringify({ message: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' }), { status: 400 })
  }

  // Call Claude Vision
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: RECEIPT_ANALYSIS_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        { type: 'text', text: 'Analyse this receipt and return the layout as JSON.' },
      ],
    }],
  })

  const rawText = response.content[0]?.type === 'text' ? response.content[0].text : ''

  // Strip markdown fences if present
  const jsonText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  let analysis: unknown
  try {
    analysis = JSON.parse(jsonText)
  } catch {
    return new Response(
      JSON.stringify({ message: 'AI returned invalid JSON', raw: rawText }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Increment usage atomically
  await supabase.rpc('increment_ai_usage', { p_user_id: user.id })

  return new Response(JSON.stringify(analysis), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
