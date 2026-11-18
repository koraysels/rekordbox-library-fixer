"""Write a 90 s test tone as WAV and AIFF for the audio checks."""
import math, struct, sys, wave, pathlib
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
rate, secs = 44100, 90
frames = b''.join(struct.pack('<h', int(8000 * math.sin(2 * math.pi * 440 * i / rate))) for i in range(rate * secs))
with wave.open(str(out / 'tone.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(frames)
def ext80(x):
    e = int(math.floor(math.log2(x))); m = int(x / 2 ** e * 2 ** 63)
    return struct.pack('>HQ', e + 16383, m)
n = rate * secs
be = b''.join(frames[i + 1:i + 2] + frames[i:i + 1] for i in range(0, len(frames), 2))
comm = struct.pack('>hIh', 1, n, 16) + ext80(rate)
ssnd = struct.pack('>II', 0, 0) + be
body = b'AIFF' + b'COMM' + struct.pack('>I', len(comm)) + comm + b'SSND' + struct.pack('>I', len(ssnd)) + ssnd
(out / 'tone.aiff').write_bytes(b'FORM' + struct.pack('>I', len(body)) + body)
print('audio ready')
