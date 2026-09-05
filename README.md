# Chocolate Mold Factory

A visual UI to configure, preview, and generate 3D-printable silicone mold boxes and chocolate medallions, compiled on demand by the [OpenSCAD](https://openscad.org/) CLI.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS, with a `@react-three/fiber` viewport for orbiting/panning generated STL models, an instant client-side 2D layout preview, a chocolate cost estimator, and a rotating print-tips panel.
- **Backend:** Node.js + Express + TypeScript, shelling out to the OpenSCAD CLI to compile parametric `.scad` templates into `.stl` files.
- **Containerized:** Docker multi-stage build; OpenSCAD runs headlessly under `xvfb`.

## Workflows

1. **2D Graphic → Chocolate Tokens (Medallions)** — upload an SVG graphic and generate:
   - `single_token` — one relief token (circle, square, oval, or rectangle)
   - `reusable_mold_box` — a pour-dam box holding a grid of tokens, sized to cast a reusable silicone mold directly from the print
   - `adjustable_frame_strip` / `adjustable_frame_batch` / `adjustable_frame_preview` — reusable L-profile wall strips (print once, reuse for boxes of almost any size) instead of a one-off monolithic box

   Tokens support an optional raised or recessed border (single ring, double ring, or beaded), size presets (Small/Medium/Large/Custom) that keep the uploaded graphic auto-fit as you switch between them, and draft-angle tapering for clean mold release.

2. **Reusable Silicone Mold Box (Parametric Frame)** — a generic tapered cavity box for arbitrary silicone pours, with an optional center registration guide for two-part alignment.

## Key features

- **Instant 2D layout preview** — as soon as a graphic is uploaded (or any slider moves), a client-side SVG preview shows exact fit with zero OpenSCAD round-trip.
- **Quick Preview vs. Full Render** — mirrors OpenSCAD's own Preview/Render split. Quick Preview uses a fixed low facet count and swaps the uploaded graphic for its convex hull (near-instant, even for complex artwork); Full Render always uses full detail and a user-adjustable facet count ("Render Detail"). Download STL only ever points at the last Full Render, so a rough draft can never be mistaken for print-ready output.
- **Chocolate Cost Estimate** — computes the exact geometric volume of a token (base + border + relief), with the relief's contribution measured by rasterizing the uploaded graphic to find its actual ink coverage rather than guessing a fill ratio, then converts that to a cost per coin (and per batch) for Milk/Dark/White/Colored chocolate.
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
│       ├── paramSchemas.ts    Per-workflow field definitions driving the sidebar UI
│       ├── printRecommendations.ts / tips.ts   Static reference data + rotating tip pool
│       └── App.tsx
├── server/                    Express + TypeScript backend
│   ├── src/
│   │   ├── routes/            /api/generate, /api/health, /api/output
│   │   ├── lib/                validation (param whitelists), OpenSCAD runner, SVG normalization, cleanup
│   │   └── middleware/         Multer upload handling
│   ├── templates/             Parametric OpenSCAD templates (medallion.scad, mold_box.scad)
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
  - `workflow` (`medallion` | `mold_box`)
  - the workflow's parameters (see `server/src/lib/validation.ts` for the full whitelist — numeric ranges, enums, booleans)
  - `quality` (`draft` | `final`, default `final`) — `draft` forces a fixed low facet count and swaps any uploaded graphic for its convex hull, for a fast Quick Preview; `final` is the print-quality Full Render
  - `render_detail` (16–180, default 96) — facet count (`$fn`) used for `final`-quality renders only; ignored for `draft`
  - an optional `file` (SVG, medallion workflow only)

  Returns `{ fileName, url, quality }`; fetch `GET {url}` for the STL binary, or `GET {url}?download=1` to force a download.

All parameters are validated against a fixed per-workflow schema (numeric ranges, enum whitelists, boolean coercion) before being passed to the OpenSCAD CLI as `-D` flags via `execFile` — never through a shell — so arbitrary input can't reach the command line. Uploaded SVGs are also normalized server-side so viewBox units reliably map to millimeters inside OpenSCAD, regardless of how the original file declared its size.

## Configuration

See [.env.example](.env.example) for all supported environment variables (port, OpenSCAD binary path, upload size limits, file TTL, compile timeout, CORS origin).
