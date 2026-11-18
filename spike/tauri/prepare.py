"""Assemble the spike's frontend from the built renderer (dist/renderer)."""
import pathlib, shutil, subprocess, sys
here = pathlib.Path(__file__).parent
renderer = here.parent.parent / 'dist' / 'renderer'
out = here / 'frontend'
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(renderer, out, ignore=shutil.ignore_patterns('screenshots'))
html = (out / 'index.html').read_text(encoding='utf-8')
(out / 'app.html').write_text(html.replace('<head>', '<head>\n' + (here / 'shim.html').read_text(encoding='utf-8'), 1), encoding='utf-8')
shutil.copy(here / 'spike.html', out / 'index.html')
# The app's own AIFF-to-WAV rewrap, the way its player plays AIFF (Chromium has no AIFF).
esbuild = here.parent.parent / 'node_modules' / '.bin' / ('esbuild.cmd' if sys.platform == 'win32' else 'esbuild')
subprocess.run([str(esbuild), str(here.parent.parent / 'src' / 'renderer' / 'audio' / 'aiffToWav.ts'), '--bundle',
                '--format=iife', '--global-name=AiffToWav', '--outfile=' + str(out / 'aiff.js'), '--log-level=warning'], check=True)
print('frontend ready')
