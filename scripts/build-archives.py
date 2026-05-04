#!/usr/bin/env python3
"""
Build a single ZIP archive from a manifest of (source_path, archive_name) pairs.

Runs INSIDE the storage container (called via `docker exec`). The manifest is
piped via stdin so we don't have to copy files between host and container.

Uses ZIP_STORED (no compression) because audio files are already compressed
or wouldn't benefit from deflate.  Streams output to disk as files are added,
so memory stays bounded regardless of total size.

Usage:
    cat manifest.tsv | python3 build-archives.py /tmp/output.zip

Manifest format (TSV per line):
    <absolute-source-path>\t<name-inside-archive>
"""
import sys
import os
import zipfile

if len(sys.argv) != 2:
    sys.stderr.write("usage: build-archives.py <output-zip-path>\n")
    sys.exit(2)

output_path = sys.argv[1]
os.makedirs(os.path.dirname(output_path), exist_ok=True)

added = 0
skipped = 0
total_bytes = 0

with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_STORED, allowZip64=True) as zf:
    for line in sys.stdin:
        line = line.rstrip('\n')
        if not line:
            continue
        parts = line.split('\t')
        if len(parts) != 2:
            sys.stderr.write(f"BAD LINE: {line!r}\n")
            skipped += 1
            continue
        source, name = parts
        if not os.path.isfile(source):
            sys.stderr.write(f"MISSING: {source}\n")
            skipped += 1
            continue
        try:
            zf.write(source, name)
            added += 1
            total_bytes += os.path.getsize(source)
            if added % 100 == 0:
                sys.stderr.write(f"  added {added}...\n")
        except Exception as e:
            sys.stderr.write(f"FAIL {source}: {e}\n")
            skipped += 1

zip_size = os.path.getsize(output_path)
sys.stderr.write(
    f"Done: {added} files added, {skipped} skipped. "
    f"Source bytes: {total_bytes}, Zip bytes: {zip_size}.\n"
)
print(f"{added}\t{skipped}\t{total_bytes}\t{zip_size}")
