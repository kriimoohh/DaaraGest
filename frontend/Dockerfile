# ── Étape 1 : build Vite ─────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Railway passe les variables d'env comme ARG lors du build Docker
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Étape 2 : nginx (image ultra-légère) ─────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
