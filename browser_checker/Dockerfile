# The official Playwright image ships Chromium, every system library it needs
# and Xvfb — so the browser can run *headed* on a virtual X display and
# look like an ordinary desktop Chrome to the sites it visits.
# The tag must match the playwright version in package.json.

# ---------- 1) build stage ----------
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

# ---------- 2) runtime stage ----------
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY entrypoint.sh ./entrypoint.sh

# Run as the image's unprivileged user (Chromium refuses to run as root without --no-sandbox).
RUN chown -R pwuser:pwuser /app && chmod +x /app/entrypoint.sh
USER pwuser

# Headed Chromium on a 1366x768 virtual X display (see entrypoint.sh).
# Chromium needs a large /dev/shm: run with --shm-size=1g, and --init so
# crashed browser subprocesses get reaped.
ENV DISPLAY=:99 XVFB_SCREEN=1366x768x24
ENTRYPOINT ["/app/entrypoint.sh"]
