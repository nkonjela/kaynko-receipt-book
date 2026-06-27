# Kaynko Designer — Variable Print Designer Northstar

## Mission

Kaynko Designer is a **Variable Print Designer**.

Not a graphics editor. Not a receipt book tool.

Its purpose: design a document **once**, then automatically generate thousands of print-ready copies with intelligent numbering, variable data, and professional pagination.

Primary users: print shops, commercial printers, stationery manufacturers, schools, event organizers, government departments, NGOs.

---

## The Four-Step Workflow

Every feature must fit this pattern:

```
1. Design Once      → canvas: create one perfect template
2. Insert Variables → {AUTO_NUMBER}, {DATE}, {QR_CODE}, {SERIAL}, etc.
3. Configure        → Generation Panel: books, copies, layout, print marks
4. Generate         → one click → thousands of uniquely numbered PDFs
```

If a workflow requires repetitive manual actions, the application has failed.

---

## The Generation Engine

The most important system in the application. Everything else supports it.

**Responsibilities:**
- Duplicate layouts across pages
- Increment and resolve variables
- Generate numbering sequences
- Handle book bundling and copy repetition
- Calculate page count, manage overflow
- Produce the final PDF

**Rule:** The Generation Engine is independent from the canvas. The canvas shows the master template. Generated copies exist only inside the engine — never on the canvas.

---

## The Engineering Test

Before implementing any feature, ask:

1. Does this reduce manual work?
2. Can the Generation Engine do this instead of the user?
3. Can the user design once instead of many times?
4. Will this still make sense in five years?

If the answer to any question is "No," redesign before implementing.

---

## Variables (future)

Variables are first-class objects — draggable, styleable, resizable like any other element.

| Variable | Description |
| -------- | ----------- |
| `{AUTO_NUMBER}` | Sequential number (currently implemented as Number Field) |
| `{BOOK_NUMBER}` | Which book in the run |
| `{COPY_NUMBER}` | Which copy (original/duplicate/triplicate) |
| `{PAGE_NUMBER}` | Absolute page number in the PDF |
| `{DATE}` | Generation date |
| `{SERIAL}` | UUID or random serial |
| `{QR_CODE}` | QR code generated from a variable |
| `{BARCODE}` | Barcode generated from a variable |
| `{CUSTOM_FIELD}` | User-defined data (mail merge / data import) |

---

## Document Types (one engine, all types)

Receipt Books, Invoice Books, Quotations, Delivery Notes, Purchase Orders, Job Cards, Cash Receipt Books, Waybills, Carbon Copy Books, Event Tickets, Raffle Tickets, Certificates, Vouchers, Labels, Stickers, Forms, Contracts, Business Cards, Flyers, Posters.

---

## Success Metric

A print shop should be able to:

- Design a document once (< 10 min)
- Configure generation (< 30 sec)
- Generate 20,000 uniquely numbered documents (one click)
- Export a production-ready PDF
- Send directly to print — no corrections needed

---

## What Has Been Built (Generation Engine Phase 1)

- `numberingStore` — `booksCount`, `itemsPerBook`, `copiesPerItem` (1/2/3)
- `exportPDF` — `copiesPerItem` support: each unique number fills N consecutive slots
- `GenerationPanel` — dedicated modal UI with Standard / Books modes, live page count preview
