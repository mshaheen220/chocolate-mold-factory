# Chocolate Mold Factory

A visual UI to configure, preview, and generate a single 3D-printable chocolate master (a circle, oval, square, or rectangle coin, or a piece contoured to the artwork's own outline), compiled on demand by the [OpenSCAD](https://openscad.org/) CLI.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS, with a `@react-three/fiber` viewport for orbiting/panning the generated STL model, an instant client-side 2D layout preview, a chocolate cost estimator, and a rotating print-tips panel.
- **Backend:** Node.js + Express + TypeScript, shelling out to the OpenSCAD CLI to compile a parametric `.scad` template into a `.stl` file.
- **Containerized:** Docker multi-stage build; OpenSCAD runs headlessly under `xvfb`.

## Workflows

Pick one with **Piece Shape** at the top of Geometry & Sizing.

**Circle / Oval / Square / Rectangle** — upload an SVG graphic and generate one relief coin in that shape. Width is the diameter for a circle and the side length for a square; oval and rectangle add an independent **Length (Y)**, and square/rectangle add a **Corner Radius**. Coins support an optional raised or recessed border (single ring, double ring, or beaded), size presets (Small/Medium/Large/Custom) that keep the uploaded graphic auto-fit as you switch between them, and draft-angle tapering for clean mold release.

**Contour** — the piece's outline follows the artwork itself, and each fill color becomes its own relief level (see `client/public/demos/` for a sample traced logo). Under **Color Layers**, every color gets:

- **In piece** — whether it's part of the chocolate. The outline is the combined shape of every included color; unchecked colors are background, cut away wherever they're painted (near-white colors start unchecked).
- **Height above base** — mm above the base's top face (0 = flush, negative = engraved). The most visible color starts at 0, the rest at 1.2mm.

**Relief Direction** flips every color at once: Raised makes the details stand out, Recessed engraves them into the base instead (heights then read as depths, and engraving always leaves at least 0.2mm of base so it can't cut through).

**Base Plate** adds a lower tier: a smooth plate (the design's convex hull, grown by **Plate Border**) that fills every gap and notch in the outline, with the design standing **Design Height Above Plate** on top of it. The back label moves into the plate's underside, and recessed details may cut all the way down to the plate.

Also: **Piece Size** (longest side), **Outline Margin** (a rim grown around the outline, which also bridges tiny gaps), and **Remove Detached Bits Under** (drops pieces smaller than this % of the main body, such as a ™ mark, which would otherwise print as separate crumbs). Text, `<use>` references, and embedded images in the SVG are ignored; convert text to outlines first.

How it works: the browser flattens every filled shape into polygons (resolving CSS, inherited fills, and transforms via the DOM), removes detached specks, simplifies outlines to 0.05mm (0.15mm for Quick Preview), and uploads one SVG per run of same-height colors, bottom to top. `server/templates/contour.scad` subtracts each layer by everything painted above it, unions the included layers into the outline, and extrudes each one to its height. The template is built from unions only (the back label and engravings are cut in 2D), because a CGAL `difference()` against this many outline vertices takes minutes instead of seconds.

## Key features

- **Instant 2D layout preview** — as soon as a graphic is uploaded (or any slider moves), a client-side SVG preview shows exact fit with zero OpenSCAD round-trip. Contoured pieces are shaded by height (lighter = taller) with their final dimensions.
- **Quick Preview vs. Full Render** — mirrors OpenSCAD's own Preview/Render split. Quick Preview uses a fixed low facet count and swaps the uploaded graphic for its convex hull (near-instant, even for complex artwork); Full Render always uses full detail and a user-adjustable facet count ("Render Detail"). Download STL only ever points at the last Full Render, so a rough draft can never be mistaken for print-ready output.
- **Chocolate Cost Estimate** — computes the exact geometric volume of the coin (base + border + relief), with the relief's contribution measured by rasterizing the uploaded graphic to find its actual ink coverage rather than guessing a fill ratio, then converts that to a cost per coin for Milk/Dark/White/Colored chocolate.
- **Save / Import Settings** — download the current parameters as a JSON file, and load them back later, so you don't have to remember slider values across sessions.
- **Normalize to Layers** — snaps Base Thickness, Relief Height, and Border Height to whole print layers for a given layer height / first layer height, so each one's top surface lands exactly on a layer boundary.
- **Back Label** — an optional short version/identifier string, etched as a shallow recess into the coin's back, so physical prints of different settings can be told apart.
- **Print & Slicer Reference** — a persistent panel of recommended nozzle, filament, and slicer settings (with reasoning for each), exportable to `.txt` or `.json` to keep alongside a downloaded STL for later.
- **Rotating tips** — a header panel of categorized tips (app usage, slicing, printing/mold-making) with manual prev/next, autoplay, and collapse.

## Project layout

```
.
├── client/                    React + Vite + TypeScript frontend
│   └── src/
│       ├── components/        UI (Sidebar, ActionBar, TipsPanel, PrintReferenceCard, ChocolateCostEstimate, ...)
│       │   ├── controls/      Reusable form controls (NumberField, SelectField, FileDropzone, TokenSizePresets)
│       │   └── viewer/        STLViewer (3D), TokenLayoutPreview (2D), GeneratingOverlay
│       ├── utils/             SVG parsing/auto-fit/fill-ratio, volume math, settings export
│       ├── paramSchemas.ts    Field definitions driving the sidebar UI
│       ├── printRecommendations.ts / tips.ts   Static reference data + rotating tip pool
│       └── App.tsx
├── server/                    Express + TypeScript backend
│   ├── src/
│   │   ├── routes/            /api/generate, /api/health, /api/output
│   │   ├── lib/                validation (param whitelist), OpenSCAD runner, SVG normalization, cleanup
│   │   └── middleware/         Multer upload handling
│   ├── templates/             Parametric OpenSCAD templates (medallion.scad = coin, contour.scad = contoured piece)
│   ├── uploads/                Ephemeral SVG uploads (deleted immediately after each compile)
│   ├── output/                 Generated STL files (persisted via Docker volume)
│   └── temp/                   Scratch space for in-flight compiles
├── docker/                    Container support scripts (xvfb wrapper)
├── Dockerfile                 Multi-stage build (deps → client/server build → runtime/dev/client-dev)
├── docker-compose.yml         Single-container production deployment
└── docker-compose.dev.yml     Dual-service dev override (hot reload + Vite HMR)
```

## Local development (without Docker)

Requires Node.js 20+ and the `openscad` CLI installed and on your `PATH`.

```bash
npm install
cp .env.example .env
npm run dev
```

This runs the Express API on `http://localhost:3000` and the Vite dev server on `http://localhost:5173` (which proxies `/api` to the backend).

## Running with Docker

**Single-container production build:**

```bash
docker compose up --build
```

Serves the built frontend and API together at `http://localhost:3000`.

**Dual-service development stack** (hot-reloading backend, Vite HMR frontend):

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Frontend at `http://localhost:5173`, backend at `http://localhost:3000`.

`./server/output` and `./server/templates` are bind-mounted in both setups, so generated files persist across restarts and template edits take effect without a rebuild.

## API

- `GET /api/health` — checks that the `openscad` executable is present and callable.
- `POST /api/generate` — multipart form:
  - the coin's parameters (see `server/src/lib/validation.ts` for the full whitelist — numeric ranges, enums, booleans)
  - `quality` (`draft` | `final`, default `final`) — `draft` forces a fixed low facet count and swaps any uploaded graphic for its convex hull, for a fast Quick Preview; `final` is the print-quality Full Render
  - `render_detail` (16–180, default 96) — facet count (`$fn`) used for `final`-quality renders only; ignored for `draft`
  - an optional `file` (SVG graphic)

  Returns `{ fileName, url, quality }`; fetch `GET {url}` for the STL binary, or `GET {url}?download=1` to force a download.
- `POST /api/generate/contour` — multipart form for a contoured piece:
  - `piece_size`, `base_thickness`, `outline_margin`, `version_label`, plus `art_width` / `art_height` (the shared layer frame) and `label_x` / `label_y` (back-label position, mm from center)
  - `layers` — one SVG file per layer, bottom to top (up to 24), each with viewBox `0 0 art_width art_height`
  - `layer_heights` — JSON array of mm per layer (−20 to 20); `layer_included` — JSON array of booleans (false = background mask)
  - `quality` / `render_detail` as above; same response shape

All parameters are validated against a fixed schema (numeric ranges, enum whitelists, boolean coercion) before being passed to the OpenSCAD CLI as `-D` flags via `execFile` — never through a shell — so arbitrary input can't reach the command line. Uploaded SVGs are also normalized server-side so viewBox units reliably map to millimeters inside OpenSCAD, regardless of how the original file declared its size.

## Configuration

See [.env.example](.env.example) for all supported environment variables (port, OpenSCAD binary path, upload size limits, file TTL, compile timeout, CORS origin).
