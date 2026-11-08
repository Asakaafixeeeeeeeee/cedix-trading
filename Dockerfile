# CediX production image — works on Railway, Fly.io, any Docker host.
# (Render can use this too, but the included render.yaml uses the native Node runtime.)
FROM node:22-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Dummy URL for build-time Prisma config loading; the real DATABASE_URL
# must be provided at runtime and overrides this.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Apply pending migrations, then start
CMD ["sh", "-c", "npx prisma migrate deploy && npx next start -p ${PORT:-3000}"]
