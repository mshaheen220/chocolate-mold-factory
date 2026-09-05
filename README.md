# Chocolate Mold Factory

A visual UI to configure, preview, and generate 3D-printable silicone mold boxes and chocolate medallions, compiled on demand by the [OpenSCAD](https://openscad.org/) CLI.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS, with a `@react-three/fiber` viewport for orbiting/panning generated STL models.
- **Backend:** Node.js + Express + TypeScript, shelling out to the OpenSCAD CLI to compile parametric `.scad` templates into `.stl` files.
- **Containerized:** Docker multi-stage build; OpenSCAD runs headlessly under `xvfb`.

## Workflows

1. **2D Graphic → Chocolate Tokens (Medallions)** — upload an SVG graphic and generate a single relief token, a grid of tokens, or a reusable silicone pour-mold box sized around the grid.
2. **Reusable Silicone Mold Box (Parametric Frame)** — a generic tapered cavity box for arbitrary silicone pours, with an optional center registration guide.

## Project layout

```
.
├── client/            React + Vite + TypeScript frontend
├── server/            Express + TypeScript backend
│   ├── src/           Application source
│   ├── templates/     Parametric OpenSCAD templates (medallion.scad, mold_box.scad)
│   ├── uploads/        Ephemeral SVG/STL uploads (cleaned automatically)
│   ├── output/         Generated STL files (persisted via Docker volume)
│   └── temp/           Scratch space for in-flight compiles
├── docker/            Container support scripts (xvfb wrapper)
├── Dockerfile         Multi-stage build (deps → client/server build → runtime)
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
- `POST /api/generate` — multipart form: `workflow` (`medallion` | `mold_box`), the workflow's parameters, and an optional `file` (SVG for the medallion workflow). Returns `{ fileName, url }`; fetch `GET {url}` for the STL binary, or `GET {url}?download=1` to force a download.

All parameters are validated against a fixed per-workflow schema (numeric ranges, enum whitelists, boolean coercion) before being passed to the OpenSCAD CLI as `-D` flags via `execFile` — never through a shell — so arbitrary input can't reach the command line.

## Configuration

See [.env.example](.env.example) for all supported environment variables (port, OpenSCAD binary path, upload size limits, file TTL, CORS origin).
