import { HelpCircle, Music, Search } from "lucide-react";
import { useState } from "react";
import { Player } from "@/components/Player";
import { TrackList } from "@/components/TrackList";
import { Input } from "@/components/ui/input";
import { PlayerProvider, usePlayer } from "@/contexts/PlayerContext";
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
    shuffleMode,
    toggleShuffleMode,
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
            <h1 className="text-4xl font-bold text-gray-800">Music Library</h1>
          </div>
          <p className="text-lg text-gray-600">Add your music tracks and enjoy listening!</p>
        </div>

        {/* Add Track Modal */}
        {/* <div className="mb-8">
          <AddTrackModal onTrackAdded={handleTrackAdded} />
        </div> */}

        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-8 flex items-center gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              className="pl-10 bg-white/60 border-blue-100 focus:bg-white transition-all shadow-sm pr-10"
              placeholder="Search for a song..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 group-hover:block">
              <div className="relative group/tooltip">
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help hover:text-blue-500 transition-colors" />
                <div className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-gray-900 border border-gray-700 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 pointer-events-none z-50 transform translate-y-1 group-hover/tooltip:translate-y-0">
                  <p className="font-bold mb-1">Dynamic Playlist</p>
                  <p className="text-gray-300 leading-relaxed">
                    Search acts as a dynamic filter. When a search is active, "Next" and "Shuffle"
                    will only pick from the results you see.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Track List */}
        <TrackList
          refreshTrigger={refreshTrigger}
          onTrackAdded={handleTrackAdded}
          searchQuery={searchQuery}
        />

        {/* Footer */}
        {/* <div className="text-center mt-12 text-gray-500">
          <p></p>
        </div> */}
      </div>

      {/* Player */}
      <Player
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={togglePlayPause}
        onNext={playNext}
        onAutoNext={playNextAuto}
        onPrevious={playPrevious}
        hasNext={
          tracks.length > 0 &&
          (shuffleMode ||
            repeatMode === "all" ||
            (currentTrackIndex !== null && currentTrackIndex < tracks.length - 1))
        }
        hasPrevious={shuffleMode || (currentTrackIndex !== null && currentTrackIndex > 0)}
        volume={volume}
        onVolumeChange={setVolume}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
        repeatMode={repeatMode}
        onToggleRepeat={toggleRepeatMode}
        shuffleMode={shuffleMode}
        onToggleShuffle={toggleShuffleMode}
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
