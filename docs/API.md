# 🔌 API Reference

Music Library REST API documentation.

---

## Endpoints

### Tracks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tracks` | List all tracks |
| `DELETE` | `/api/tracks/:id` | Delete a track |

### Downloads

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/download` | Start download from URL |
| `GET` | `/api/download/:id` | Check download status |

### HLS Streaming

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/hls/:session/playlist.m3u8` | HLS playlist |
| `GET` | `/api/hls/:session/:segment` | HLS segment |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/mode` | Get server mode (readonly/readwrite) |

---

## Examples

### Download a track

```bash
curl -X POST http://localhost:8080/api/download \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=...", "title": "My Song"}'
```

**Response:**
```json
{
  "download_id": "abc123",
  "status": "pending"
}
```

### Check download status

```bash
curl http://localhost:8080/api/download/abc123
```

**Response:**
```json
{
  "status": "completed",
  "track_id": "xyz789"
}
```

### List all tracks

```bash
curl http://localhost:8080/api/tracks
```

**Response:**
```json
[
  {
    "id": "xyz789",
    "title": "My Song",
    "url": "/api/hls/xyz789/playlist.m3u8",
    "session_id": "xyz789",
    "total_segments": 42,
    "segment_duration": 10.0,
    "listen_count": 5
  }
]
```

### Delete a track

```bash
curl -X DELETE http://localhost:8080/api/tracks/xyz789
```

---

## Server Options

```bash
./music-server [OPTIONS]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--port` | `8080` | Server port |
| `--cache-path` | `./hls_cache` | HLS cache directory |
| `--readonly` | `false` | Disable adding/removing tracks |

### Examples

```bash
# Default (readwrite mode)
./music-server

# Custom port
./music-server --port 9000

# Custom cache directory
./music-server --cache-path /data/music

# Readonly mode
./music-server --readonly

# All options
./music-server --port 9000 --cache-path /data/music --readonly
```

---

## Server Modes

| Mode | Add | Delete | Listen |
|------|-----|--------|--------|
| `readwrite` | ✅ | ✅ | ✅ |
| `readonly` | ❌ | ❌ | ✅ |

Start in readonly mode:
```bash
./music-server --readonly
```