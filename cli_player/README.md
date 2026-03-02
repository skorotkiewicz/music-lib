# cli_player

A minimalist, elegant terminal user interface (TUI) music player written in Rust.

`cli_player` connects to your active `music-lib` server instance, fetches track metadata, and seamlessly streams chunked HLS audio streams (`.ts` segments) natively without shelling out to `ffmpeg`.

## Features

- **Native HLS Streaming:** Streams server HLS TS chunks directly to raw `AAC` payloads using asynchronous demuxing, fed natively into the `rodio` audio backend.
- **Terminal UI:** Clean and responsive split-pane TUI powered by Ratatui.
- **Search & Filter:** Instantly filter your tracklist by title.
- **Playback Controls:** Full keyboard-driven navigation with continuous progress bar display and global volume controls.
- **Audio Seeking:** Instant, synchronized timeline seeking (+/- 5 seconds) bounded smoothly across chunked boundaries. 

## Installation

Ensure you have [Rust](https://rustup.rs/) installed, then run:

```bash
cargo build --release
```

The compiled binary will be placed at `target/release/cli_player`.

## Usage

Simply launch the executable and provide the URL of your `music-lib` API server:

```bash
./cli_player http://localhost:3000
```

*Note: Replace `http://localhost:3000` with the actual address of your music server environment if running remotely.*

## Keybindings

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `Enter` | Select & Play current track |
| `Up` / `k` | Move cursor up in list |
| `Down` / `j` | Move cursor down in list |
| `Left` | Play previous track |
| `Right` | Play next track |
| `/` | Focus search/filter bar |
| `Esc` | Unfocus search bar |
| `+` / `=` | Increase Volume |
| `-` | Decrease Volume |
| `a` | Seek backward 5 seconds |
| `d` | Seek forward 5 seconds |
| `m` | Mute / Unmute |
| `s` | Toggle Shuffle |
| `r` | Toggle Repeat mode (Off / All / One) |
| `t` | Toggle Sleep Timer |
| `q` | Quit |

## License

This interface is part of the broader `music-lib` ecosystem.
