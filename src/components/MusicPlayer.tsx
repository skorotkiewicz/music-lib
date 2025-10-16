import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useRef, useState } from "react";
import ReactHowler from "react-howler";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt: string;
}

interface MusicPlayerProps {
  track: Track;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function MusicPlayer({ track, onNext, onPrevious, hasNext, hasPrevious }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [duration] = useState(0);
  const [seek, setSeek] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<ReactHowler>(null);

  const handlePlay = () => {
    setIsPlaying(true);
    setError(null);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnd = () => {
    setIsPlaying(false);
    setSeek(0);
    if (onNext && hasNext) {
      onNext();
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setError("Failed to load audio file");
    setIsPlaying(false);
  };

  // const handleSeek = (newSeek: number) => {
  //   setSeek(newSeek);
  //   if (playerRef.current) {
  //     playerRef.current.seek(newSeek);
  //   }
  // };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-lg">{track.title}</CardTitle>
        <CardDescription>Added: {new Date(track.addedAt).toLocaleDateString()}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio Player */}
        <ReactHowler
          ref={playerRef}
          src={track.url}
          playing={isPlaying}
          volume={isMuted ? 0 : volume}
          onLoad={handleLoad}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnd={handleEnd}
          onLoadError={handleLoadError}
          onSeek={() => {}}
          html5={true}
        />

        {/* Error Message */}
        {error && (
          <div className="text-red-500 text-sm text-center p-2 bg-red-50 rounded">{error}</div>
        )}

        {/* Loading State */}
        {isLoading && <div className="text-center text-sm text-gray-500">Loading audio...</div>}

        {/* Progress Bar */}
        {!isLoading && !error && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatTime(seek)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${duration > 0 ? (seek / duration) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center space-x-4">
          <Button variant="outline" size="sm" onClick={onPrevious} disabled={!hasPrevious}>
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={isLoading || !!error}
            className="px-6"
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          <Button variant="outline" size="sm" onClick={onNext} disabled={!hasNext}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={toggleMute}>
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 w-8">
            {Math.round((isMuted ? 0 : volume) * 100)}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
