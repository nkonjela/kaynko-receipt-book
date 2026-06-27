# Architecture Review — Kaynko Designer

**Date:** 2026-06-27  
**Reviewed by:** Claude Code (Sonnet 4.6)  
**Purpose:** Pre-refactor snapshot — honest assessment of current state before scaling to a general-purpose Business Document Designer.

---

## Current Structure

```
krb/src/
  lib/          # Core engines: canvas, pdf, numbering, guides, paperSizes, aiToCanvas, featureGate
  store/        # Zustand: designStore, numberingStore, userStore
  components/
    Editor/     # PropertiesPanel, LayersPanel, PageSetupDialog, AIGenerateDialog,
                # PreviewModal, Ruler, ZoomControls, CanvasContextMenu, TableColumnResizer
  pages/        # Dashboard, Editor, Templates, Pricing, auth/Login, auth/Callback
  templates/    # Static array of built-in template definitions
```

**State management:** Three Zustand stores. `designStore` holds paper/layout config + undo history. `numberingStore` holds numbering config. `userStore` holds auth + tier.

**Rendering pipeline:** Fabric.js canvas (`canvas.ts`) handles the interactive surface. An `after:render` hook draws non-Fabric overlays (grid, guides, binding edge, perforation lines). PDF export (`pdf.ts`) re-renders the same objects via pdf-lib independently — no shared renderer.

**Object model:** Objects are native Fabric.js objects (`Rect`, `Textbox`, `Group`, `Line`, etc.) with an optional `data` field for KD-specific metadata (table config, number-field type, blank-field type). No unified base class.

**PDF generation:** `exportPDF(config)` in `pdf.ts` iterates tiled slots, calls `renderObjectsToPage()` per slot, substitutes number fields. Crop marks, watermarks, and perforations are drawn separately after the slot pass.

**Property system:** `PropertiesPanel.tsx` detects the selected Fabric object type via `instanceof` checks and conditionally renders the relevant property controls. No plugin registry.

**Template system:** Static array exported from `src/templates/index.ts`. Bundled with the client.

---

## Architectural Problems

### Critical (block general-purpose scaling)

**1. Giant files with mixed concerns**

| File | Lines | Problem |
| ---- | ----- | ------- |
| `pages/Editor.tsx` | ~793 | Canvas init, keyboard shortcuts, zoom/pan, binding UI, export UI, guide management, rulers, mobile detection — all in one component with 25+ useState calls |
| `lib/canvas.ts` | ~919 | Zoom/pan, grid rendering, guide rendering, binding visualization, perforation rendering, serialization, AND all object factory functions (addTable, addArrow, addCircle, etc.) |
| `components/Editor/PropertiesPanel.tsx` | ~580 | Type detection, property rendering, state mirroring, table rebuild, unit conversion — all mixed together |

**2. Numbering baked into PDF export**

`exportPDF` in `pdf.ts` calls `generateNumbers()` unconditionally and passes numbers into every slot render. There is no way to export a document without the numbering engine running. Adding document types that don't need numbering (business cards, posters, certificates) requires restructuring the export pipeline.

**3. Template system cannot scale**

All templates are a static TypeScript array bundled with the client. Adding 100+ templates means 100+ templates always loaded in memory. No pagination, no search, no lazy loading, no user-uploaded templates. Requires code deployment to add a template.

**4. No plugin architecture for object types**

Adding a new object type (barcode, QR code, signature, checkbox) requires editing `PropertiesPanel.tsx`, `LayersPanel.tsx`, `canvas.ts` (factory function), and `pdf.ts` (renderer). There is no registry or extension point.

**5. Dual rendering pipeline with no shared abstraction**

Canvas rendering (Fabric.js) and PDF rendering (pdf-lib) are completely independent implementations. Layout drift between editor and export is easy to introduce. Group coordinate math is duplicated in both.

---

### High (technical debt, blocks feature development)

**6. Receipt-specific terminology throughout the codebase**

`ReceiptsPerPage` type is used in 60+ places across `designStore`, `canvas.ts`, `pdf.ts`, `paperSizes.ts`, `PageSetupDialog.tsx`, `PreviewModal.tsx`. The concept is correct (slots per page) but the name prevents the mental model shift to a general document designer.

