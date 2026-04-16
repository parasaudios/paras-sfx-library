import { useMemo, useRef, useState, useEffect, memo } from 'react';
import { Download, Play, Pause, Volume2, ChevronDown, ChevronUp } from 'lucide-react';
import { Slider } from './ui/slider';
import { capitalizeWords } from '../utils/formatters';
import { formatTagForDisplay } from '../utils/tagUtils';
import { supabaseUrl } from '../utils/supabase/info';
import type { Sound } from '../types/index';

interface GoogleDriveAudioPlayerProps {
  sound: Sound;
  index: number;
}

const getFileId = (url: string): string | null => {
  const viewMatch = url.match(/\/file\/d\/([^\/]+)/);
  if (viewMatch) return viewMatch[1];
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) return openMatch[1];
  return null;
};

const formatTime = (time: number) => {
  if (isNaN(time) || time === 0) return '0:00';
  const m = Math.floor(time / 60);
  const s = Math.floor(time % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number | null): string => {
  if (!bytes || bytes === 0) return '0.0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${mb.toFixed(1)} MB`;
};

const formatSampleRate = (hz: number | null): string | null => {
  if (!hz) return null;
  return `${(hz / 1000).toFixed(1)} kHz`;
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

function GoogleDriveAudioPlayerComponent({ sound }: GoogleDriveAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showMeta, setShowMeta] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);

  const { isGDrive, embedUrl, dlUrl, srcUrl } = useMemo(() => {
    const fid = getFileId(sound.audioUrl);
    if (fid) return {
      isGDrive: true,
      embedUrl: `https://drive.google.com/file/d/${fid}/preview`,
      dlUrl: `https://drive.google.com/uc?export=download&id=${fid}`,
      srcUrl: null as string | null,
    };
    const resolveUrl = (path: string) => path.startsWith('/') ? `${supabaseUrl}${path}` : path;
    return {
      isGDrive: false, embedUrl: null,
      dlUrl: resolveUrl(sound.downloadUrl || sound.audioUrl),
      srcUrl: resolveUrl(sound.audioUrl),
    };
  }, [sound.audioUrl, sound.downloadUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrentTime(a.currentTime);
    const onMeta = () => { setDuration(a.duration); setAudioLoaded(true); };
    const onEnd = () => setIsPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [srcUrl]);

  // Preload metadata on hover so play feels instant
  const handleHover = () => {
    const a = audioRef.current;
    if (a && a.preload === 'none') {
      a.preload = 'metadata';
    }
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) { a.pause(); setIsPlaying(false); }
    else {
      // Ensure src is loading before playing
      if (a.preload === 'none') a.preload = 'auto';
      a.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const seek = (v: number[]) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = v[0];
    setCurrentTime(v[0]);
  };

  const vol = (v: number[]) => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = v[0];
    setVolume(v[0]);
  };

  const dl = () => {
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = `${sound.title}.${sound.has_wav ? 'wav' : 'mp3'}`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const dur = audioLoaded && duration > 0 ? duration : (sound.duration_seconds || 0);
  const channelLabel = sound.channels === 1 ? 'Mono' : sound.channels === 2 ? 'Stereo' : null;

  return (
    <div className="bg-[#181c24] border border-[#252a35] rounded-xl overflow-hidden hover:border-[#2f3645] transition-colors" onMouseEnter={handleHover}>
      <div className="p-5 space-y-3">

        {/* Title */}
        <h3 className="text-[#e8eaed] text-[15px] font-semibold leading-tight">
          {capitalizeWords(sound.title)}
        </h3>

        {/* Player */}
        {isGDrive && embedUrl ? (
          <div className="rounded-lg overflow-hidden bg-black/30">
            <iframe src={embedUrl} className="w-full h-20" allow="autoplay" title={sound.title} />
          </div>
        ) : srcUrl ? (
          <div className="bg-[#0f1218] rounded-lg px-4 py-3">
            <audio ref={audioRef} src={srcUrl} preload="none" />
            <div className="flex items-center gap-3">
              <button
                onClick={toggle}
                className="bg-[#10b981] hover:bg-[#0d9668] rounded-full size-10 flex items-center justify-center shrink-0 transition-colors"
              >
                {isPlaying
                  ? <Pause className="size-[14px] text-white" />
                  : <Play className="size-[14px] text-white ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <Slider
                  value={[currentTime]}
                  max={dur || 1}
                  step={0.01}
                  onValueChange={seek}
                  className="cursor-pointer"
                />
              </div>
              <span className="text-[11px] text-[#9ca3af] tabular-nums shrink-0">
                {formatTime(currentTime)}
              </span>
              <span className="text-[11px] text-[#6b7280] tabular-nums shrink-0">
                {formatTime(dur)}
              </span>
              <Volume2 className="size-[14px] text-[#6b7280] shrink-0 ml-1" />
            </div>
          </div>
        ) : null}

        {/* Download */}
        <button
          onClick={dl}
          className="w-full h-10 rounded-lg bg-[#10b981] hover:bg-[#0d9668] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="size-4" />
          Download
        </button>

        {/* Tags */}
        {sound.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {sound.tags.map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="text-[11px] text-[#9ca3af] bg-[#1f2430] border border-[#2a3040] px-2.5 py-[5px] rounded-md"
              >
                {formatTagForDisplay(tag)}
              </span>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-5 text-[12px] text-[#6b7280] pt-1">
          <span>{formatFileSize(sound.file_size)}</span>
          <span className="flex items-center gap-1">
            <Play className="size-[10px] fill-current" /> {sound.listens || 0}
          </span>
          <span className="flex items-center gap-1">
            <Download className="size-[10px]" /> {sound.downloads || 0}
          </span>
        </div>

        {/* Metadata toggle */}
        <button
          onClick={() => setShowMeta(!showMeta)}
          className="flex items-center justify-between w-full pt-3 border-t border-[#252a35]"
        >
          <span className="text-[13px] text-[#d1d5db] font-medium">Metadata</span>
          {showMeta
            ? <ChevronUp className="size-4 text-[#6b7280]" />
            : <ChevronDown className="size-4 text-[#6b7280]" />}
        </button>

        {/* Metadata content */}
        {showMeta && (
          <div className="space-y-3 pb-1">

            {/* Core */}
            <Row label="Duration:" value={formatTime(dur)} />
            {channelLabel && <Row label="Channels:" value={channelLabel} />}
            {sound.has_wav && sound.file_size != null && (
              <Row label="File Size (WAV):" value={formatFileSize(sound.file_size)} />
            )}

            {/* MP3 Format */}
            {(sound.mp3_sample_rate || sound.mp3_bit_depth) && (
              <Section title="MP3 Format">
                {sound.mp3_sample_rate && (
                  <Row label="Sample Rate:" value={formatSampleRate(sound.mp3_sample_rate)!} sub />
                )}
                {sound.mp3_bit_depth && (
                  <Row label="Bit Depth:" value={`${sound.mp3_bit_depth}-bit`} sub />
                )}
              </Section>
            )}

            {/* WAV Format */}
            {(sound.wav_sample_rate || sound.wav_bit_depth) && (
              <Section title="WAV Format">
                {sound.wav_sample_rate && (
                  <Row label="Sample Rate:" value={formatSampleRate(sound.wav_sample_rate)!} sub />
                )}
                {sound.wav_bit_depth && (
                  <Row label="Bit Depth:" value={`${sound.wav_bit_depth}-bit`} sub />
                )}
              </Section>
            )}

            <Row
              label="WAV Available:"
              value={sound.has_wav ? 'Yes' : 'No'}
              valueColor={sound.has_wav ? '#34d399' : '#6b6b88'}
            />

            {/* Equipment */}
            {(sound.microphone || sound.recorder) && (
              <Section title="Equipment">
                {sound.microphone && <Row label="Microphone:" value={sound.microphone.toUpperCase()} sub />}
                {sound.recorder && <Row label="Recorder:" value={sound.recorder} sub />}
              </Section>
            )}

            {/* Description */}
            {sound.description && (
              <div>
                <span className="text-[11px] text-[#6b7280]">Description:</span>
                <p className="text-[12px] text-[#9ca3af] mt-0.5">{sound.description}</p>
              </div>
            )}

            {/* Upload Info */}
            <Section title="Upload Info">
              <Row label="Uploaded:" value={formatDate(sound.created_at)} sub />
              {sound.source && (
                <Row label="Source:" value={capitalizeWords(sound.source.replace(/_/g, ' '))} sub />
              )}
              {sound.filename && (
                <div className="pl-4">
                  <span className="text-[11px] text-[#6b7280]">Filename:</span>
                  <p className="text-[11px] text-[#9ca3af] break-all leading-relaxed mt-0.5">
                    {sound.filename}
                  </p>
                </div>
              )}
            </Section>


          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, sub = false, valueColor }: {
  label: string; value: string; sub?: boolean; valueColor?: string;
}) {
  return (
    <div className={`flex justify-between items-baseline ${sub ? 'pl-4' : ''}`}>
      <span className="text-[11px] text-[#6b7280]">{label}</span>
      <span className="text-[12px] text-[#d1d5db]" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[12px] text-[#e8eaed] font-semibold">{title}</span>
      {children}
    </div>
  );
}

export const GoogleDriveAudioPlayer = memo(GoogleDriveAudioPlayerComponent);
