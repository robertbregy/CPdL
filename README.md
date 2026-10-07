# CPdL · Simulatore scala contributiva — prototipo

Prototipo statico per GitHub Pages. Non richiede autenticazione, database o backend: tutti i calcoli avvengono localmente nel browser.

## Pubblicazione su GitHub Pages

1. Crea un repository (es. `cpdl-simulatore`).
2. Carica **il contenuto della cartella** contenuta nello ZIP nella root del repository (`index.html`, `assets/`, `.nojekyll`, `README.md`).
3. In **Settings → Pages** scegli `Deploy from a branch`, branch `main`, cartella `/ (root)`.
4. Attendi il deploy di GitHub Pages.

## Dati ufficiali già usati

- La Scala 2 aumenta contributi/accrediti del 2% del salario assicurato rispetto alla scala standard.
- La Scala 3 aumenta contributi/accrediti del 4% del salario assicurato rispetto alla scala standard.
- L'aumento è interamente a carico dell'assicurato ed è fiscalmente deducibile.
- La richiesta di cambio scala va presentata entro il 30 novembre dell'anno precedente.
- Il prototipo usa 1.75% come scenario di remunerazione, coerente con la remunerazione dell'avere di vecchiaia comunicata dalla CPdL per il 2026. Non è una promessa per gli anni futuri.

Fonti: cpdl.ch/it/entrata, cpdl.ch/it/faq-previdenza, cpdl.ch/it/statuto-e-regolamento.

## Parametri ancora da validare prima di uso reale

1. Reverse payroll della Città: trattenute effettive 2027 e trattamento della tredicesima.
2. Formula esatta del salario assicurato CPdL partendo dal lordo.
3. Modello fiscale semplificato iniziale e modello dettagliato per Comune/situazione personale.
4. Parametri ufficiali per proiettare il capitale aggiuntivo e convertirlo in rendita.
5. Casi particolari (part-time, cambi durante l'anno, congedi, indennità, ecc.).
6. Procedura finale per formalizzare il cambio di scala senza introdurre autenticazione nel simulatore.

## Nota

Questo è un prototipo UX/UI. Le componenti non ancora validate sono marcate nel sito come stime o parametri demo.
