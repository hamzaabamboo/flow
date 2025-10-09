# Build stage
FROM oven/bun:alpine AS builder

WORKDIR /app

# Set production environment for build
ENV NODE_ENV=production

# Copy everything at once
COPY . .

# Install and build both frontend and server
RUN bun install --frozen-lockfile
RUN bun run build:ssr
RUN bun build src/server/index.ts --outfile=./build/server --compile --minify-whitespace --target=bun && \
    chmod +x ./build/server

# Production stage
FROM oven/bun:alpine

WORKDIR /app

# Copy compiled server binary
COPY --from=builder /app/build/server server

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy only essential runtime files
COPY --from=builder /app/drizzle ./drizzle

# Set production environment
ENV NODE_ENV=production

# Run the compiled server
CMD ["./server"]

# Expose application port
EXPOSE 3000
