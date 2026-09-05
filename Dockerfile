# syntax=docker/dockerfile:1

##
## ---- Stage: shared dependency install (full, for building) ----
##
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

##
## ---- Stage: production-only server dependencies ----
##
FROM node:20-bookworm-slim AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci --omit=dev --workspace=server

##
## ---- Stage: build the Vite frontend into static assets ----
##
FROM deps AS client-builder
WORKDIR /app
COPY client client
RUN npm run build --workspace=client

##
## ---- Stage: compile the Express/TypeScript backend ----
##
FROM deps AS server-builder
WORKDIR /app
COPY server server
RUN npm run build --workspace=server

##
## ---- Stage: backend dev server (hot reload via tsx, OpenSCAD/xvfb included) ----
## Used by docker-compose's dual-service dev setup. Source is bind-mounted
## over this image at runtime so edits take effect without a rebuild.
##
FROM node:20-bookworm-slim AS dev
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends openscad xvfb xauth \
    && rm -rf /var/lib/apt/lists/* \
    && mv /usr/bin/openscad /usr/bin/openscad.real
COPY docker/openscad-xvfb.sh /usr/bin/openscad
RUN chmod +x /usr/bin/openscad
ENV OPENSCAD_BIN=openscad
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY server server
EXPOSE 3000
CMD ["npm", "run", "dev", "--workspace=server"]

##
## ---- Stage: frontend dev server (Vite, hot module reload) ----
##
FROM deps AS client-dev
WORKDIR /app
COPY client client
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace=client", "--", "--host"]

##
## ---- Stage: runtime image ----
## OpenSCAD's CLI renderer expects an X display even when run headlessly,
## so xvfb is installed and the real `openscad` binary is wrapped by a
## script that proxies every invocation through xvfb-run.
##
FROM node:20-bookworm-slim AS runtime
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends openscad xvfb xauth \
    && rm -rf /var/lib/apt/lists/* \
    && mv /usr/bin/openscad /usr/bin/openscad.real

COPY docker/openscad-xvfb.sh /usr/bin/openscad
RUN chmod +x /usr/bin/openscad

ENV NODE_ENV=production \
    PORT=3000 \
    OPENSCAD_BIN=openscad

WORKDIR /app/server

COPY --from=deps-prod /app/node_modules /app/node_modules
COPY --from=server-builder /app/server/dist ./dist
COPY server/package.json ./package.json
COPY server/templates ./templates
COPY --from=client-builder /app/client/dist ../client/dist

RUN mkdir -p uploads output temp \
    && chown -R node:node /app/server

USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
