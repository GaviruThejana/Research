# Node API: auth, predictions (proxied to FastAPI), doctors, consultations
# (PDF + email), feedback loop. The only backend the apps talk to.
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only, exactly as locked.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts

# Uploaded lesion images and saved emails live in volumes (docker-compose.yml);
# create the mount points owned by the unprivileged "node" user.
RUN mkdir -p uploads outbox && chown -R node:node /app
USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:5000/health || exit 1

# server.js handles SIGTERM (graceful shutdown), so node can run as PID 1.
CMD ["node", "src/server.js"]
