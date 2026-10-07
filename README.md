# CPdL · Simulatore scala contributiva — prototipo v0.2

Prototipo statico per GitHub Pages. Non richiede autenticazione, database o backend: i calcoli avvengono localmente nel browser e i dati inseriti non vengono salvati.

## Pubblicazione su GitHub Pages

1. Carica **il contenuto di questa cartella** nella root del repository (`index.html`, `assets/`, `.nojekyll`, `README.md`).
2. Se il repository è già pubblicato con GitHub Pages, sostituisci i file esistenti e attendi il nuovo deploy.
3. In caso di primo deploy: **Settings → Pages → Deploy from a branch → main → / (root)**.

## Novità v0.2

- Hero più compatto e accesso più rapido alla simulazione, soprattutto su mobile.
- Le tre scale sono ora selezionabili: il riepilogo segue la scala che l'utente vuole confrontare.
- Eliminata qualsiasi evidenza grafica che potesse sembrare una raccomandazione automatica della Scala 2.
- Linguaggio reso più neutro: `impatto netto stimato` invece di `costo reale`.
- Età non più precompilata: nessuna proiezione pensionistica viene mostrata fingendo di conoscere l'età dell'utente.
- Etichette corrette anche quando si confronta una scala inferiore.
- Reset `Ricomincia`.
- Sezione tecnica sui parametri mancanti resa secondaria e richiudibile.
- Hero illustrato nascosto su smartphone per portare l'utente più rapidamente al calcolo.

## Dati ufficiali già usati

- Scala 2: +2% del salario assicurato rispetto alla scala standard.
- Scala 3: +4% del salario assicurato rispetto alla scala standard.
- I contributi aggiuntivi sono interamente a carico dell'assicurato e fiscalmente deducibili.
- La richiesta di cambio scala va presentata entro il 30 novembre dell'anno precedente.
- Il prototipo usa 1.75% come scenario di remunerazione, coerente con la remunerazione dell'avere di vecchiaia comunicata dalla CPdL per il 2026. Non è una promessa per gli anni futuri.

Fonti indicate nel sito: CPdL Entrata, FAQ previdenza, Statuto e regolamento.

## Parametri ancora da validare

1. Reverse payroll della Città: trattenute effettive 2027 e trattamento della tredicesima.
2. Formula esatta del salario assicurato CPdL partendo dal lordo.
3. Modello fiscale semplificato iniziale e modello dettagliato per Comune/situazione personale.
4. Parametri ufficiali per proiettare il capitale aggiuntivo e convertirlo in rendita.
5. Casi particolari: part-time, entrate/uscite, congedi, indennità, salari fuori standard.
6. Procedura finale per formalizzare il cambio di scala senza introdurre autenticazione nel simulatore.

## Nota

È ancora un prototipo UX/UI. Le componenti non validate sono identificate come stime o parametri di test.
