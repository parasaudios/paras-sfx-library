// Modal that bulk-downloads a list of sounds as a single ZIP.
//
// Lets the user pick MP3 (smaller) or WAV (original quality), shows a
// running progress bar as files are fetched and added to the zip, and
// triggers a single ZIP download via a same-origin blob: URL.
//
// Capped at MAX_BULK so we don't blow the browser's memory on really big
// libraries. Above the cap, the user is warned and can either reduce the
// set or proceed with a partial zip.

import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import { Download, FileMusic, FileAudio, Loader2, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from './ui/dialog';
import { toast } from 'sonner';
import { supabaseUrl } from '../utils/supabase/info';
import * as api from '../utils/api';
import type { Sound } from '../types/index';

const STORAGE_PREFIX = `${supabaseUrl}/storage/v1/object/public/sounds/`;
const CHUNK_SIZE = 100;      // each zip holds at most this many sounds
const SOFT_WARN = 200;       // multi-zip warning shown above this many sounds
const PARALLEL = 4;          // concurrent fetches per chunk
const CHUNK_GAP_MS = 800;    // delay between chunk-zip downloads (lets the
                             // browser save each one before the next click)

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sounds: Sound[];
  contextLabel?: string;     // e.g. "all results" or "search results"
}

function bytesToSize(bytes: number) {
  if (!bytes) return '';
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// Estimate file size for one format. The DB only stores ONE file_size value
// (the wav size when has_wav, else the mp3 size). This is a rough estimate.
function estimateBytes(sounds: Sound[], format: 'mp3' | 'wav'): number {
  let total = 0;
  for (const s of sounds) {
    if (!s.file_size) continue;
    if (format === 'mp3') {
      // mp3 ≈ 1/8 of wav for typical 24-bit/48k → 192kbps mp3
      total += s.has_wav ? Math.round(s.file_size / 8) : s.file_size;
    } else {
      total += s.has_wav ? s.file_size : s.file_size * 8; // unknown wav → guess
    }
  }
  return total;
}

export function BulkDownloadDialog({ open, onOpenChange, sounds, contextLabel = 'sounds' }: Props) {
  const [downloading, setDownloading] = useState<'mp3' | 'wav' | null>(null);
  const [progress, setProgress] = useState({
    done: 0, total: 0, label: '',
    chunkIndex: 0, chunkTotal: 0,
  });
  const [aborted, setAborted] = useState(false);

  // Reset transient state when the dialog closes
  useEffect(() => {
    if (!open) {
      setDownloading(null);
      setProgress({ done: 0, total: 0, label: '', chunkIndex: 0, chunkTotal: 0 });
      setAborted(false);
    }
  }, [open]);

  // Filter to sounds that actually have the requested format on disk
  const availableMp3 = sounds.filter(s => !!s.mp3_path);
  const availableWav = sounds.filter(s => s.has_wav && !!s.wav_path);

  const willChunk = sounds.length > CHUNK_SIZE;
  const totalChunks = Math.ceil(sounds.length / CHUNK_SIZE);
  const veryLarge = sounds.length > SOFT_WARN;

  // Build one zip from a slice of the pool. Returns count of files added.
  async function buildZipFor(
    chunk: Sound[],
    format: 'mp3' | 'wav',
    chunkIdx: number,
    chunkTotal: number,
    abortRef: { aborted: boolean },
  ): Promise<number> {
    const zip = new JSZip();
    const usedNames = new Set<string>();
    let added = 0;

    let cursor = 0;
    const workers = Array.from({ length: PARALLEL }, async () => {
      while (cursor < chunk.length) {
        if (abortRef.aborted) return;
        const idx = cursor++;
        const s = chunk[idx];
        const path = format === 'mp3' ? s.mp3_path! : s.wav_path!;
        const url = STORAGE_PREFIX + path;
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          let name = `${s.title}.${format}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
          let n = 2;
          while (usedNames.has(name)) {
            name = `${s.title} (${n}).${format}`.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
            n++;
          }
          usedNames.add(name);
          zip.file(name, blob);
          added++;
        } catch (err) {
          console.warn(`Skipped ${s.title}:`, err);
        } finally {
          setProgress(p => ({ ...p, done: p.done + 1, label: s.title }));
        }
      }
    });
    await Promise.all(workers);
    if (abortRef.aborted || added === 0) return 0;

    setProgress(p => ({ ...p, label: `Compressing zip ${chunkIdx + 1} / ${chunkTotal}…` }));
    const blob = await zip.generateAsync({
      type: 'blob', compression: 'STORE', streamFiles: true,
    });

    // Trigger a save for this chunk
    const ts = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const partLabel = chunkTotal > 1 ? `-part-${String(chunkIdx + 1).padStart(2, '0')}-of-${chunkTotal}` : '';
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `paras-sfx-${contextLabel.replace(/\s+/g, '-')}-${format}${partLabel}-${ts}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    return added;
  }

  async function bulk(format: 'mp3' | 'wav') {
    if (downloading) return;
    const pool = format === 'mp3' ? availableMp3 : availableWav;
    if (pool.length === 0) {
      toast.error(`No ${format.toUpperCase()} files available in this set`);
      return;
    }

    // Slice the pool into chunks of CHUNK_SIZE
    const chunks: Sound[][] = [];
    for (let i = 0; i < pool.length; i += CHUNK_SIZE) {
      chunks.push(pool.slice(i, i + CHUNK_SIZE));
    }

    setDownloading(format);
    setAborted(false);
    setProgress({
      done: 0, total: pool.length, label: 'Starting…',
      chunkIndex: 0, chunkTotal: chunks.length,
    });

    // Use a ref-style object so workers see updates to abort
    const abortRef = { aborted: false };
    const abortWatcher = setInterval(() => { if (aborted) abortRef.aborted = true; }, 100);

    let totalAdded = 0;
    try {
      for (let i = 0; i < chunks.length; i++) {
        if (abortRef.aborted) break;
        setProgress(p => ({ ...p, chunkIndex: i }));
        const n = await buildZipFor(chunks[i], format, i, chunks.length, abortRef);
        totalAdded += n;
        // Brief pause between successive zip downloads so each one can
        // be saved by the browser before the next click fires.
        if (i < chunks.length - 1 && !abortRef.aborted) {
          await new Promise(r => setTimeout(r, CHUNK_GAP_MS));
        }
      }
    } catch (err) {
      console.error('Bulk download failed:', err);
      toast.error('Bulk download failed — try a smaller selection');
      setDownloading(null);
      clearInterval(abortWatcher);
      return;
    }
    clearInterval(abortWatcher);

    if (abortRef.aborted) {
      setDownloading(null);
      toast.message('Bulk download cancelled');
      return;
    }
    if (totalAdded === 0) {
      setDownloading(null);
      toast.error('All downloads failed');
      return;
    }

    toast.success(
      chunks.length > 1
        ? `Downloaded ${totalAdded} ${format.toUpperCase()} files in ${chunks.length} zips`
        : `Downloaded ${totalAdded} ${format.toUpperCase()} files`
    );
    // Best-effort counter bumps
    for (const s of pool) void api.incrementDownload(s.id);
    onOpenChange(false);
    setDownloading(null);
  }

  const mp3Bytes = estimateBytes(sounds, 'mp3');
  const wavBytes = estimateBytes(sounds, 'wav');
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !downloading && onOpenChange(o)}>
      <DialogContent className="bg-[#141820] border-[#2a3040] text-[#e8eaed] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">
            Bulk download — {sounds.length.toLocaleString()} {contextLabel}
          </DialogTitle>
          <DialogDescription className="text-[#9ca3af]">
            Files are packaged into a single ZIP and saved to your downloads folder.
          </DialogDescription>
        </DialogHeader>

        {willChunk && (
          <div className="px-3 py-2 rounded-md bg-[#10b981]/10 border border-[#10b981]/30 text-[#a7f3d0] text-[13px]">
            Files will be split across <b>{totalChunks} zips</b> of up to {CHUNK_SIZE} sounds each.
            Your browser may ask permission to save multiple files — click <b>Allow</b>.
          </div>
        )}
        {veryLarge && (
          <div className="px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[13px]">
            Heads up: {sounds.length.toLocaleString()} sounds is a lot. This could take a few
            minutes, and you'll get {totalChunks} separate downloads.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-2">
          <button
            type="button"
            disabled={!!downloading || availableMp3.length === 0}
            onClick={() => bulk('mp3')}
            className="group flex flex-col items-center text-center p-5 rounded-xl border-2 border-[#2a3040] bg-[#0f1218]
                       hover:border-[#10b981] hover:bg-[#10b981]/5 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#2a3040] disabled:hover:bg-[#0f1218]"
          >
            {downloading === 'mp3'
              ? <Loader2 className="size-7 mb-2 text-[#10b981] animate-spin" />
              : <FileMusic className="size-7 mb-2 text-[#10b981] group-hover:scale-110 transition-transform" />}
            <div className="text-white text-base font-semibold">MP3</div>
            <div className="text-[11px] text-[#9ca3af] mt-1">
              {availableMp3.length.toLocaleString()} files · ~{bytesToSize(mp3Bytes) || '?'}
            </div>
          </button>
          <button
            type="button"
            disabled={!!downloading || tooMany || availableWav.length === 0}
            onClick={() => bulk('wav')}
            className="group flex flex-col items-center text-center p-5 rounded-xl border-2 border-[#2a3040] bg-[#0f1218]
                       hover:border-[#10b981] hover:bg-[#10b981]/5 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#2a3040] disabled:hover:bg-[#0f1218]"
          >
            {downloading === 'wav'
              ? <Loader2 className="size-7 mb-2 text-[#10b981] animate-spin" />
              : <FileAudio className="size-7 mb-2 text-[#10b981] group-hover:scale-110 transition-transform" />}
            <div className="text-white text-base font-semibold">WAV</div>
            <div className="text-[11px] text-[#9ca3af] mt-1">
              {availableWav.length.toLocaleString()} files · ~{bytesToSize(wavBytes) || '?'}
            </div>
          </button>
        </div>

        {downloading && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[12px] text-[#9ca3af]">
              <span className="truncate pr-2">{progress.label}</span>
              <span className="tabular-nums">{progress.done} / {progress.total}</span>
            </div>
            <div className="h-2 bg-[#0f1218] rounded overflow-hidden">
              <div className="h-full bg-[#10b981] transition-all" style={{ width: `${pct}%` }} />
            </div>
            {progress.chunkTotal > 1 && (
              <div className="text-[11px] text-[#6b7280] tabular-nums">
                Zip {progress.chunkIndex + 1} of {progress.chunkTotal}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAborted(true)}
              className="text-[12px] text-[#9ca3af] hover:text-white inline-flex items-center gap-1"
            >
              <X className="size-3" /> Cancel
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
