import { Loader2, Music, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayer } from "../contexts/PlayerContext";
import { FloatingAddButton } from "./FloatingAddButton";

const API_BASE = "http://localhost:8080";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt?: string;
}

interface ApiTrack {
  id: string;
  title: string;
  url: string;
  session_id: string;
  total_segments: number;
  segment_duration: number;
}

interface TrackListProps {
  refreshTrigger: number;
  onTrackAdded: () => void;
  searchQuery?: string;
}

export function TrackList({ refreshTrigger, onTrackAdded, searchQuery = "" }: TrackListProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReadonly, setIsReadonly] = useState(false);
  const { currentTrack, playTrack, setTracks: setGlobalTracks } = usePlayer();

  const filteredTracks = tracks.filter((track) =>
    track.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Fetch mode from server
  const fetchMode = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mode`);
      if (response.ok) {
        const data = await response.json();
        setIsReadonly(data.readonly);
      }
    } catch {
      // Default to readwrite if mode endpoint fails
      setIsReadonly(false);
    }
  }, []);

  const fetchTracks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Fetch from Rust server's HLS cache
      const response = await fetch(`${API_BASE}/api/tracks`);

      if (!response.ok) {
        throw new Error("Failed to fetch tracks");
      }

      const data: ApiTrack[] = await response.json();

      // Transform API tracks to Track format with full URLs
      const transformedTracks: Track[] = data.map((apiTrack) => ({
        id: apiTrack.id,
        title: apiTrack.title,
        url: `${API_BASE}${apiTrack.url}`,
        addedAt: new Date().toISOString(),
      }));

      setTracks(transformedTracks);
      setGlobalTracks(transformedTracks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [setGlobalTracks]);

  useEffect(() => {
    fetchMode();
    fetchTracks();
  }, [fetchMode, fetchTracks, refreshTrigger]);

  const handleDeleteTrack = async (trackId: string) => {
    if (isReadonly) return;

    if (!confirm("Are you sure you want to delete this track?")) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/tracks/${trackId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete track");
      }

      // Remove track from local state
      const updatedTracks = tracks.filter((track) => track.id !== trackId);
      setTracks(updatedTracks);
      setGlobalTracks(updatedTracks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete track");
    }
  };

  const handleTrackAdded = () => {
    // Refresh the track list from the server
    fetchTracks();
    onTrackAdded();
  };

  const handlePlayTrack = (track: Track) => {
    playTrack(track);
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading tracks...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={fetchTracks}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Track List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Your Music Library ({filteredTracks.length} tracks)
            {isReadonly && (
              <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">RO</span>
            )}
          </CardTitle>
          <CardDescription>Click on any track to start playing (HLS streaming)</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTracks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tracks found. {!isReadonly && "Add your first track!"}</p>
              {!isReadonly && tracks.length === 0 && (
                <div className="mt-4">
                  <FloatingAddButton onTrackAdded={handleTrackAdded} />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    currentTrack?.id === track.id
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handlePlayTrack(track)}
                      className="text-left w-full"
                    >
                      <h3 className="font-medium truncate">{track.title}</h3>
                      <p className="text-xs text-gray-400">HLS Stream</p>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {currentTrack?.id === track.id && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    )}
                    {!isReadonly && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTrack(track.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Action Button - only show in readwrite mode */}
      {!isReadonly && tracks.length > 0 && (
        <div className="fixed bottom-20 right-6 z-40">
          <FloatingAddButton onTrackAdded={handleTrackAdded} />
        </div>
      )}
    </div>
  );
}
