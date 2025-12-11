import { Music, Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
// import { AddTrackModal } from "./components/AddTrackModal";
import { BottomPlayer } from "./components/BottomPlayer";
import { TrackList } from "./components/TrackList";
import { PlayerProvider, usePlayer } from "./contexts/PlayerContext";
import "./index.css";

function AppContent() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const {
    currentTrack,
    isPlaying,
    volume,
    isMuted,
    tracks,
    currentTrackIndex,
    togglePlayPause,
    setVolume,
    toggleMute,
    playNext,
    playNextAuto,
    playPrevious,
    repeatMode,
    toggleRepeatMode,
  } = usePlayer();

  const handleTrackAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 pb-24">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Music className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">Music Player</h1>
          </div>
          <p className="text-lg text-gray-600">Add your music tracks and enjoy listening!</p>
        </div>

        {/* Add Track Modal */}
        {/* <div className="mb-8">
          <AddTrackModal onTrackAdded={handleTrackAdded} />
        </div> */}

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            className="pl-10 bg-white/60 border-blue-100 focus:bg-white transition-all shadow-sm"
            placeholder="Search for a song..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Track List */}
        <TrackList
          refreshTrigger={refreshTrigger}
          onTrackAdded={handleTrackAdded}
          searchQuery={searchQuery}
        />

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          <p>Built with React, BunJS, and react-howler</p>
        </div>
      </div>

      {/* Bottom Player */}
      <BottomPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        onNext={playNext}
        onAutoNext={playNextAuto}
        onPrevious={playPrevious}
        hasNext={
          tracks.length > 0 &&
          (repeatMode === "all" ||
            (currentTrackIndex !== null && currentTrackIndex < tracks.length - 1))
        }
        hasPrevious={currentTrackIndex !== null && currentTrackIndex > 0}
        volume={volume}
        onVolumeChange={setVolume}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
        repeatMode={repeatMode}
        onToggleRepeat={toggleRepeatMode}
      />
    </div>
  );
}

export function App() {
  return (
    <PlayerProvider>
      <AppContent />
    </PlayerProvider>
  );
}

export default App;
