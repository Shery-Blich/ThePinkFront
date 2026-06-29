# syntax=docker/dockerfile:1

############################################
# 1) Build Phaser game
############################################
FROM node:20-alpine AS game-build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY index.html vite.config.js ./
COPY Game ./Game
COPY assets ./assets

RUN npm run build


############################################
# 2) Build Vue admin panel
############################################
FROM node:20-alpine AS admin-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend/ ./

ENV VITE_BASE_PATH=/admin/
ENV VITE_API_URL=/api

RUN npm run build


############################################
# 3) Web server (Nginx)
############################################
FROM nginx:alpine AS web

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=game-build /app/dist /usr/share/nginx/html
COPY --from=game-build /app/assets /usr/share/nginx/html/assets
COPY --from=admin-build /app/dist /usr/share/nginx/html/admin

EXPOSE 80


############################################
# 4) Backend API (Express + Mongoose)
############################################
FROM node:20-alpine AS backend
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev

COPY backend/src ./src

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "src/server.js"]
