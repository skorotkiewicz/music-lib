import { Music } from "lucide-react";
import { useState } from "react";
import { AddTrackForm } from "./components/AddTrackForm";
import { TrackList } from "./components/TrackList";
import "./index.css";

export function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleTrackAdded = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center items-center gap-4 mb-4">
            <Music className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">Music Player</h1>
          </div>
          <p className="text-lg text-gray-600">Add your music tracks and enjoy listening!</p>
        </div>

        {/* Add Track Form */}
        <div className="mb-8">
          <AddTrackForm onTrackAdded={handleTrackAdded} />
        </div>

        {/* Track List */}
        <TrackList refreshTrigger={refreshTrigger} />

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          <p>Built with React, BunJS, and react-howler</p>
        </div>
      </div>
    </div>
  );
}

export default App;
