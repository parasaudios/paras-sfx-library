// Modal that bulk-downloads a list of sounds as one or more ZIPs.
//
// Lets the user pick MP3 (smaller) or WAV (original quality), shows a
// running progress bar as files are fetched and added to the zip, and
// triggers downloads via same-origin blob: URLs.
//
// Sounds are sliced into chunks of CHUNK_SIZE so memory stays bounded
// even for huge selections. Each chunk becomes its own '...-part-NN-of-MM'
// zip download with a small gap between to let the browser save each one.

import { useEffect, useRef, useState } from 'react';
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
  // Use a ref for the abort flag so the in-flight workers can read the
  // current value through their closure. State would freeze at the value
  // captured when the workers started.
  const abortedRef = useRef(false);
  const [, forceRerender] = useState(0);

  // Pre-built archives metadata (loaded from /archives/paras-sfx-library-metadata.json).
  // null = not loaded yet, undefined = no archives available
  type ArchiveInfo = { archive_name: string; bytes: number; files: number; url: string };
  type ArchiveMeta = { built_at: string; total_sounds: number; archives: ArchiveInfo[]; manifest?: { url: string; urls: number; bytes: number } };
  const [archiveMeta, setArchiveMeta] = useState<ArchiveMeta | null | undefined>(null);

  useEffect(() => {
    if (!open) return;
    const url = `${supabaseUrl}/storage/v1/object/public/archives/paras-sfx-library-metadata.json`;
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(data => setArchiveMeta(data as ArchiveMeta))
      .catch(() => setArchiveMeta(undefined));  // archives not available yet
  }, [open]);

  // Reset transient state when the dialog closes
  useEffect(() => {
    if (!open) {
      setDownloading(null);
      setProgress({ done: 0, total: 0, label: '', chunkIndex: 0, chunkTotal: 0 });
      abortedRef.current = false;
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
  ): Promise<number> {
    const zip = new JSZip();
    const usedNames = new Set<string>();
    let added = 0;

    let cursor = 0;
    const workers = Array.from({ length: PARALLEL }, async () => {
      while (cursor < chunk.length) {
        if (abortedRef.current) return;
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
    if (abortedRef.current || added === 0) return 0;

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

    abortedRef.current = false;
    setDownloading(format);
    setProgress({
      done: 0, total: pool.length, label: 'Starting…',
      chunkIndex: 0, chunkTotal: chunks.length,
    });

    let totalAdded = 0;
    try {
      for (let i = 0; i < chunks.length; i++) {
        if (abortedRef.current) break;
        setProgress(p => ({ ...p, chunkIndex: i }));
        const n = await buildZipFor(chunks[i], format, i, chunks.length);
        totalAdded += n;
        // Brief pause between successive zip downloads so each one can
        // be saved by the browser before the next click fires.
        if (i < chunks.length - 1 && !abortedRef.current) {
          await new Promise(r => setTimeout(r, CHUNK_GAP_MS));
        }
      }
    } catch (err) {
      console.error('Bulk download failed:', err);
      toast.error('Bulk download failed — try a smaller selection');
      setDownloading(null);
      return;
    }

    if (abortedRef.current) {
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

        {/* PRE-BUILT WHOLE-LIBRARY ARCHIVES — fastest path for "give me everything".
            One click, one HTTP download with native browser resume support.
            Built nightly by scripts/build-archives.ps1; only the pointer flips
            when a new build lands so the URL is always serving a verified zip. */}
        {archiveMeta && archiveMeta.archives && archiveMeta.archives.length > 0 && (
          <div className="rounded-lg border border-[#10b981]/30 bg-[#10b981]/5 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-white text-sm font-semibold">Download the entire library</div>
                <div className="text-[11px] text-[#9ca3af]">
                  Pre-built archive of all {archiveMeta.total_sounds.toLocaleString()} sounds —
                  one file, native browser resume.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {archiveMeta.archives.map(a => {
                const isMp3 = a.archive_name.endsWith('-mp3.zip');
                return (
                  <a
                    key={a.archive_name}
                    href={a.url}
                    download
                    className="flex flex-col items-center text-center px-3 py-2 rounded-md
                               bg-[#0f1218] border border-[#2a3040] hover:border-[#10b981] hover:bg-[#10b981]/10
                               transition-colors"
                  >
                    <span className="text-white text-sm font-semibold">
                      {isMp3 ? 'MP3 (all)' : 'WAV (all)'}
                    </span>
                    <span className="text-[10px] text-[#9ca3af]">
                      {a.files.toLocaleString()} files · {bytesToSize(a.bytes)}
                    </span>
                  </a>
                );
              })}
            </div>
            {archiveMeta.manifest && (
              <div className="text-[11px] text-[#6b7280] pt-1">
                Power users:{' '}
                <a
                  href={archiveMeta.manifest.url}
                  className="text-[#10b981] hover:underline"
                  download
                >
                  manifest.txt ({archiveMeta.manifest.urls.toLocaleString()} URLs)
                </a>
                {' '}for use with{' '}
                <code className="text-[#9ca3af]">aria2c -i</code> or{' '}
                <code className="text-[#9ca3af]">wget -i</code>.
                Built {new Date(archiveMeta.built_at).toLocaleDateString()}.
              </div>
            )}
          </div>
        )}

        {/* DIVIDER between the "everything" path and the "current selection" path */}
        {archiveMeta && archiveMeta.archives && archiveMeta.archives.length > 0 && (
          <div className="text-[11px] text-[#6b7280] text-center my-1">
            — or zip just this selection —
          </div>
        )}

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
            disabled={!!downloading || availableWav.length === 0}
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
              onClick={() => { abortedRef.current = true; forceRerender(n => n + 1); }}
              disabled={abortedRef.current}
              className="text-[12px] text-[#9ca3af] hover:text-white inline-flex items-center gap-1 disabled:opacity-50"
            >
              <X className="size-3" /> {abortedRef.current ? 'Cancelling…' : 'Cancel'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
