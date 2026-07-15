import { describe, it, expect } from 'vitest';
import { aiffToWav } from '../../src/renderer/audio/aiffToWav';

/** Build a minimal AIFF/AIFC buffer around given 16-bit samples. */
function buildAiff(opts: {
  formType?: 'AIFF' | 'AIFC';
  compression?: string;            // 4cc, AIFC only
  samples: number[];               // interleaved 16-bit signed
  channels?: number;
  sampleRate?: number;
  littleEndianData?: boolean;      // true for sowt
}): ArrayBuffer {
  const { formType = 'AIFF', compression, samples, channels = 1, sampleRate = 44100, littleEndianData = false } = opts;
  const commBody = 18 + (formType === 'AIFC' ? 4 + 2 : 0); // +4cc +empty pstring
  const ssndBody = 8 + samples.length * 2;
  const total = 12 + (8 + commBody) + (8 + ssndBody);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  let o = 0;
  const str = (s: string) => { for (const c of s) dv.setUint8(o++, c.charCodeAt(0)); };
  str('FORM'); dv.setUint32(o, total - 8); o += 4; str(formType);
  str('COMM'); dv.setUint32(o, commBody); o += 4;
  dv.setUint16(o, channels); o += 2;
  dv.setUint32(o, samples.length / channels); o += 4;
  dv.setUint16(o, 16); o += 2;
  // 80-bit extended float for common rates: exponent 16398, mantissa = rate << 16 in the high u32
  dv.setUint16(o, 16398); o += 2;
  dv.setUint32(o, sampleRate << 16); o += 4;
  dv.setUint32(o, 0); o += 4;
  if (formType === 'AIFC') { str(compression ?? 'NONE'); dv.setUint8(o++, 0); dv.setUint8(o++, 0); }
  str('SSND'); dv.setUint32(o, ssndBody); o += 4;
  dv.setUint32(o, 0); o += 4; // offset
  dv.setUint32(o, 0); o += 4; // blockSize
  for (const s of samples) { dv.setInt16(o, s, littleEndianData); o += 2; }
  return buf;
}

/** Parse the produced WAV for assertions. */
function parseWav(buf: ArrayBuffer) {
  const dv = new DataView(buf);
  const tag = (at: number) => String.fromCharCode(dv.getUint8(at), dv.getUint8(at + 1), dv.getUint8(at + 2), dv.getUint8(at + 3));
  return {
    riff: tag(0), wave: tag(8), fmt: tag(12),
    audioFormat: dv.getUint16(20, true),
    channels: dv.getUint16(22, true),
    sampleRate: dv.getUint32(24, true),
    bitsPerSample: dv.getUint16(34, true),
    dataTag: tag(36),
    dataLen: dv.getUint32(40, true),
    sample: (i: number) => dv.getInt16(44 + i * 2, true),
  };
}

describe('aiffToWav', () => {
  it('converts big-endian AIFF PCM to valid little-endian WAV', () => {
    const wav = parseWav(aiffToWav(buildAiff({ samples: [1000, -2000, 32767, -32768] })));
    expect(wav.riff).toBe('RIFF');
    expect(wav.wave).toBe('WAVE');
    expect(wav.audioFormat).toBe(1);
    expect(wav.channels).toBe(1);
    expect(wav.sampleRate).toBe(44100);
    expect(wav.bitsPerSample).toBe(16);
    expect(wav.dataLen).toBe(8);
    expect([wav.sample(0), wav.sample(1), wav.sample(2), wav.sample(3)]).toEqual([1000, -2000, 32767, -32768]);
  });

  it('handles sowt (already little-endian) AIFC', () => {
    const wav = parseWav(aiffToWav(buildAiff({ formType: 'AIFC', compression: 'sowt', samples: [123, -456], littleEndianData: true })));
    expect([wav.sample(0), wav.sample(1)]).toEqual([123, -456]);
  });

  it('handles AIFC NONE (big-endian)', () => {
    const wav = parseWav(aiffToWav(buildAiff({ formType: 'AIFC', compression: 'NONE', samples: [777] })));
    expect(wav.sample(0)).toBe(777);
  });

  it('preserves stereo channel count and sample rate', () => {
    const wav = parseWav(aiffToWav(buildAiff({ samples: [1, 2, 3, 4], channels: 2, sampleRate: 48000 })));
    expect(wav.channels).toBe(2);
    expect(wav.sampleRate).toBe(48000);
  });

  it('rejects compressed AIFC variants', () => {
    expect(() => aiffToWav(buildAiff({ formType: 'AIFC', compression: 'ima4', samples: [0] })))
      .toThrow('Unsupported AIFF variant');
  });

  it('rejects non-AIFF garbage', () => {
    expect(() => aiffToWav(new ArrayBuffer(4))).toThrow('Not an AIFF file');
    const junk = new Uint8Array(64).fill(65);
    expect(() => aiffToWav(junk.buffer)).toThrow('Not an AIFF file');
  });
});
