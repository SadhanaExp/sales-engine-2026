# Sales Engine as one Next.js image. Ready to Contract is native to this app.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
