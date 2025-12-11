import { createContext, type ReactNode, useContext, useState } from "react";

export type RepeatMode = "none" | "all" | "one";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt?: string;
}

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  tracks: Track[];
  currentTrackIndex: number | null;
  repeatMode: RepeatMode;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setTracks: (tracks: Track[]) => void;
  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  toggleMute: () => void;
  toggleRepeatMode: () => void;
  playNext: () => void;
  playNextAuto: () => void;
  playPrevious: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");

  const playTrack = (track: Track) => {
    const index = tracks.findIndex((t) => t.id === track.id);
    setCurrentTrack(track);
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  };

  const playNext = () => {
    if (currentTrackIndex !== null) {
      // If repeat all is on, we wrap around
      // If repeat one is on, manual next should still go to next track?
      // Usually yes. Repeat One only applies to auto-progression.

      let nextIndex = currentTrackIndex + 1;

      // Wrap around if we are at the end and repeat mode is ALL
      // Standard UX: Next button at end of playlist -> Stop or Wrap?
      // If repeat ALL -> Wrap.
      // If repeat NONE -> Stop (disable button usually) or do nothing.
      if (repeatMode === "all" && nextIndex >= tracks.length) {
        nextIndex = 0;
      }

      if (nextIndex < tracks.length) {
        const nextTrack = tracks[nextIndex];
        if (nextTrack) {
          setCurrentTrack(nextTrack);
          setCurrentTrackIndex(nextIndex);
          setIsPlaying(true);
        }
      }
    }
  };

  const playNextAuto = () => {
    if (currentTrackIndex !== null) {
      if (repeatMode === "one") {
        const currentHookTrack = tracks[currentTrackIndex];
        if (currentHookTrack) {
          setCurrentTrack({ ...currentHookTrack }); // Force new reference to trigger effects?
          setIsPlaying(true);
        }
        return;
      }

      let nextIndex = currentTrackIndex + 1;

      if (repeatMode === "all" && nextIndex >= tracks.length) {
        nextIndex = 0;
      }

      if (nextIndex < tracks.length) {
        const nextTrack = tracks[nextIndex];
        if (nextTrack) {
          setCurrentTrack(nextTrack);
          setCurrentTrackIndex(nextIndex);
          setIsPlaying(true);
        }
      } else {
        // End of playlist, stop
        setIsPlaying(false);
      }
    }
  };

  const playPrevious = () => {
    if (currentTrackIndex !== null && currentTrackIndex > 0) {
      const prevTrack = tracks[currentTrackIndex - 1];
      if (prevTrack) {
        setCurrentTrack(prevTrack);
        setCurrentTrackIndex(currentTrackIndex - 1);
        setIsPlaying(true);
      }
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleRepeatMode = () => {
    setRepeatMode((prev) => {
      if (prev === "none") return "all";
      if (prev === "all") return "one";
      return "none";
    });
  };

  const value: PlayerContextType = {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    tracks,
    currentTrackIndex,
    repeatMode,
    setCurrentTrack,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setTracks,
    playTrack,
    togglePlayPause,
    toggleMute,
    toggleRepeatMode,
    playNext,
    playNextAuto,
    playPrevious,
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
