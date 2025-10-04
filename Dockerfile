# Build stage
FROM oven/bun:alpine AS builder

WORKDIR /app

# Set production environment for build
ENV NODE_ENV=production

# Copy everything at once
COPY . .

# Install and build both frontend and server
RUN bun install --frozen-lockfile && \
    bun run build:ssr && \
    bun run build:server

# Production stage
FROM oven/bun:alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --frozen-lockfile --production --ignore-scripts

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build

# Copy only essential runtime files
COPY drizzle ./drizzle

# Expose application port
EXPOSE 3000

# Run the bundled server
CMD ["bun", "run", "start:server"]
