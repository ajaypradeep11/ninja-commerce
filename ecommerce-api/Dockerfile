# Build stage — needs devDependencies (nest CLI, prisma CLI, tsc)
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage — dist + full node_modules (kept unpruned so the generated
# Prisma client in node_modules/.prisma survives; prisma CLI also stays
# available for `npx prisma migrate deploy` if run inside the container)
FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
# Cloud Run injects PORT (default 8080); main.ts reads it via ConfigService
CMD ["node", "dist/src/main"]
