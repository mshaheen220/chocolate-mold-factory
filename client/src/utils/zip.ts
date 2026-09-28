// A minimal ZIP writer (STORE method - no compression) so the app can
// bundle an STL and its settings JSON into one download without pulling in
// a compression library. STL binaries don't compress meaningfully anyway,
// and the settings JSON is tiny, so skipping DEFLATE costs almost nothing.

let crcTable: Int32Array | null = null;

function getCrcTable(): Int32Array {
  if (crcTable) return crcTable;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  crcTable = table;
  return table;
}

function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// DOS date/time packed format used by the ZIP spec - just "now," accurate
// to the nearest 2 seconds. Nobody reads a downloaded archive's file
// timestamps; this only exists because the format requires a value.
function dosDateTime(): { date: number; time: number } {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { date, time };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

/** Builds a valid (STORE-only) .zip archive from the given files. */
export function createZip(entries: ZipEntry[]): Blob {
  const { date, time } = dosDateTime();
  const chunks: BlobPart[] = [];
  const centralDirectory: BlobPart[] = [];
  let offset = 0;
  let centralDirectorySize = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true); // local file header signature
    localHeader.setUint16(4, 20, true); // version needed to extract
    localHeader.setUint16(6, 0, true); // flags
    localHeader.setUint16(8, 0, true); // method: 0 = stored
    localHeader.setUint16(10, time, true);
    localHeader.setUint16(12, date, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, size, true); // compressed size
    localHeader.setUint32(22, size, true); // uncompressed size
    localHeader.setUint16(26, nameBytes.length, true);
    localHeader.setUint16(28, 0, true); // extra field length

    // `Uint8Array` is a valid BlobPart at runtime regardless of what
    // ArrayBufferLike backs it - the cast just works around TS typing
    // BlobPart against a concrete ArrayBuffer while a caller-supplied
    // Uint8Array's buffer type param is wider.
    chunks.push(localHeader.buffer, nameBytes as BlobPart, entry.data as BlobPart);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true); // central directory signature
    centralHeader.setUint16(4, 20, true); // version made by
    centralHeader.setUint16(6, 20, true); // version needed to extract
    centralHeader.setUint16(8, 0, true); // flags
    centralHeader.setUint16(10, 0, true); // method: stored
    centralHeader.setUint16(12, time, true);
    centralHeader.setUint16(14, date, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, size, true);
    centralHeader.setUint32(24, size, true);
    centralHeader.setUint16(28, nameBytes.length, true);
    centralHeader.setUint16(30, 0, true); // extra field length
    centralHeader.setUint16(32, 0, true); // comment length
    centralHeader.setUint16(34, 0, true); // disk number start
    centralHeader.setUint16(36, 0, true); // internal attributes
    centralHeader.setUint32(38, 0, true); // external attributes
    centralHeader.setUint32(42, offset, true); // offset of local header

    centralDirectory.push(centralHeader.buffer, nameBytes);
    centralDirectorySize += 46 + nameBytes.length;

    offset += 30 + nameBytes.length + size;
  }

  const endRecord = new DataView(new ArrayBuffer(22));
  endRecord.setUint32(0, 0x06054b50, true); // end of central directory signature
  endRecord.setUint16(4, 0, true); // disk number
  endRecord.setUint16(6, 0, true); // disk with central directory
  endRecord.setUint16(8, entries.length, true); // entries on this disk
  endRecord.setUint16(10, entries.length, true); // total entries
  endRecord.setUint32(12, centralDirectorySize, true);
  endRecord.setUint32(16, offset, true); // central directory offset
  endRecord.setUint16(20, 0, true); // comment length

  return new Blob([...chunks, ...centralDirectory, endRecord.buffer], { type: "application/zip" });
}
