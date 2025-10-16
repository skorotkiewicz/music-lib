# Music Player App

A simple music player built with React, BunJS, and react-howler that allows users to add direct links to audio files and play them.

## Features

- 🎵 Add music tracks by pasting direct links to audio files
- ▶️ Play, pause, and control volume
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
   - Paste a direct link to an audio file in the "Audio URL" field
   - Optionally add a custom title
   - Click "Add Track"

2. **Play Music:**
   - Click on any track in the list to start playing
   - Use the player controls to play/pause, adjust volume, or skip tracks
   - The currently playing track will be highlighted

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