import { Loader2, Plus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AddTrackFormProps {
  onTrackAdded: (track: Track) => void;
}

interface Track {
  id: string;
  url: string;
  title: string;
  addedAt: string;
}

export function AddTrackForm({ onTrackAdded }: AddTrackFormProps) {
  const urlId = useId();
  const titleId = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const response = await fetch("/api/tracks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: url.trim(),
          title: title.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add track");
      }

      setSuccess("Track added successfully!");
      setUrl("");
      setTitle("");
      onTrackAdded(data);

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

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Add New Track
        </CardTitle>
        <CardDescription>
          Paste a direct link to an audio file (e.g., .wav, .mp3, .m4a)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={urlId}>Audio URL *</Label>
            <Input
              id={urlId}
              type="url"
              placeholder="https://example.com/music.wav"
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

          <Button type="submit" className="w-full" disabled={!isFormValid || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding Track...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Track
              </>
            )}
          </Button>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
          <strong>Supported formats:</strong> .wav, .mp3, .m4a, .ogg, .webm
          <br />
          <strong>Note:</strong> The URL must be a direct link to the audio file.
        </div>
      </CardContent>
    </Card>
  );
}
