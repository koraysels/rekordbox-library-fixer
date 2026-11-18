import * as fs from 'fs';
import { readFileFacts } from '../../src/main/convert/audioFacts';
import { findSticks } from '../../src/main/usb/findSticks';

const rl = require('readline').createInterface({ input: process.stdin });
rl.on('line', async (line: string) => {
  const req = JSON.parse(line);
  let result: unknown;
  if (req.method === 'facts') result = await readFileFacts(req.params.path);
  else if (req.method === 'sticks') result = (await findSticks()).map((s: { name: string }) => s.name);
  else if (req.method === 'mem') result = Math.round(process.memoryUsage().rss / 1048576);
  process.stdout.write(JSON.stringify({ id: req.id, result }) + '\n');
});
void fs;
