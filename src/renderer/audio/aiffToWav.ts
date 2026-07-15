/**
 * Rewrap uncompressed AIFF/AIFC PCM into a WAV container.
 * No audio decoding — chunk parse, byte order fix, new header.
 * Chromium plays WAV natively; it cannot play AIFF.
 */

function readTag(dv: DataView, at: number): string {
  return String.fromCharCode(dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3));
}

/** 80-bit IEEE 754 extended float — AIFF stores sample rate this way. */
function readExtendedFloat(dv: DataView, at: number): number {
  const exponent = dv.getUint16(at) & 0x7fff;
  const hi = dv.getUint32(at + 2);
  const lo = dv.getUint32(at + 6);
  if (exponent === 0 && hi === 0 && lo === 0) { return 0; }
  return (hi * 2 ** 32 + lo) * 2 ** (exponent - 16383 - 63);
}

export function aiffToWav(input: ArrayBuffer): ArrayBuffer {
  const dv = new DataView(input);
  if (input.byteLength < 12 || readTag(dv, 0) !== 'FORM') { throw new Error('Not an AIFF file'); }
  const formType = readTag(dv, 8);
  if (formType !== 'AIFF' && formType !== 'AIFC') { throw new Error('Not an AIFF file'); }

  let channels = 0, sampleSize = 0, sampleRate = 0, littleEndian = false;
  let dataStart = -1, dataLength = 0, seenComm = false;

  let o = 12;
  while (o + 8 <= input.byteLength) {
    const id = readTag(dv, o);
    const size = dv.getUint32(o + 4);
    const body = o + 8;
    try {
      if (id === 'COMM') {
        seenComm = true;
        channels = dv.getUint16(body);
        sampleSize = dv.getUint16(body + 6);
        sampleRate = Math.round(readExtendedFloat(dv, body + 8));
        if (formType === 'AIFC') {
          const compression = readTag(dv, body + 18);
          if (compression === 'sowt') { littleEndian = true; }
          else if (compression !== 'NONE') { throw new Error('Unsupported AIFF variant'); }
        }
      } else if (id === 'SSND') {
        const dataOffset = dv.getUint32(body);
        dataStart = body + 8 + dataOffset;
        dataLength = size - 8 - dataOffset;
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Unsupported AIFF variant') {
        throw e;
      }
      if (e instanceof RangeError) {
        throw new Error('Invalid AIFF file');
      }
      throw e;
    }
    o = body + size + (size % 2); // chunks pad to even
  }

  if (!seenComm || dataStart < 0 || dataLength < 0 || dataStart > input.byteLength || channels === 0 || sampleSize === 0 || sampleRate === 0) {
    throw new Error('Invalid AIFF file');
  }
  dataLength = Math.min(dataLength, input.byteLength - dataStart);

  const bytesPerSample = Math.ceil(sampleSize / 8);
  const out = new ArrayBuffer(44 + dataLength);
  const w = new DataView(out);
  const tag = (at: number, s: string) => { for (let i = 0; i < 4; i++) { w.setUint8(at + i, s.charCodeAt(i)); } };

  tag(0, 'RIFF'); w.setUint32(4, 36 + dataLength, true); tag(8, 'WAVE');
  tag(12, 'fmt '); w.setUint32(16, 16, true);
  w.setUint16(20, 1, true);                                   // PCM
  w.setUint16(22, channels, true);
  w.setUint32(24, sampleRate, true);
  w.setUint32(28, sampleRate * channels * bytesPerSample, true);
  w.setUint16(32, channels * bytesPerSample, true);
  w.setUint16(34, sampleSize, true);
  tag(36, 'data'); w.setUint32(40, dataLength, true);

  const src = new Uint8Array(input, dataStart, dataLength);
  const dst = new Uint8Array(out, 44, dataLength);
  if (littleEndian || bytesPerSample === 1) {
    dst.set(src);
    if (bytesPerSample === 1) {
      for (let i = 0; i < dst.length; i++) { dst[i] = (dst[i] + 128) & 0xff; } // signed → unsigned
    }
  } else {
    for (let i = 0; i + bytesPerSample <= dataLength; i += bytesPerSample) {
      for (let b = 0; b < bytesPerSample; b++) { dst[i + b] = src[i + bytesPerSample - 1 - b]; }
    }
  }
  return out;
}
