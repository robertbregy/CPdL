# CPdL · Simulatore scala contributiva — v0.16

Prototipo statico per GitHub Pages. Tutti i calcoli avvengono localmente nel browser.

## Novità v0.16

- Due percorsi di ingresso equivalenti: **Ho la busta paga** / **Non ho la busta paga**.
- Il percorso busta paga richiede almeno due valori tra Base, Percentuale e Importo della riga «Contributo ordinario CP» e l'età.
- Il percorso senza busta paga parte da netto mensile + età + informazione sulla tredicesima.
- I due percorsi confluiscono nello stesso confronto Scala 1/2/3.
- Chi parte dal conto può aggiungere la busta paga più tardi senza ricominciare.
- Chi parte dalla busta paga può aggiungere il netto mensile per vedere anche il nuovo importo stimato sul conto.
- Stima indicativa delle imposte separata e collegamento a MyPension per le prestazioni future.

## Pubblicazione

Carica `index.html`, `assets/`, `.nojekyll` e `README.md` nella root del repository GitHub Pages.

## Attenzione

I parametri 2027 possono cambiare. Il prototipo non costituisce un conteggio salariale, fiscale o previdenziale ufficiale.
