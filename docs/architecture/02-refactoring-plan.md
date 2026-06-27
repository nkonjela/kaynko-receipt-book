# Refactoring Roadmap — Kaynko Designer

**Purpose:** Phased plan to evolve Kaynko Designer from a receipt-book tool into a scalable Business Document Designer platform. Read `01-architecture-review.md` first for the problem context.

**Principle:** Each phase must pass `npm run typecheck && npm test` before the next phase begins. No phase breaks existing functionality.

---

## Phase 0 — Terminology Rename (Code Level)

**Why:** `ReceiptsPerPage`, `receiptIdx`, `KRBCanvasData` are naming debt that confuses contributors and blocks the mental model shift. Low-risk find+replace, no logic changes.

**Changes:**
- `ReceiptsPerPage` → `SlotsPerPage` (type in `designStore.ts`, `paperSizes.ts`, `canvas.ts`, `pdf.ts`, `PageSetupDialog.tsx`, `PreviewModal.tsx`)
- `receiptsPerPage` → `slotsPerPage` (all variable/prop names)
- `receiptIdx` → `slotIdx` (in `pdf.ts` export loop)
- `KRBCanvasData` → `DesignCanvasData` (interface in `canvas.ts`)
- API route `/api/ai/generate-receipt` → `/api/ai/generate-design` (requires server-side change too)
- Template category type `'receipt' | 'slip'` → add `'document'` | `'form'` | `'label'` to the union

**Risk:** Low — pure renaming, no logic changes. TypeScript compiler catches all missed references.

---

## Phase 1 — Break Up Giant Files

**Why:** `Editor.tsx` (793 lines) and `canvas.ts` (919 lines) are unmaintainable. Every new feature adds more lines to already-overloaded files.

### 1a — Extract canvas concerns

Split `canvas.ts` into:

```
src/lib/canvas/
  init.ts           # initCanvas(), fitToViewport(), attachZoomPan(), applyZoom()
  render.ts         # drawGrid(), drawGuides(), drawBindingEdge(), drawPerforations(), drawRectLabels()
  serialize.ts      # serializeCanvas(), loadCanvas(), migrateSchema()
  objects.ts        # addNumberField(), addCircle(), addTable(), addArrow(), addBlankField(), etc.
  types.ts          # DesignCanvasData, AnnotatedCanvas, KRBCanvasData (alias for back-compat)
  index.ts          # re-exports everything — no import changes needed at call sites
```

### 1b — Extract Editor.tsx concerns

Split `pages/Editor.tsx` into:

```
src/hooks/
  useEditorCanvas.ts      # canvas init, resize observer, fitToViewport
  useEditorKeyboard.ts    # all keyboard shortcut handlers
  useEditorGuides.ts      # user guide add/remove/render state

src/components/Editor/
  EditorToolbar.tsx       # left tool palette (add text, shape, table, etc.)
  EditorSidebar.tsx       # right sidebar (properties, page setup toggle)
  EditorStatusBar.tsx     # bottom bar: zoom, page count, slot count
  EditorCanvas.tsx        # canvas mount point + ruler overlay
```

`pages/Editor.tsx` becomes a thin composition shell: imports and wires the above hooks/components.

### 1c — Fix PropertiesPanel state mirroring

Replace 30 `useState` calls with a single derived state pattern:

```ts
// Instead of:
const [fontSize, setFontSize] = useState(...)
useEffect(() => { setFontSize(selectedObj?.fontSize) }, [selectedObj])

// Use:
const props = useDerivedObjectProps(selectedObj)  // reads directly from Fabric object
```

Create sub-panels per object type with a simple registry:

```ts
// src/components/Editor/properties/registry.ts
const registry: Record<string, React.FC<{ obj: FabricObject }>> = {
  textbox: TextboxProperties,
  rect: RectProperties,
  group: GroupProperties,   // dispatches to TableProperties or NumberFieldProperties by data.type
}
```

**Risk:** Medium — requires care with React re-render triggers from Fabric events.

---

## Phase 2 — Decouple Numbering from PDF Export

**Why:** The current `exportPDF` always generates numbers and passes them to every slot. Document types without numbering (labels, business cards, posters) can't use the export pipeline cleanly.

**Change:** Make numbering an optional post-processor:

```ts
// pdf.ts
export async function exportPDF(config: ExportConfig): Promise<Uint8Array>

// ExportConfig.numbering becomes optional:
interface ExportConfig {
  numbering?: NumberingConfig   // undefined = no substitution, render literal canvas content
  // ...rest unchanged
}
```

