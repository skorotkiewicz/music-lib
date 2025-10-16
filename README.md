# Music Player App

A simple music player built with React, BunJS, and react-howler that allows users to add direct links to audio files and play them.

## Features

- 🎵 Add music tracks by pasting direct links to audio files
- 📱 Modal-based interface for adding tracks
- 🎯 Floating action button for quick track addition
- ▶️ Play, pause, and control volume
- ⏱️ Real-time current time display with progress bar
- 🎯 Clickable progress bar for seeking
- 🔍 Hover tooltip showing exact time position
- 📱 Responsive design with modern UI
- 💾 Persistent storage using JSON file database
- 🗑️ Delete tracks from your library
- ⏭️ Skip between tracks

## Supported Audio Formats

- `.wav`
- `.mp3`
- `.m4a`
- `.ogg`
- `.webm`

## Getting Started

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Start the development server:**
   ```bash
   bun run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## How to Use

1. **Add a Track:**
   - Click the "Add New Track" button or the floating + button (when tracks exist)
   - Paste a direct link to an audio file in the modal
   - Optionally add a custom title
   - Click "Add Track" to save

2. **Play Music:**
   - Click on any track in the list to start playing
   - Use the player controls to play/pause, adjust volume, or skip tracks
   - Click anywhere on the progress bar to seek to that position
   - Hover over the progress bar to see the exact time at that position
   - The currently playing track will be highlighted
   - Current time and total duration are displayed in real-time

3. **Manage Tracks:**
   - Delete tracks using the trash icon
   - All tracks are automatically saved to `music-db.json`

## API Endpoints

- `GET /api/tracks` - Get all tracks
- `POST /api/tracks` - Add a new track
- `DELETE /api/tracks/:id` - Delete a track

## Technical Details

- **Frontend:** React with TypeScript
- **Backend:** BunJS server
- **Audio Player:** react-howler (powered by Howler.js)
- **UI Components:** Radix UI with Tailwind CSS
- **Modal System:** Radix UI Dialog components
- **Database:** JSON file storage

## Development

The app uses hot module reloading for development. Any changes to the React components will automatically refresh the browser.

## Production Build

```bash
bun run build
bun run start
```

## Notes

- Make sure the audio URLs are direct links to audio files (not streaming URLs)
- The app works best with publicly accessible audio files
- CORS may be an issue with some audio sources