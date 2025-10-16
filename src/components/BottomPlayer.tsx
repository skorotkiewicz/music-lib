import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactHowler from "react-howler";
import { Button } from "@/components/ui/button";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt: string;
}

interface BottomPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export function BottomPlayer({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
}: BottomPlayerProps) {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const playerRef = useRef<ReactHowler>(null);

  // Reset current time when track changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    // Try to get duration immediately if player is ready
    if (playerRef.current) {
      const dur = playerRef.current.duration();
      if (typeof dur === "number" && dur > 0) {
        setDuration(dur);
      }
    }
  }, [currentTrack?.id]);

  // Update current time more frequently for smoother progress bar
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
      }, 100); // Update every 100ms for smoother animation
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, currentTrack?.id]);

  const handleLoad = () => {
    if (playerRef.current) {
      const dur = playerRef.current.duration();
      if (typeof dur === "number" && dur > 0) {
        setDuration(dur);
      }
    }
  };

  const handlePlay = () => {
    // Update current time immediately when play starts
    if (playerRef.current) {
      const time = playerRef.current.seek();
      if (typeof time === "number") {
        setCurrentTime(time);
      }
    }
  };

  const handlePause = () => {
    // Update current time when paused
    if (playerRef.current) {
      const time = playerRef.current.seek();
      if (typeof time === "number") {
        setCurrentTime(time);
      }
    }
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (playerRef.current) {
      playerRef.current.seek(newTime);
    }
  };

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <>
      {/* Audio Player */}
      <ReactHowler
        ref={playerRef}
        src={currentTrack.url}
        playing={isPlaying}
        volume={isMuted ? 0 : volume}
        onLoad={handleLoad}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnd={() => {
          setCurrentTime(0);
          if (onNext && hasNext) {
            onNext();
          }
        }}
        html5={true}
      />

      {/* Bottom Player Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 text-white border-t border-gray-700">
        {/* Progress Bar */}
        <div className="relative h-1 bg-gray-600">
          <div
            className="h-full bg-gray-600 cursor-pointer hover:bg-gray-500 transition-colors"
            onClick={handleProgressClick}
            onMouseMove={handleProgressHover}
            onMouseLeave={handleProgressLeave}
          >
            <div
              className={`h-full bg-green-500 transition-all duration-100 ${
                isPlaying ? "animate-pulse" : ""
              }`}
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                minWidth: duration > 0 ? "2px" : "0px",
              }}
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

        {/* Player Controls */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Track Info */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
              <span className="text-xs font-semibold">
                {currentTrack.title.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm truncate">{currentTrack.title}</h3>
              <p className="text-xs text-gray-400 truncate">Music Player</p>
            </div>
          </div>

          {/* Center Controls */}
          <div className="flex items-center space-x-4">
            {/* Current Time */}
            <span className="text-xs text-gray-300 w-12 text-right">{formatTime(currentTime)}</span>

            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="text-white hover:bg-gray-800"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              onClick={onPlayPause}
              className="bg-white text-black hover:bg-gray-200 rounded-full w-8 h-8 p-0"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              disabled={!hasNext}
              className="text-white hover:bg-gray-800"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Total Time */}
            <span className="text-xs text-gray-300 w-12 text-left">{formatTime(duration)}</span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-2 min-w-0 flex-1 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMuteToggle}
              className="text-white hover:bg-gray-800"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <div className="w-20">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
            <span className="text-xs text-gray-400 w-8">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
