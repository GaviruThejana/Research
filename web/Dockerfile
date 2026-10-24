# ---------------------------------------------------------------------------
# Stage 1: Build the React SPA with Vite
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Empty = call /api on the same origin; nginx (below) proxies it to the Node API.
ARG VITE_NODE_API_URL=""
ENV VITE_NODE_API_URL=${VITE_NODE_API_URL}

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Serve the static build with nginx
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
