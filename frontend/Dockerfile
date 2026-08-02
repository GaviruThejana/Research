# ---------------------------------------------------------------------------
# Stage 1: Build - compiles the React SPA with Vite
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /build

COPY package.json ./
RUN npm install

COPY . .

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Serve - lightweight Nginx image serving the static build
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:80 || exit 1

CMD ["nginx", "-g", "daemon off;"]
