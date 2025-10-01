# Multi-stage build for HamFlow
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files and configs needed for panda codegen
COPY package.json ./
COPY bun.lockb* ./
COPY panda.config.ts ./
COPY tsconfig.json ./


# Set production environment for build
ENV NODE_ENV=production

# Install all dependencies (including dev dependencies for build)
# This will run panda codegen as a prepare script
RUN bun install

# Copy remaining source files
COPY . .

# Build frontend and backend
RUN bun run build

# Production stage
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files and configs
COPY package.json ./
COPY bun.lockb* ./
COPY panda.config.ts ./
COPY tsconfig.json ./

# Install production dependencies only
RUN bun install --production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/styled-system ./styled-system

# Copy source and config files
COPY drizzle ./drizzle
COPY src ./src
COPY panda.config.ts ./
COPY tsconfig.json ./
COPY vite.config.ts ./

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose application port
EXPOSE 3000

# Run the application
CMD ["bun", "run", "src/server/index.ts"]
