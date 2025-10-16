import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<ReactHowler>(null);

  // Reset current time when track changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [track.id]);

  // Update current time every second when playing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isPlaying && playerRef.current) {
      interval = setInterval(() => {
        if (playerRef.current) {
          const time = playerRef.current.seek();
          if (typeof time === "number") {
            setCurrentTime(time);
          }
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying]);

  const handlePlay = () => {
    setIsPlaying(true);
    setError(null);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnd = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (onNext && hasNext) {
      onNext();
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
    if (playerRef.current) {
      const dur = playerRef.current.duration();
      if (typeof dur === "number") {
        setDuration(dur);
      }
    }
  };

  const handleLoadError = () => {
    setIsLoading(false);
    setError("Failed to load audio file");
    setIsPlaying(false);
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (playerRef.current) {
      playerRef.current.seek(newTime);
    }
  };

  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    handleSeek(newTime);
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const percentage = hoverX / rect.width;
    const time = percentage * duration;

    setHoverTime(time);
  };

  const handleProgressLeave = () => {
    setHoverTime(null);
  };

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
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="relative">
              <div
                className="w-full bg-gray-200 rounded-full h-2 cursor-pointer hover:h-3 transition-all duration-200"
                onClick={handleProgressClick}
                onMouseMove={handleProgressHover}
                onMouseLeave={handleProgressLeave}
              >
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 hover:h-3"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              {hoverTime !== null && (
                <div
                  className="absolute top-0 transform -translate-y-full -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none"
                  style={{
                    left: `${duration > 0 ? (hoverTime / duration) * 100 : 0}%`,
                  }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
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
