import { useMemo, useRef, useState, useEffect, memo } from 'react';
import { Download, Play, Pause, Volume2, ChevronDown, ChevronUp, FileAudio, FileMusic, Loader2 } from 'lucide-react';
import { Slider } from './ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from './ui/dialog';
import { toast } from 'sonner';
import { capitalizeWords } from '../utils/formatters';
import { formatTagForDisplay } from '../utils/tagUtils';
import { supabaseUrl } from '../utils/supabase/info';
import * as api from '../utils/api';
import type { Sound } from '../types/index';

interface GoogleDriveAudioPlayerProps {
  sound: Sound;
  index: number;
}

const getFileId = (url: string | null | undefined): string | null => {
  if (!url) return null;
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

// Global event bus so only one audio plays at a time.
// When any card starts playing, it fires this event - every other card that
// was mid-playback pauses itself.
const SFX_PLAY_EVENT = 'sfx-lib:play';
function broadcastPlay(audio: HTMLAudioElement) {
  window.dispatchEvent(new CustomEvent(SFX_PLAY_EVENT, { detail: audio }));
}

function GoogleDriveAudioPlayerComponent({ sound }: GoogleDriveAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showMeta, setShowMeta] = useState(false);
  const [audioLoaded, setAudioLoaded] = useState(false);
  const listenCounted = useRef(false);

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
    if (!a || !srcUrl) return;

    // Assign src imperatively (not via JSX) so React's reconciler never
    // touches it on re-render. Only re-assign if the src actually changed
    // (comparing full URL, not the ref object). Resetting src on a playing
    // audio is what was causing playback to abort when the parent re-rendered.
    if (a.src !== srcUrl) {
      a.src = srcUrl;
    }

    const onTime = () => setCurrentTime(a.currentTime);
    const onMeta = () => { setDuration(a.duration); setAudioLoaded(true); };
    const onEnd = () => setIsPlaying(false);
    const onPause = () => {
      // Keep state honest if the browser pauses us (tab backgrounded, etc.)
      if (!a.ended) setIsPlaying(!a.paused);
    };
    const onPlay = () => setIsPlaying(true);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    a.addEventListener('pause', onPause);
    a.addEventListener('play', onPlay);

    // Pause this player if another one starts (single-instance playback)
    const onOtherPlay = (e: Event) => {
      const other = (e as CustomEvent<HTMLAudioElement>).detail;
      if (other !== a && !a.paused) {
        a.pause();
        setIsPlaying(false);
      }
    };
    window.addEventListener(SFX_PLAY_EVENT, onOtherPlay);

    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('play', onPlay);
      window.removeEventListener(SFX_PLAY_EVENT, onOtherPlay);
    };
  }, [srcUrl]);

  // Preload metadata on hover so play feels instant
  const handleHover = () => {
    const a = audioRef.current;
    if (a && a.preload === 'none') {
      a.preload = 'metadata';
    }
  };

  // Also preload metadata as soon as the card scrolls into view.
  // Covers mobile (no hover) + keyboard navigation. Fires once per mount.
  useEffect(() => {
    const card = cardRef.current;
    const a = audioRef.current;
    if (!card || !a || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && a.preload === 'none') {
          a.preload = 'metadata';
          io.disconnect();
          break;
        }
      }
    }, { rootMargin: '200px' });  // start 200px before visible
    io.observe(card);
    return () => io.disconnect();
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;

    // Pause path
    if (isPlaying && !a.paused) {
      a.pause();
      setIsPlaying(false);
      return;
    }

    // Resume / play path.
    // Make sure we still have an src loaded; some browsers may have unloaded
    // the audio when it scrolled off screen for a long time. Reassigning src
    // only if missing preserves the currentTime otherwise.
    if (srcUrl && !a.src) a.src = srcUrl;
    if (a.preload === 'none') a.preload = 'auto';

    // If the clip finished, rewind so the next play starts from the beginning
    // rather than doing nothing.
    if (a.ended) a.currentTime = 0;

    // Pause any other card that's playing
    broadcastPlay(a);

    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => setIsPlaying(true))
       .catch((err) => {
         console.warn('Audio playback failed:', err);
         setIsPlaying(false);
       });
    } else {
      setIsPlaying(true);
    }

    // Listen counter — once per mount (fire-and-forget)
    if (!listenCounted.current) {
      listenCounted.current = true;
      void api.incrementListen(sound.id);
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

  // Build absolute storage URLs from the bare filename in mp3_path / wav_path.
  const STORAGE_PREFIX = `${supabaseUrl}/storage/v1/object/public/sounds/`;
  const mp3Url = useMemo(
    () => (sound.mp3_path ? STORAGE_PREFIX + sound.mp3_path : null),
    [sound.mp3_path]
  );
  const wavUrl = useMemo(
    () => (sound.has_wav && sound.wav_path ? STORAGE_PREFIX + sound.wav_path : null),
    [sound.wav_path, sound.has_wav]
  );

  // Cross-origin downloads: the <a download> attribute is ignored when the
  // href is on a different origin, so browsers just open the audio inline.
  // We fetch the bytes ourselves, wrap in a blob: URL, and trigger the
  // download off that — which IS same-origin and therefore respects .download.
  const [downloadingFormat, setDownloadingFormat] = useState<'mp3' | 'wav' | null>(null);
  const [downloadOpen, setDownloadOpen] = useState(false);

  const downloadAs = async (url: string, ext: 'mp3' | 'wav') => {
    if (downloadingFormat) return;
    setDownloadingFormat(ext);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${sound.title}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      void api.incrementDownload(sound.id);
      toast.success(`${ext.toUpperCase()} downloaded`);
      setDownloadOpen(false);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Download failed — please try again');
    } finally {
      setDownloadingFormat(null);
    }
  };

  const dur = audioLoaded && duration > 0 ? duration : (sound.duration_seconds || 0);
  const channelLabel = sound.channels === 1 ? 'Mono' : sound.channels === 2 ? 'Stereo' : null;

  return (
    <div ref={cardRef} className="bg-[#181c24] border border-[#252a35] rounded-xl overflow-hidden hover:border-[#2f3645] transition-colors" onMouseEnter={handleHover}>
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
            {/* src + preload are set imperatively (see useEffect below) so
                React can't accidentally re-sync them on re-render — which would
                abort whatever's currently playing. playsInline keeps mobile
                browsers from pausing when the element scrolls off-screen. */}
            <audio ref={audioRef} preload="none" playsInline />
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

        {/* Download — opens a modal with large, obvious MP3 / WAV cards. */}
        {(mp3Url || wavUrl) && (
          <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
            <DialogTrigger asChild>
              <button
                className="w-full h-10 rounded-lg bg-[#10b981] hover:bg-[#0d9668] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="size-4" />
                Download
              </button>
            </DialogTrigger>
            <DialogContent className="bg-[#141820] border-[#2a3040] text-[#e8eaed] sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-white text-lg">Download sound</DialogTitle>
                <DialogDescription className="text-[#9ca3af]">
                  {sound.title}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                {/* MP3 option */}
                <button
                  type="button"
                  disabled={!mp3Url || downloadingFormat !== null}
                  onClick={() => mp3Url && downloadAs(mp3Url, 'mp3')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-xl border-2 border-[#2a3040] bg-[#0f1218]
                             hover:border-[#10b981] hover:bg-[#10b981]/5 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#2a3040] disabled:hover:bg-[#0f1218]"
                >
                  {downloadingFormat === 'mp3' ? (
                    <Loader2 className="size-7 mb-2 text-[#10b981] animate-spin" />
                  ) : (
                    <FileMusic className="size-7 mb-2 text-[#10b981] group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-white text-base font-semibold">MP3</div>
                  <div className="text-[11px] text-[#9ca3af] mt-1">
                    {mp3Url ? 'Smaller file · fast' : 'Not available'}
                  </div>
                </button>

                {/* WAV option */}
                <button
                  type="button"
                  disabled={!wavUrl || downloadingFormat !== null}
                  onClick={() => wavUrl && downloadAs(wavUrl, 'wav')}
                  className="group relative flex flex-col items-center text-center p-5 rounded-xl border-2 border-[#2a3040] bg-[#0f1218]
                             hover:border-[#10b981] hover:bg-[#10b981]/5 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#2a3040] disabled:hover:bg-[#0f1218]"
                >
                  {downloadingFormat === 'wav' ? (
                    <Loader2 className="size-7 mb-2 text-[#10b981] animate-spin" />
                  ) : (
                    <FileAudio className="size-7 mb-2 text-[#10b981] group-hover:scale-110 transition-transform" />
                  )}
                  <div className="text-white text-base font-semibold">WAV</div>
                  <div className="text-[11px] text-[#9ca3af] mt-1">
                    {wavUrl ? 'Original quality · lossless' : 'Not available'}
                  </div>
                </button>
              </div>

              {downloadingFormat && (
                <p className="text-[12px] text-[#9ca3af] text-center">
                  Preparing your {downloadingFormat.toUpperCase()}…
                </p>
              )}

              {/* Bulk option — fires a window event the App listens for so we
                  don't need to thread the full results array down through props. */}
              <div className="pt-3 border-t border-[#252a35] text-center">
                <button
                  type="button"
                  disabled={downloadingFormat !== null}
                  onClick={() => {
                    setDownloadOpen(false);
                    window.dispatchEvent(new CustomEvent('sfx-lib:request-bulk'));
                  }}
                  className="text-[13px] text-[#10b981] hover:text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="size-3.5" />
                  Or bulk download all sounds in this view
                </button>
              </div>
            </DialogContent>
          </Dialog>
        )}

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
