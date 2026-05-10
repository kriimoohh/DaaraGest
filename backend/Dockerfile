# ── Étape 1 : build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# OpenSSL requis par Prisma sur Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ── Étape 2 : runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

# OpenSSL (Prisma) + Chromium (Puppeteer PDF)
RUN apk add --no-cache \
    openssl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Artefacts de build
COPY --from=builder /app/dist            ./dist
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/prisma          ./prisma
COPY package*.json ./

EXPOSE 3000

# Applique le schéma → seed essentiels → démarre le serveur
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed-prod.cjs && node dist/server.js"]
