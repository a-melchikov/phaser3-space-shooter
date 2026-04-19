FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl wget
RUN mkdir -p /app && chown node:node /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
