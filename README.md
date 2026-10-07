# CPdL · Simulatore scala contributiva v0.6

Prototipo statico per GitHub Pages.

## Novità v0.6

- percorso rapido basato su trattenuta CPdL mensile + percentuale indicata in busta paga;
- confronto Scale 1/2/3 con aliquote dipendente comunicate per il 2026;
- netto mensile facoltativo, usato solo per mostrare l'effetto sul conto;
- stima fiscale separata e affinabile;
- rinvio esplicito a MyPension per la simulazione previdenziale completa;
- calcolo completo alternativo da salario lordo, grado di occupazione, fascia d'età LPP e scala;
- soglia di entrata, deduzione di coordinamento e salario assicurato parametrizzati;
- nessun backend, nessuna autenticazione, nessun dato salvato.

## Pubblicazione

Caricare `index.html`, `assets/`, `.nojekyll` e questo README nella root del repository GitHub Pages.

## Parametri ancora da validare prima di un uso operativo

- criterio esatto di determinazione dell'età LPP per il 2027;
- conferma della ripartizione della contribuzione su 12/13 mensilità;
- definizione definitiva degli elementi salariali inclusi nello stipendio base annuo lordo;
- eventuale ponderazione del salario assicurato minimo per il grado di occupazione;
- modello fiscale semplificato e dettagliato.

## Nota

Le cifre di coordinamento e le aliquote utilizzate sono quelle comunicate come valide sulla base delle informazioni disponibili fino al 2026. Il prototipo deve mantenere visibile l'avvertenza che i parametri possono cambiare per il 2027.
