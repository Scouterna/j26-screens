FROM node:24-alpine AS base
ENV CI=true

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build -- --base=/_services/screens/

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY server.js ./server.js
EXPOSE 80
CMD ["node", "server.js"]
