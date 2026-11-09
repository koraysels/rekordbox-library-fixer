/**
 * Converts one file with ffmpeg. Output goes to `<output>.converting`, is verified against what was
 * planned, and only then renamed into place — so a failure, a cancel or a crash never leaves a
 * partial file at the real path. Never writes anywhere else.
 */
import { spawn } from 'child_process';
import * as fs from 'fs';
import { durationToleranceSec, ffmpegArgs, OutputFacts } from './conversionPlan';
import { isReadable, readFileFacts } from './audioFacts';
import type { AudioFacts } from './playerProfiles';

export type ConvertResult =
  | { ok: true; outputPath: string; sizeBytes: number; facts: AudioFacts & { durationSec: number } }
  | { ok: false; error: string };

export interface ConvertJob {
  input: string;
  output: string;
  out: OutputFacts;
  source: AudioFacts & { durationSec: number };
}

const STDERR_TAIL = 8 * 1024;

const lastLine = (text: string) =>
  text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).pop() ?? '';

function runFfmpeg(
  ffmpeg: string, args: string[], signal: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise(resolve => {
    if (signal.aborted) {return resolve({ ok: false, error: 'Cancelled' });}
    let stderr = '';
    let cancelled = false;
    let settled = false;
    const done = (r: { ok: true } | { ok: false; error: string }) => {
      if (settled) {return;}
      settled = true;
      signal.removeEventListener('abort', onAbort);
      resolve(r);
    };
    const child = spawn(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    // Kill, but report only once the process has really exited: until then it may still hold or write the file.
    const onAbort = () => { cancelled = true; child.kill('SIGKILL'); };
    signal.addEventListener('abort', onAbort, { once: true });
    child.stderr.on('data', (d: Buffer) => { stderr = (stderr + d.toString()).slice(-STDERR_TAIL); });
    child.on('error', err => done({ ok: false, error: `Could not run ffmpeg: ${err.message}` }));
    child.on('close', code => {
      if (cancelled) {done({ ok: false, error: 'Cancelled' });}
      else if (code === 0) {done({ ok: true });}
      else {done({ ok: false, error: lastLine(stderr) || `ffmpeg exited with code ${code}` });}
    });
  });
}

/** Remove a file, retrying briefly: on Windows a just-killed process can still hold it for a moment. */
async function removeWithRetry(file: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { await fs.promises.rm(file, { force: true }); return; } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 100));
  }
}

/** Move into place without ever replacing a file that is already there. */
async function moveNoClobber(from: string, to: string): Promise<'moved' | 'exists'> {
  try {
    await fs.promises.link(from, to);
    await fs.promises.unlink(from);
    return 'moved';
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') {return 'exists';}
    // link unsupported (some filesystems): fall back to check-then-rename
    if (fs.existsSync(to)) {return 'exists';}
    await fs.promises.rename(from, to);
    return 'moved';
  }
}

export async function convertFile(ffmpeg: string, job: ConvertJob, signal: AbortSignal): Promise<ConvertResult> {
  const partial = `${job.output}.converting`;
  const fail = async (error: string): Promise<ConvertResult> => {
    await removeWithRetry(partial);
    return { ok: false, error };
  };

  try {
    const ran = await runFfmpeg(ffmpeg, ffmpegArgs(job.input, partial, job.out, job.source), signal);
    if (!ran.ok) {return await fail(ran.error);}
    if (signal.aborted) {return await fail('Cancelled');}

    const facts = await readFileFacts(partial);
    if (!isReadable(facts)) {return await fail('The converted file could not be read back');}
    const { out, source } = job;
    if (facts.format !== out.format) {return await fail(`Converted file is ${facts.format}, expected ${out.format}`);}
    if (facts.sampleRate !== out.sampleRate) {return await fail(`Converted file is ${facts.sampleRate} Hz, expected ${out.sampleRate} Hz`);}
    if (out.bitDepth !== undefined && facts.bitDepth !== out.bitDepth) {
      return await fail(`Converted file is ${facts.bitDepth}-bit, expected ${out.bitDepth}-bit`);
    }
    if (Math.abs(facts.durationSec - source.durationSec) > durationToleranceSec(out)) {
      return await fail(`Converted duration ${facts.durationSec.toFixed(3)} s differs from source ${source.durationSec.toFixed(3)} s`);
    }

    const { size } = await fs.promises.stat(partial);
    if (await moveNoClobber(partial, job.output) === 'exists') {
      return await fail(`A file appeared at ${job.output} during conversion; left it alone`);
    }
    return { ok: true, outputPath: job.output, sizeBytes: size, facts };
  } catch (err) {
    return await fail(err instanceof Error ? err.message : String(err));
  }
}
