import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { toast } from 'sonner@2.0.3';
import { convertGoogleDriveUrl, isGoogleDriveUrl } from '../utils/audioUtils';
import { formatTagForDisplay } from '../utils/tagUtils';

interface AudioPlayerProps {
  title: string;
  audioUrl: string;
  tags: string[];
}

export function AudioPlayer({ title, audioUrl, tags }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setAudioDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = (e: Event) => {
      console.error('Audio loading error', e);
      // Only show error toast if user tried to play
      // Don't show error on initial load
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch((error) => {
        console.error('Error playing audio:', error);
        if (isGoogleDriveUrl(audioUrl)) {
          toast.error('Unable to play audio from Google Drive. The file may need to be hosted elsewhere for playback.', {
            duration: 5000
          });
        } else {
          toast.error('Unable to play this audio file. The source may be invalid or unavailable.');
        }
        setIsPlaying(false);
      });
      setIsPlaying(true);
    }
  };

  const handleSliderChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = playableUrl;
    link.download = `${title}.mp3`;
    link.target = '_blank'; // Open in new tab for Google Drive links
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const playableUrl = isGoogleDriveUrl(audioUrl) ? convertGoogleDriveUrl(audioUrl) : audioUrl;

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
      <audio ref={audioRef} src={playableUrl} preload="metadata" />
      
      <div className="mb-3">
        <h3 className="text-white truncate mb-1">{title}</h3>
      </div>

      <div className="mb-3 flex flex-wrap gap-1">
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="text-xs bg-purple-600/30 text-purple-200 px-2 py-0.5 rounded-full"
          >
            {formatTagForDisplay(tag)}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            onClick={togglePlay}
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 size-9 p-0"
          >
            {isPlaying ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4 ml-0.5" />
            )}
          </Button>

          <div className="flex-1">
            <Slider
              value={[currentTime]}
              max={audioDuration || 100}
              step={0.1}
              onValueChange={handleSliderChange}
              className="cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(audioDuration)}</span>
        </div>

        <Button
          onClick={handleDownload}
          variant="outline"
          size="sm"
          className="w-full border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          <Download className="size-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
}