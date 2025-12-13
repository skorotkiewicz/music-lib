import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from "react";

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
  shuffleMode: boolean;
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setTracks: (tracks: Track[]) => void;
  playTrack: (track: Track) => void;
  togglePlayPause: () => void;
  toggleMute: () => void;
  toggleRepeatMode: () => void;
  toggleShuffleMode: () => void;
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
  const [tracks, setTracksState] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [shuffleMode, setShuffleMode] = useState(false);

  // Shuffle bag: tracks that haven't been played yet in current shuffle cycle
  // When empty, refill with all track indices (except current)
  const shuffleBagRef = useRef<number[]>([]);
  // History of played tracks for "previous" in shuffle mode
  const shuffleHistoryRef = useRef<number[]>([]);
  // Track if we've played through the bag at least once (for repeat=none logic)
  const shuffleCycleCompleteRef = useRef(false);

  // Helper to get next shuffled index from the bag
  // Returns -1 if bag is empty and should not refill (repeat=none AND already played through once)
  const getNextShuffleIndex = (currentIndex: number | null, allowRefillAfterCycle: boolean): number => {
    // If bag is empty
    if (shuffleBagRef.current.length === 0) {
      // If we've completed a cycle and repeat is off, stop
      if (shuffleCycleCompleteRef.current && !allowRefillAfterCycle) {
        return -1;
      }
      
      // Fill the bag with all tracks except current
      shuffleBagRef.current = tracks
        .map((_, i) => i)
        .filter((i) => i !== currentIndex);
      
      // If we had to refill after a cycle, mark that we've done a cycle
      if (shuffleCycleCompleteRef.current) {
        // This is a refill for repeat=all
      }
    }

    // If still empty (only 1 track or no tracks)
    if (shuffleBagRef.current.length === 0) {
      // Mark cycle complete since there's nothing left
      shuffleCycleCompleteRef.current = true;
      return allowRefillAfterCycle ? (currentIndex ?? 0) : -1;
    }

    // Pick random from bag and remove it
    const randomBagIndex = Math.floor(Math.random() * shuffleBagRef.current.length);
    const nextIndex = shuffleBagRef.current[randomBagIndex];
    shuffleBagRef.current.splice(randomBagIndex, 1);

    // If bag is now empty, mark cycle as complete
    if (shuffleBagRef.current.length === 0) {
      shuffleCycleCompleteRef.current = true;
    }

    return nextIndex;
  };

  // Wrapper for setTracks that resets shuffle bag when tracks change
  const setTracks = useCallback((newTracks: Track[]) => {
    setTracksState(newTracks);
    // Reset shuffle bag when track list changes
    shuffleBagRef.current = [];
    shuffleHistoryRef.current = [];
    shuffleCycleCompleteRef.current = false;
  }, []);

  const playTrack = (track: Track) => {
    const index = tracks.findIndex((t) => t.id === track.id);
    
    // Add current track to history before changing (for shuffle previous)
    if (currentTrackIndex !== null) {
      shuffleHistoryRef.current.push(currentTrackIndex);
      // Keep history limited to prevent memory growth
      if (shuffleHistoryRef.current.length > 50) {
        shuffleHistoryRef.current.shift();
      }
    }
    
    setCurrentTrack(track);
    setCurrentTrackIndex(index);
    setIsPlaying(true);
  };

  const playNext = () => {
    if (currentTrackIndex !== null && tracks.length > 0) {
      // Save current to history
      shuffleHistoryRef.current.push(currentTrackIndex);
      if (shuffleHistoryRef.current.length > 50) {
        shuffleHistoryRef.current.shift();
      }

      let nextIndex: number;

      if (shuffleMode) {
        // Pick from shuffle bag
        // For manual next, allow refill if repeat is "all"
        const shouldRefill = repeatMode === "all";
        nextIndex = getNextShuffleIndex(currentTrackIndex, shouldRefill);
        
        // If -1, no more songs (shuffle finished, repeat off)
        if (nextIndex === -1) {
          return; // Don't change track, user can manually pick
        }
      } else {
        nextIndex = currentTrackIndex + 1;

        // Wrap around if we are at the end and repeat mode is ALL
        if (repeatMode === "all" && nextIndex >= tracks.length) {
          nextIndex = 0;
        }
      }

      if (nextIndex >= 0 && nextIndex < tracks.length) {
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
    if (currentTrackIndex !== null && tracks.length > 0) {
      if (repeatMode === "one") {
        const currentHookTrack = tracks[currentTrackIndex];
        if (currentHookTrack) {
          setCurrentTrack({ ...currentHookTrack });
          setIsPlaying(true);
        }
        return;
      }

      // Save current to history
      shuffleHistoryRef.current.push(currentTrackIndex);
      if (shuffleHistoryRef.current.length > 50) {
        shuffleHistoryRef.current.shift();
      }

      let nextIndex: number;

      if (shuffleMode) {
        // Pick from shuffle bag
        // Only refill if repeat is "all"
        const shouldRefill = repeatMode === "all";
        nextIndex = getNextShuffleIndex(currentTrackIndex, shouldRefill);
        
        // If -1, shuffle finished and repeat is off -> stop
        if (nextIndex === -1) {
          setIsPlaying(false);
          return;
        }
      } else {
        nextIndex = currentTrackIndex + 1;

        if (repeatMode === "all" && nextIndex >= tracks.length) {
          nextIndex = 0;
        }
      }

      if (nextIndex >= 0 && nextIndex < tracks.length) {
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
    if (currentTrackIndex !== null && tracks.length > 0) {
      if (shuffleMode) {
        // In shuffle mode, go back through history
        if (shuffleHistoryRef.current.length > 0) {
          const prevIndex = shuffleHistoryRef.current.pop()!;
          const prevTrack = tracks[prevIndex];
          if (prevTrack) {
            // Add current back to shuffle bag so it can be picked again
            if (!shuffleBagRef.current.includes(currentTrackIndex)) {
              shuffleBagRef.current.push(currentTrackIndex);
            }
            setCurrentTrack(prevTrack);
            setCurrentTrackIndex(prevIndex);
            setIsPlaying(true);
          }
        }
      } else if (currentTrackIndex > 0) {
        const prevTrack = tracks[currentTrackIndex - 1];
        if (prevTrack) {
          setCurrentTrack(prevTrack);
          setCurrentTrackIndex(currentTrackIndex - 1);
          setIsPlaying(true);
        }
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

  const toggleShuffleMode = () => {
    setShuffleMode((prev) => {
      // Reset shuffle bag and history when toggling
      shuffleBagRef.current = [];
      shuffleHistoryRef.current = [];
      shuffleCycleCompleteRef.current = false;
      return !prev;
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
    shuffleMode,
    setCurrentTrack,
    setIsPlaying,
    setVolume,
    setIsMuted,
    setTracks,
    playTrack,
    togglePlayPause,
    toggleMute,
    toggleRepeatMode,
    toggleShuffleMode,
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
