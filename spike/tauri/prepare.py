"""Assemble the spike's frontend from the built renderer (dist/renderer)."""
import pathlib, shutil, sys
here = pathlib.Path(__file__).parent
renderer = here.parent.parent / 'dist' / 'renderer'
out = here / 'frontend'
shutil.rmtree(out, ignore_errors=True)
shutil.copytree(renderer, out, ignore=shutil.ignore_patterns('screenshots'))
html = (out / 'index.html').read_text(encoding='utf-8')
(out / 'app.html').write_text(html.replace('<head>', '<head>\n' + (here / 'shim.html').read_text(encoding='utf-8'), 1), encoding='utf-8')
shutil.copy(here / 'spike.html', out / 'index.html')
print('frontend ready')