`renderObjectsToPage` checks for a `numberField` object: if `numbering` is undefined, render the placeholder text as-is rather than substituting.

**Risk:** Low — additive change with a backwards-compatible default.

---

## Phase 3 — Object Type Registry

**Why:** Adding barcode, QR code, signature, checkbox, or any new object type currently requires editing `PropertiesPanel.tsx`, `LayersPanel.tsx`, `canvas.ts`, and `pdf.ts`. A registry removes this coupling.

**Design:**

```ts
// src/objects/registry.ts
interface ObjectDefinition {
  type: string                                      // e.g. 'barcode', 'qr-code'
  displayName: string                               // e.g. 'Barcode'
  icon: string                                      // emoji or SVG path
  create(canvas: Canvas): FabricObject             // factory
  PropertiesPanel: React.FC<{ obj: FabricObject }> // property UI
  renderToPDF(page: PDFPage, obj: FabricObject, ...): void  // PDF renderer
}

const objectRegistry = new Map<string, ObjectDefinition>()
export function registerObject(def: ObjectDefinition) { objectRegistry.set(def.type, def) }
export function getObjectDef(type: string) { return objectRegistry.get(type) }
```

Built-in types (table, number-field, blank-field, circle, arrow) register themselves at app init. New types can be added by registering without editing existing files.

**Risk:** Medium — requires refactoring canvas factory functions and PDF renderer switch statements.

---

## Phase 4 — Template System (Database-Backed)

**Why:** Static template array blocks scaling. Can't add templates without a code deploy. Can't support user-uploaded templates, marketplace, or per-tier template access.

**Target architecture:**

```
Supabase table: templates
  id: uuid
  name: text
  category: text          -- 'receipt' | 'invoice' | 'form' | 'label' | 'certificate' | ...
  thumbnail_url: text
  canvas_json: jsonb
  numbering_config: jsonb
  paper_size: text
  tier_required: text     -- 'free' | 'starter' | 'pro'
  is_published: boolean
  created_at: timestamptz
```

Client fetches templates lazily (paginated, filtered by category/tier). Static templates in `src/templates/index.ts` are seeded into the database and the file is deleted.

**Risk:** High — requires Supabase schema migration, data seeding, and UI changes to `Templates.tsx`. Do this in a separate branch with full testing.

---

## Phase 5 — Canvas Engine / PDF Engine Alignment

**Why:** Canvas and PDF use independent rendering implementations. Group coordinate math is duplicated. Layout drift is easy to introduce.

**Target:** A shared `LayoutEngine` that both canvas (for preview) and PDF (for export) call:

```ts
// src/lib/layout/engine.ts
interface LayoutEngine {
  measureObject(obj: ObjectSpec): BoundingBox
  placeObject(obj: ObjectSpec, slot: SlotRect): PlacedObject
  renderText(text: string, style: TextStyle, box: BoundingBox): RenderCommand[]
}
```

Canvas and PDF implement `RenderCommand[]` differently but share the layout math.

**Risk:** High — architectural change to core rendering. Requires careful testing, including `npm run test:pdf` visual verification. Plan this phase in detail before starting.

---

## Phase 6 — Multi-Page Document Support (Future)

**Why:** Business documents like contracts, reports, and multi-page forms need more than one canvas page.

**Requires completing Phase 1–5 first** — the current single-canvas model makes multi-page impossible without the preceding refactors.

High-level approach:
- `designStore` grows a `pages: PageConfig[]` array (each with its own canvas JSON)
- Editor gains a page thumbnail strip
- PDF export iterates pages before iterating slots

---

## Sequencing Summary

| Phase | Effort | Risk | Dependency |
| ----- | ------ | ---- | ---------- |
| 0 — Rename | 2–4 hrs | Low | None |
| 1a — Split canvas.ts | 4–6 hrs | Low-Med | None |
| 1b — Split Editor.tsx | 1–2 days | Med | None |
| 1c — Fix PropertiesPanel | 1 day | Med | None |
| 2 — Decouple numbering | 2–4 hrs | Low | None |
| 3 — Object registry | 2–3 days | Med | Phase 1 |
| 4 — Template DB | 2–3 days | High | Phase 0 |
| 5 — Engine alignment | 3–5 days | High | Phase 1, 2, 3 |
| 6 — Multi-page | 1+ week | High | Phase 1–5 |

**Start with Phase 0 and 2** — they have no dependencies, are low-risk, and immediately improve the codebase for general-purpose use.
