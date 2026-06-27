# KRB — Professional Document Composition Engine: Vision

## Project Vision

Stop thinking of this application as a receipt book designer.

We are building a **professional Document Composition Engine** similar to the architecture used by CorelDRAW, Adobe InDesign, Adobe Illustrator, Canva and Figma.

Receipt books are only one template built on top of the engine.

The engine must eventually be capable of designing ANY printable document without architectural changes.

Examples include:

- Receipt Books, Invoice Books, Quotation Books, Tax Invoices
- Purchase Orders, Delivery Notes, Goods Received Notes, Waybills
- Job Cards, Cash Receipt Books, Carbon Copy Books, Numbered Books
- Certificates, Forms, Contracts
- Business Cards, Flyers, Posters, Labels, Stickers
- Packaging, Multi-page documents

---

## Primary Goal

Build a professional desktop publishing engine.

- Everything visible on the canvas is an **OBJECT**
- Nothing should be hardcoded
- Every object should be editable
- Everything should be configurable
- Everything should support undo/redo
- Everything should be serializable
- Everything should export perfectly to PDF

---

## Object Model Hierarchy

```
Application
└── Workspace
    └── Documents
        └── Pages
            └── Layers
                └── Objects
```

Every object belongs to one page → one layer → one document. Objects must never exist outside this hierarchy.

---

## Document

A document should contain: Document ID, Name, Size, Orientation, Margins, Bleed, Safe Area, Page Collection, Master Pages, Styles, Fonts, Assets, Metadata, History, Settings, Document Variables, Templates, Document Version.

---

## Page

Each page should support: Width, Height, Background, Grid, Guides, Snap, Margins, Bleed, Safe Area, Header, Footer, Page Number, Locked State, Visibility, Rotation.

---

## Layers

Support unlimited layers. Each layer: ID, Name, Visibility, Opacity, Blend Mode, Locked, Printable, Color, Order, Groups, Nested Layers.

---

## Canvas

The canvas is NOT a drawing area. It is a **rendering engine**.

Responsibilities: Infinite canvas, Zoom, Pan, Pixel rendering, Object rendering, Selection rendering, Guide rendering, Snap rendering, Drag rendering, Resize rendering, Rotation rendering, Hover rendering, Rulers, Measurement Units, Performance Optimization, Virtual Rendering.

---

## Object System

Everything is an object. Examples: Text, Rectangle, Circle, Line, Image, Logo, Barcode, QR Code, Signature, Shape, Arrow, Table, Group, Number Generator, Page Number, Divider, Watermark, SVG, Icons, Custom Components.

### BaseObject properties

ID, Position, Size, Rotation, Scale, Visibility, Opacity, Layer, Locked, Style, Transform, Constraints, Metadata, Events, Animations (future), Serialization, History.

---

## Transform Engine

Every object should support: Move, Resize, Rotate, Scale, Flip, Duplicate, Clone, Align, Distribute, Lock Ratio, Snap, Smart Guides, Bounding Boxes, Anchor Points, Pivot Point, Transform Matrix.

---

## Selection Engine

Support: Single Selection, Multiple Selection, Lasso Selection, Shift Selection, Ctrl Selection, Select All, Deselect, Group Selection, Nested Selection, Locked Object Protection, Selection Handles, Selection Rotation, Selection Bounding Box, Selection Shortcuts.

---

## Alignment Engine

Support: Align Left/Right/Top/Bottom, Center Horizontal/Vertical, Distribute Horizontally/Vertically, Snap to Grid, Snap to Guides, Snap to Objects, Snap to Margins, Snap to Page, Smart Alignment Guides.

---

## Table Engine

**This is the most important engine.** Treat it like a spreadsheet inside a publishing application.

Support:
- Structure: Unlimited rows/columns, Dynamic height/width, Header, Footer, Repeating Headers/Footers, Automatic Pagination, Cell Merging, Split Cells, Nested Tables
- Content: Images, QR Codes, Barcodes, Signatures, Checkboxes, Rich Text, Currency, Dates, Auto Numbering, Formulas, Totals, Subtotals, VAT, Discounts, Conditional Formatting
- Interaction: Column/Row Resize, Drag Columns/Rows, Hide Columns, Freeze Columns, Lock Columns/Rows, Automatic Row Height
- Styling: Cell Styles, Column Styles, Table Styles, Table Templates
- Output: Overflow Handling, Multi-page rendering, No broken rows, Professional PDF layout

The table engine should be **independent from the canvas**.

---

## Text Engine

Professional typography: Font Family, Variable Fonts, Font Weight, Line Height, Letter Spacing, Paragraph Spacing, Bullets, Numbering, Justification, Text Wrapping, Text Overflow, Text Frames, Columns, Vertical Text, Rich Text, OpenType Features, Baseline Shift, Text Styles, Character Styles, Paragraph Styles.

---

## Style Engine

Reusable styles: Text Styles, Table Styles, Object Styles, Page Styles, Themes, Global Colors, Brand Kits, Variables, Style Inheritance.

---

## History Engine

Everything must support: Undo, Redo, Branch History, Snapshots, Transactions, Grouped Operations, History Compression.

---

## Property Panel

When an object is selected the properties panel changes dynamically — Text, Table, Image, Shape, Barcode, QR, Page, Layer, Guide, Document properties.

---

## Component System

Every feature should be modular. Avoid giant files. Avoid deeply nested components. Create reusable modules. Each module should have one responsibility.

---

## PDF Engine

PDF export must be identical to the canvas: No clipping, No overlaps, Vector rendering, Embedded fonts/images, High DPI, CMYK ready, Margins, Bleed, Crop Marks, Page Numbers, Bookmarks, Multi-page support, Automatic Pagination, Receipt Roll support, Multiple paper sizes, Custom Sizes.

---

## Performance Targets

- 10,000 objects
- Hundreds of pages
- Large tables
- Smooth zoom, pan, selection
- Fast rendering via virtualized/incremental rendering
- Memory optimization, Lazy loading

---

## Future Features

Plugins, Custom widgets, Cloud collaboration, Version history, Real-time collaboration, AI object generation, OCR, Data Merge, Mail Merge, Template Marketplace, Asset Libraries, Scripting, Macros, Extensions.

---

## Engineering Principles

- Never write code just to make something work — always build reusable systems
- Avoid duplicate logic
- Follow SOLID principles and composition over inheritance
- Separate UI from business logic
- Separate rendering from data
- Separate layout from interaction
- Separate PDF rendering from canvas rendering
- Use immutable state where possible
- Everything must be testable, serializable, modular, extensible
- If a feature cannot scale to professional publishing software standards, redesign it before implementation

---

## Development Process

Before writing any code:

1. Analyze the current architecture
2. Identify architectural flaws
3. Refactor where necessary
4. Design reusable systems
5. Implement one engine at a time
6. Test thoroughly, ensure no regressions
7. Only then move to the next engine

Never rush to implement UI without a solid underlying engine. The quality of the architecture is more important than the speed of development.

---

## Recommended Architecture Document Series

```
docs/architecture/
  00-vision.md          ← this file
  01-document-engine.md
  02-canvas-engine.md
  03-rendering-engine.md
  04-layout-engine.md
  05-selection-engine.md
  06-table-engine.md
  07-text-engine.md
  08-property-panel.md
  09-history-engine.md
  10-pdf-engine.md
  11-plugin-system.md
  12-state-management.md
  13-performance.md
  14-testing-standards.md
```

Each subsequent document should specify the concrete API, data structures, and implementation approach for its engine, informed by the current codebase state.
