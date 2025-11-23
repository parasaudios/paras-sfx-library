import { useMemo, memo } from 'react';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import { capitalizeWords } from '../utils/formatters';
import { formatTagForDisplay } from '../utils/tagUtils';

interface GoogleDriveAudioPlayerProps {
  title: string;
  audioUrl: string;
  tags: string[];
  index: number;
  equipment?: string;
  format?: string;
}

// Extract file ID from Google Drive URL
const getFileId = (url: string): string | null => {
  const viewMatch = url.match(/\/file\/d\/([^\/]+)/);
  if (viewMatch) return viewMatch[1];
  
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) return openMatch[1];
  
  const ucMatch = url.match(/\/uc\?.*id=([^&]+)/);
  if (ucMatch) return ucMatch[1];
  
  return null;
};

function GoogleDriveAudioPlayerComponent({ 
  title, 
  audioUrl, 
  tags,
  equipment,
  format,
}: GoogleDriveAudioPlayerProps) {
  // Memoize the URLs to avoid recalculation
  const { embedUrl, downloadUrl } = useMemo(() => {
    const fileId = getFileId(audioUrl);
    return {
      embedUrl: fileId ? `https://drive.google.com/file/d/${fileId}/preview` : null,
      downloadUrl: fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : audioUrl,
    };
  }, [audioUrl]);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${title}.mp3`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors">
      <div className="space-y-3">
        <div>
          <h3 className="text-white mb-2">{capitalizeWords(title)}</h3>
          
          <div className="space-y-1 text-slate-300 text-sm">
            {equipment && (
              <div>
                <span className="text-slate-400">Equipment:</span>{' '}
                {equipment.split(',').map((item, index) => (
                  <span key={index}>
                    {capitalizeWords(item.trim())}
                    {index < equipment.split(',').length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
            
            {format && (
              <div>
                <span className="text-slate-400">Audio Format:</span> {capitalizeWords(format)}
              </div>
            )}
            
            {tags && tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-slate-400">Tags:</span>
                {tags.map((tag, index) => (
                  <span
                    key={`${tag}-${index}`}
                    className="inline-block text-xs bg-purple-600/30 text-purple-200 px-2 py-1 rounded-full"
                  >
                    {formatTagForDisplay(tag)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Google Drive Embedded Player */}
        {embedUrl && (
          <div className="overflow-hidden rounded bg-black/20">
            <iframe
              src={embedUrl}
              className="w-full h-40 rounded border border-white/20"
              allow="autoplay"
              title={`${title} audio player`}
            />
          </div>
        )}

        {/* Download Button */}
        <Button
          onClick={handleDownload}
          size="sm"
          className="w-full bg-transparent text-white hover:bg-white/10 border border-white/20"
        >
          <Download className="size-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
}

export const GoogleDriveAudioPlayer = memo(GoogleDriveAudioPlayerComponent);