**7. PropertiesPanel state mirroring**

`PropertiesPanel.tsx` has ~30 `useState` calls that mirror properties of the selected Fabric object (font size, fill color, opacity, width, height, etc.). When the selected object changes, these states are reset via `useEffect`. This pattern creates stale-state bugs and is hard to extend — every new object property needs a new `useState`.

**8. No command system for keyboard shortcuts**

Keyboard shortcuts (Ctrl+Z, Ctrl+C, Delete, arrow keys, etc.) are handled in a single 80-line `useEffect` block in `Editor.tsx`. No command pattern, no rebindable keys, no way to expose commands to a menu or toolbar without duplicating logic.

**9. `canvas.ts` uses `(canvas as AnnotatedCanvas)` pattern extensively**

The canvas metadata (`canvas.data`) is accessed via type casts to `AnnotatedCanvas`. This is fragile: if Fabric.js changes how it handles custom properties, or if the canvas is accessed before `data` is initialized, the cast silently fails and returns `undefined`.

**10. Magic numbers scattered throughout**

DPI constants (96, 300, 72), zoom limits (0.05, 8.0), grid defaults (5mm), color values, and unit conversion factors appear inline throughout `canvas.ts` and `pdf.ts`. No centralized configuration.

---

### Medium (quality of life)

**11. CMYK export not implemented**

`ExportConfig` accepts `cmyk: boolean` but `pdf.ts` ignores it. The parameter is a dead stub.

**12. PDF metadata not configurable**

Document title, author, creator are hardcoded. Can't set per-design metadata.

**13. No error handling in `userStore`**

`fetchTier()` silently defaults to `'free'` on network failure with no error state. Users see no feedback if tier fetch fails.

**14. Paper size registry is not extensible**

Paper sizes are a static object in `paperSizes.ts`. No way for a user or plugin to register custom sizes at runtime.

---

## Scalability Assessment

| Capability | Current | Verdict |
| ---------- | ------- | ------- |
| Hundreds of templates | Static bundle | ❌ Blocks at ~20 templates |
| Thousands of objects | No virtual rendering | ⚠️ Degrades above ~500 |
| Large tables | Manual row/cell tracking | ⚠️ Breaks at complex layouts |
| Multi-page documents | Single-canvas model | ❌ Not supported |
| Undo/Redo | JSON snapshots in array | ✅ Works, memory-heavy at scale |
| Snapping & alignment | Implemented (guides.ts) | ✅ Well designed |
| Professional PDF output | pdf-lib pipeline | ✅ Works for current use case |
| Future collaboration | No shared model | ❌ Not architected for it |

---

## Strengths to Preserve

- **`numbering.ts`** — Pure function, single responsibility, fully tested. Model for all new modules.
- **`guides.ts`** — Clean abstraction, threshold constants externalized, well typed.
- **Zustand store separation** — `designStore`, `numberingStore`, `userStore` have clear boundaries.
- **TypeScript discipline** — Interfaces and types are consistently used throughout.
- **Fabric.js `customProperties`** — `FabricObject.customProperties = ['data']` is the right approach for serializing custom metadata.

---

## Summary Priority Matrix

| Priority | Item |
| -------- | ---- |
| 🔴 Critical | Break up `Editor.tsx` and `canvas.ts` |
| 🔴 Critical | Decouple numbering from PDF pipeline |
| 🔴 Critical | Move templates to database |
| 🔴 Critical | Create object type registry / plugin system |
| 🟠 High | Rename `ReceiptsPerPage` → `SlotsPerPage` throughout |
| 🟠 High | Fix PropertiesPanel state mirroring |
| 🟠 High | Implement command system for keyboard shortcuts |
| 🟡 Medium | Implement CMYK export |
| 🟡 Medium | Centralize unit conversion (mm/px/pt) |
| 🟡 Medium | Configurable PDF metadata per design |
| 🟢 Low | Error handling in userStore |
| 🟢 Low | Extensible paper size registry |
