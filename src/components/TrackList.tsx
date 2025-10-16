import { Loader2, Music, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayer } from "../contexts/PlayerContext";
import { AddTrackModal } from "./AddTrackModal";
import { FloatingAddButton } from "./FloatingAddButton";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt: string;
}

interface TrackListProps {
  refreshTrigger: number;
  onTrackAdded: () => void;
}

export function TrackList({ refreshTrigger, onTrackAdded }: TrackListProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentTrack, playTrack, setTracks: setGlobalTracks } = usePlayer();

  const fetchTracks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/tracks");

      if (!response.ok) {
        throw new Error("Failed to fetch tracks");
      }

      const data = await response.json();
      setTracks(data);
      setGlobalTracks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks, refreshTrigger]);

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm("Are you sure you want to delete this track?")) {
      return;
    }

    try {
      const response = await fetch(`/api/tracks/${trackId}`, {
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

  const handleTrackAdded = (newTrack: Track) => {
    const updatedTracks = [newTrack, ...tracks];
    setTracks(updatedTracks);
    setGlobalTracks(updatedTracks);
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
            Your Music Library ({tracks.length} tracks)
          </CardTitle>
          <CardDescription>Click on any track to start playing</CardDescription>
        </CardHeader>
        <CardContent>
          {tracks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tracks yet. Add your first track!</p>
              <div className="mt-4">
                <AddTrackModal onTrackAdded={handleTrackAdded} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {tracks.map((track) => (
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
                      {/* <p className="text-sm text-gray-500 truncate">{track.url}</p> */}
                      <p className="text-xs text-gray-400">
                        Added: {new Date(track.addedAt).toLocaleDateString()}
                      </p>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {currentTrack?.id === track.id && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTrack(track.id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Action Button */}
      {tracks.length > 0 && (
        <div className="fixed bottom-20 right-6 z-40">
          <FloatingAddButton onTrackAdded={handleTrackAdded} />
        </div>
      )}
    </div>
  );
}
