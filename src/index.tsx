import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { serve } from "bun";
import index from "./index.html";

// Database file path
const DB_PATH = join(process.cwd(), "music-db.json");

// Initialize database if it doesn't exist
if (!existsSync(DB_PATH)) {
  writeFileSync(DB_PATH, JSON.stringify({ tracks: [] }, null, 2));
}

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt: string;
}

interface Database {
  tracks: Track[];
}

// Helper functions for database operations
function readDatabase(): Database {
  try {
    const data = readFileSync(DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading database:", error);
    return { tracks: [] };
  }
}

function writeDatabase(data: Database): boolean {
  try {
    writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error writing database:", error);
    return false;
  }
}

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    // API endpoints for music tracks
    "/api/tracks": {
      async GET() {
        const db = readDatabase();
        return Response.json(db.tracks);
      },
      async POST(req) {
        try {
          const body = await req.json();
          const { url, title } = body;

          if (!url) {
            return Response.json({ error: "URL is required" }, { status: 400 });
          }

          // Validate URL format
          try {
            new URL(url);
          } catch {
            return Response.json({ error: "Invalid URL format" }, { status: 400 });
          }

          const db = readDatabase();
          const newTrack = {
            id: Date.now().toString(),
            url,
            title: title || `Track ${db.tracks.length + 1}`,
            addedAt: new Date().toISOString(),
          };

          db.tracks.push(newTrack);

          if (writeDatabase(db)) {
            return Response.json(newTrack, { status: 201 });
          } else {
            return Response.json({ error: "Failed to save track" }, { status: 500 });
          }
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }
      },
    },

    "/api/tracks/:id": {
      async DELETE(req) {
        const id = req.params.id;
        const db = readDatabase();
        const trackIndex = db.tracks.findIndex((track: Track) => track.id === id);

        if (trackIndex === -1) {
          return Response.json({ error: "Track not found" }, { status: 404 });
        }

        db.tracks.splice(trackIndex, 1);

        if (writeDatabase(db)) {
          return Response.json({ message: "Track deleted successfully" });
        } else {
          return Response.json({ error: "Failed to delete track" }, { status: 500 });
        }
      },
    },

    "/api/hello": {
      async GET() {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT() {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async () => {
      return Response.json({
        message: "Hello, world!",
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
