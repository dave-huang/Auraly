# Revely API server.
#
# Two stages so the runtime image carries production dependencies only. The
# build needs esbuild (a devDependency); the running server does not.

# ---- build ----
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts drizzle.config.ts ./
COPY shared ./shared
COPY server ./server

# Server bundle only — `npm run build` would also build the legacy web client
# in client/, which this image does not serve. See serveStatic() in
# server/static.ts, which runs the API without a web bundle present.
RUN npm run build:server

# ---- runtime ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# The substance registry, evidence records and knowledge base are read from
# disk at boot via process.cwd() — see server/services/substances/identity.ts.
# Without this the server starts and then rates every ingredient off the model
# alone, silently losing the sourced layer.
COPY server/data ./server/data

# Fly injects PORT; 8080 is the default the fly.toml expects.
ENV PORT=8080
EXPOSE 8080

# The analyzer writes its disk cache to the working directory. Everything above
# was copied as root, so without this the process runs as `node` and cannot
# write — the failure is caught and logged, so it would not crash, it would
# just quietly log an error after every single scan forever.
RUN chown -R node:node /app
USER node

# dotenv is loaded explicitly rather than by import order — see the note in
# server/index.ts. In this image the environment is set by the platform and
# there is no .env file, so dotenv finds nothing and that is correct.
CMD ["node", "--import", "dotenv/config", "dist/index.js"]
