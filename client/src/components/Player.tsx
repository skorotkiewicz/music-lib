import Hls from "hls.js";
import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt?: string;
}

interface PlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onAutoNext?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  repeatMode: "none" | "all" | "one";
  onToggleRepeat: () => void;
}

export function Player({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onAutoNext,
  hasNext,
  hasPrevious,
  volume,
  onVolumeChange,
  isMuted,
  onMuteToggle,
  repeatMode,
  onToggleRepeat,
}: PlayerProps) {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Refs for HLS audio
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Reset current time when track changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
  }, [currentTrack?.id]);

  // HLS Setup
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const audio = audioRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;

      hls.loadSource(currentTrack.url);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isPlaying) {
          audio.play().catch((err) => {
            console.error("HLS play error:", err);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("HLS error:", data);
      });
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS support (Safari)
      audio.src = currentTrack.url;
      if (isPlaying) {
        audio.play().catch((err) => {
          console.error("Native HLS play error:", err);
        });
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentTrack?.url]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    if (isPlaying) {
      audio.play().catch((err) => {
        console.error("HLS play error:", err);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Handle volume
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Update time for audio
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !Number.isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [currentTrack?.url]);

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
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

  const handleEnded = () => {
    setCurrentTime(0);
    if (repeatMode === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
      return;
    }

    if (onAutoNext) {
      onAutoNext();
    } else if (onNext && hasNext) {
      onNext();
    }
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <>
      {/* Audio element for HLS streams */}
      {/* biome-ignore lint/a11y/useMediaCaption: Audio-only HLS stream */}
      <audio ref={audioRef} style={{ display: "none" }} onEnded={handleEnded} />

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
              <p className="text-xs text-gray-400 truncate">HLS Stream</p>
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
              className="text-white hover:bg-gray-800 hover:text-white"
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
              className="text-white hover:bg-gray-800 hover:text-white"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleRepeat}
              className={`hover:bg-gray-800 ${
                repeatMode !== "none"
                  ? "text-green-500 hover:text-green-400"
                  : "text-gray-400 hover:text-white"
              }`}
              title={`Repeat: ${repeatMode}`}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-4 w-4 text-green-500" />
              ) : (
                <Repeat className={`h-4 w-4 ${repeatMode === "all" ? "text-green-500" : ""}`} />
              )}
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
              className="text-white hover:bg-gray-800 hover:text-white"
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
