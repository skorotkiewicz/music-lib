import { createContext, type ReactNode, useContext, useState } from "react";

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
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setTracks: (tracks: Track[]) => void;
  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  toggleMute: () => void;
  playNext: () => void;
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

  const playTrack = (track: Track) => {
    const index = tracks.findIndex((t) => t.id === track.id);
    setCurrentTrack(track);
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  };

  const playNext = () => {
    if (currentTrackIndex !== null && currentTrackIndex < tracks.length - 1) {
      const nextTrack = tracks[currentTrackIndex + 1];
      if (nextTrack) {
        setCurrentTrack(nextTrack);
        setCurrentTrackIndex(currentTrackIndex + 1);
        setIsPlaying(true);
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

  const value: PlayerContextType = {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    tracks,
    currentTrackIndex,
    setCurrentTrack,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setTracks,
    playTrack,
    togglePlayPause,
    toggleMute,
    playNext,
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
