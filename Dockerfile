# syntax=docker/dockerfile:1
#
# Multi-stage image for the static frontend (game + admin).
# Deployed to Cloud Run as "thepinkfront-web" via: npm run deploy:web
#
# Local stack: docker compose builds target "web" and proxies /api to backend.
# GCP: Load Balancer routes /api/* to "thepinkfront-api" (backend/Dockerfile).

# --- Build Phaser game (root) — same as scripts/build-firebase.mjs ---
FROM node:20-alpine AS game-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY Game ./Game
COPY public ./public
COPY assets ./assets
RUN npm run build \
  && cp -r assets/. dist/assets/

# --- Build React admin panel (same env as Firebase hosting build) ---
FROM node:20-alpine AS admin-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_BASE_PATH=/admin/
ENV VITE_API_URL=/api
RUN npm run build

# --- Production web server (nginx + static files) ---
# Last stage on purpose: `gcloud run deploy --source .` builds the final stage
# unless told otherwise. Backend is deployed separately from backend/Dockerfile.
FROM nginx:alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=game-build /app/dist /usr/share/nginx/html
COPY --from=admin-build /app/dist /usr/share/nginx/html/admin
EXPOSE 80
