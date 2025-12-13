import Hls from "hls.js";
import {
  Moon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt?: string;
}

// Sleep timer options in minutes (0 = off)
const SLEEP_OPTIONS = [0, 15, 30, 60, 120] as const;
type SleepDuration = (typeof SLEEP_OPTIONS)[number];

const SLEEP_LABELS: Record<SleepDuration, string> = {
  0: "Off",
  15: "15m",
  30: "30m",
  60: "1h",
  120: "2h",
};

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
  shuffleMode: boolean;
  onToggleShuffle: () => void;
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
  shuffleMode,
  onToggleShuffle,
}: PlayerProps) {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  // Sleep timer state
  const [sleepDuration, setSleepDuration] = useState<SleepDuration>(0);
  const [sleepRemaining, setSleepRemaining] = useState<number>(0); // in seconds
  const [isFadingOut, setIsFadingOut] = useState(false);
  const originalVolumeRef = useRef<number>(volume);

  // Refs for HLS audio
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Toggle sleep timer - cycles through options
  const toggleSleepTimer = useCallback(() => {
    const currentIndex = SLEEP_OPTIONS.indexOf(sleepDuration);
    const nextIndex = (currentIndex + 1) % SLEEP_OPTIONS.length;
    const nextDuration = SLEEP_OPTIONS[nextIndex];

    setSleepDuration(nextDuration);
    setSleepRemaining(nextDuration * 60); // Convert to seconds
    setIsFadingOut(false);

    // Store current volume when setting a timer
    if (nextDuration > 0) {
      originalVolumeRef.current = volume;
    }
  }, [sleepDuration, volume]);

  // Sleep timer countdown effect
  useEffect(() => {
    if (sleepRemaining <= 0 || !isPlaying) return;

    const interval = setInterval(() => {
      setSleepRemaining((prev) => {
        if (prev <= 1) {
          // Timer ended - stop playback
          onPlayPause();
          setSleepDuration(0);
          setIsFadingOut(false);
          // Restore original volume
          onVolumeChange(originalVolumeRef.current);
          return 0;
        }

        // Start fade out in the last 30 seconds
        if (prev <= 30 && !isFadingOut) {
          setIsFadingOut(true);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepRemaining, isPlaying, onPlayPause, isFadingOut, onVolumeChange]);

  // Volume fade out effect
  useEffect(() => {
    if (!isFadingOut || sleepRemaining <= 0) return;

    // Gradually reduce volume over the last 30 seconds
    const fadeProgress = sleepRemaining / 30; // 1.0 -> 0.0
    const fadedVolume = originalVolumeRef.current * fadeProgress;
    onVolumeChange(Math.max(0, fadedVolume));
  }, [isFadingOut, sleepRemaining, onVolumeChange]);

  // Format sleep remaining time
  const formatSleepRemaining = (seconds: number): string => {
    if (seconds <= 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.code) {
        case "Space":
          e.preventDefault();
          onPlayPause();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (onPrevious && hasPrevious) onPrevious();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (onNext && hasNext) onNext();
          break;
        case "KeyM":
          e.preventDefault();
          onMuteToggle();
          break;
        case "KeyS":
          e.preventDefault();
          onToggleShuffle();
          break;
        case "KeyR":
          e.preventDefault();
          onToggleRepeat();
          break;
        case "KeyT":
          e.preventDefault();
          toggleSleepTimer();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onPlayPause,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious,
    onMuteToggle,
    onToggleShuffle,
    onToggleRepeat,
    toggleSleepTimer,
  ]);

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

  // Handle volume (but not when fading - that's handled separately)
  useEffect(() => {
    if (!audioRef.current || isFadingOut) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, isFadingOut]);

  // Apply faded volume to audio element
  useEffect(() => {
    if (!audioRef.current || !isFadingOut) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, isFadingOut]);

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
          <div className="flex items-center min-w-0 flex-1 h-12">
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <h3 className="font-medium text-sm truncate">{currentTrack.title}</h3>
              {sleepRemaining > 0 && (
                <div className="flex items-center gap-1 text-xs text-purple-400">
                  <Moon className="h-3 w-3" />
                  {formatSleepRemaining(sleepRemaining)}
                </div>
              )}
            </div>
          </div>

          {/* Center Controls */}
          <div className="flex items-center space-x-4">
            {/* Current Time */}
            <span className="text-xs text-gray-300 w-12 text-right">{formatTime(currentTime)}</span>

            {/* Shuffle Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleShuffle}
              className={`hover:bg-gray-800 ${
                shuffleMode
                  ? "text-green-500 hover:text-green-400"
                  : "text-gray-400 hover:text-white"
              }`}
              title={`Shuffle: ${shuffleMode ? "On" : "Off"} (S)`}
            >
              <Shuffle className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              disabled={!hasPrevious && !shuffleMode}
              className="text-white hover:bg-gray-800 hover:text-white"
              title="Previous (←)"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              onClick={onPlayPause}
              className="bg-white text-black hover:bg-gray-200 rounded-full w-8 h-8 p-0"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              disabled={!hasNext && !shuffleMode}
              className="text-white hover:bg-gray-800 hover:text-white"
              title="Next (→)"
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
              title={`Repeat: ${repeatMode} (R)`}
            >
              {repeatMode === "one" ? (
                <Repeat1 className="h-4 w-4 text-green-500" />
              ) : (
                <Repeat className={`h-4 w-4 ${repeatMode === "all" ? "text-green-500" : ""}`} />
              )}
            </Button>

            {/* Sleep Timer Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSleepTimer}
              className={`hover:bg-gray-800 ${
                sleepDuration > 0
                  ? "text-purple-400 hover:text-purple-300"
                  : "text-gray-400 hover:text-white"
              }`}
              title={`Sleep Timer: ${SLEEP_LABELS[sleepDuration]} (T)`}
            >
              <Moon className="h-4 w-4" />
              {sleepDuration > 0 && (
                <span className="ml-1 text-xs">{SLEEP_LABELS[sleepDuration]}</span>
              )}
            </Button>

            {/* Total Time */}
            <span className="text-xs text-gray-300 w-12 text-left">{formatTime(duration)}</span>
          </div>

          {/* Volume Control */}
          <div className="relative flex items-center justify-end">
            {/* Floating Volume Slider */}
            {showVolumeSlider && (
              <>
                {/* Backdrop to close */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowVolumeSlider(false)}
                />
                {/* Slider popup */}
                <div className="absolute bottom-full right-0 mb-2 p-3 bg-gray-800 rounded-lg shadow-lg z-50 flex flex-col items-center gap-2">
                  <span className="text-xs text-gray-300">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="h-24 w-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    style={{
                      writingMode: "vertical-lr",
                      direction: "rtl",
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMuteToggle}
                    className="text-white hover:bg-gray-700 hover:text-white p-1"
                  >
                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            )}
            {/* Volume Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVolumeSlider(!showVolumeSlider)}
              className="text-white hover:bg-gray-800 hover:text-white"
              title="Volume (M to mute)"
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : volume > 0.5 ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <Volume1 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
