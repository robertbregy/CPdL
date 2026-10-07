# CPdL · Simulatore scala contributiva — prototipo v0.5

Prototipo statico per GitHub Pages. Tutti i calcoli avvengono localmente nel browser: nessun login, database o backend.

## Pubblicazione

Caricare nella root del repository:
- `index.html`
- `assets/`
- `.nojekyll`
- `README.md`

In **Settings → Pages** usare `Deploy from a branch`, branch `main`, cartella `/ (root)`.

La v0.5 usa query di cache-busting (`?v=0.5.0`) per CSS e JavaScript, così un aggiornamento non dovrebbe mischiare asset di versioni diverse.
