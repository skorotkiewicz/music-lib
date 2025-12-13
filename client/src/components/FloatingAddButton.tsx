import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE } from "@/lib/utils";

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt: string;
}

interface FloatingAddButtonProps {
  onTrackAdded: (track: Track) => void;
}

export function FloatingAddButton({ onTrackAdded }: FloatingAddButtonProps) {
  const urlId = useId();
  const titleId = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Call the Rust server's download endpoint
      const response = await fetch(`${API_BASE}/api/download`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to download and convert track");
      }

      // Create a track object from the download response
      const newTrack: Track = {
        id: data.id,
        url: API_BASE + data.playlist_url,
        title: data.title,
        addedAt: new Date().toISOString(),
      };

      setSuccess("Track downloaded and ready to play!");
      setUrl("");
      setTitle("");
      onTrackAdded(newTrack);
      setOpen(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const isValidUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  const isFormValid = url.trim() && isValidUrl(url.trim());

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setUrl("");
      setTitle("");
      setError(null);
      setSuccess(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Track
          </DialogTitle>
          <DialogDescription>
            Paste a URL from YouTube, SoundCloud, or any supported site. The audio will be
            downloaded and converted to HLS for streaming.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={urlId}>Audio URL *</Label>
            <Input
              id={urlId}
              type="url"
              placeholder="https://youtube.com/watch?v=... or any audio URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className={error ? "border-red-500" : ""}
            />
            {url && !isValidUrl(url) && (
              <p className="text-sm text-red-500">Please enter a valid URL</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={titleId}>Track Title (optional)</Label>
            <Input
              id={titleId}
              type="text"
              placeholder="My Awesome Track"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && <div className="text-red-500 text-sm p-2 bg-red-50 rounded">{error}</div>}

          {success && (
            <div className="text-green-600 text-sm p-2 bg-green-50 rounded">{success}</div>
          )}

          <div className="p-3 bg-blue-50 rounded text-sm text-blue-700">
            <strong>Supported sources:</strong> YouTube, SoundCloud, Bandcamp, Vimeo, and 1000+ more
            sites
            <br />
            <strong>Note:</strong> Audio will be downloaded and converted to HLS format for
            streaming.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid || isLoading}>
              {isLoading ? (
                <>
                  <Plus className="mr-2 h-4 w-4 animate-spin" />
                  Downloading & Converting...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Track
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
