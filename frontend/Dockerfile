# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

ARG NEXT_PUBLIC_API_URL=http://backend:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# Stage 2: Run
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

# public folder (if it exists)
COPY --from=builder /app/public ./public

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["npm", "start"]
