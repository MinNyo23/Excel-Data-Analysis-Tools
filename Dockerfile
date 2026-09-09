# syntax=docker/dockerfile:1
# ---------- Build stage ----------
FROM node:24-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite inlines import.meta.env at build time (see vite.config.ts define).
# Docker image: local OTP auth + same-origin /api. Pass flags only on this RUN
# line so BuildKit does not flag ARG/ENV names containing AUTH/KEY.
RUN VITE_USE_SUPABASE_AUTH=false \
	VITE_USE_EXTERNAL_PROCESSING_API=false \
	pnpm run build

RUN pnpm prune --prod

# ---------- Runtime stage ----------
FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=1029

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 1029

CMD ["node", "dist/index.js"]
