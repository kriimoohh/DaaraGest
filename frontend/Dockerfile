# ── Étape 1 : build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Étape 2 : runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# Copier seulement ce qui est nécessaire au runtime
COPY --from=builder /app/dist ./dist
COPY server.cjs ./
COPY package*.json ./
RUN npm ci --omit=dev

ENV NODE_ENV=production

# PORT est injecté dynamiquement par Railway — pas de EXPOSE fixe
CMD ["node", "server.cjs"]
