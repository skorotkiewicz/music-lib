# Build Rust server
FROM rust:alpine AS rust
RUN apk add --no-cache musl-dev
WORKDIR /build
COPY server/ .
RUN cargo build --release

# Build frontend
FROM oven/bun:alpine AS bun
WORKDIR /build
COPY client/ .
RUN bun install --frozen-lockfile
RUN bun run build

# Runtime
FROM alpine:3.19
RUN apk add --no-cache ffmpeg nginx ca-certificates curl python3
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp
WORKDIR /app

COPY --from=rust /build/target/release/music-server .
COPY --from=bun /build/dist /usr/share/nginx/html

# Create storage directory
RUN mkdir -p /app/hls_cache

# Create nginx config
RUN printf '%s\n' \
    'server {' \
    '    listen 8080;' \
    '    root /usr/share/nginx/html;' \
    '    index index.html;' \
    '    ' \
    '    proxy_connect_timeout 1d;' \
    '    proxy_send_timeout 1d;' \
    '    proxy_read_timeout 1d;' \
    '    send_timeout 1d;' \
    '    ' \
    '    location / {' \
    '        try_files $uri $uri/ /index.html;' \
    '    }' \
    '    location /api/ {' \
    '        proxy_pass http://127.0.0.1:3000;' \
    '    }' \
    '}' > /etc/nginx/http.d/default.conf

# Default: readwrite mode
ENV READONLY=false

# Create start script
RUN printf '%s\n' \
    '#!/bin/sh' \
    'echo "🎵 Starting Music Library..."' \
    'echo "📦 Updating yt-dlp..."' \
    'yt-dlp -U || true' \
    'if [ "$READONLY" = "true" ]; then' \
    '    ./music-server --port 3000 --cache-path /app/hls_cache --readonly &' \
    'else' \
    '    ./music-server --port 3000 --cache-path /app/hls_cache &' \
    'fi' \
    'echo "✓ API server started"' \
    'echo "✓ Starting nginx"' \
    'nginx -g "daemon off;"' > /app/start.sh && chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
