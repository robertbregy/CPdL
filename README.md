# CPdL - Simulatore scala contributiva - v0.21

Prototipo statico per GitHub Pages. Tutti i calcoli avvengono nel browser; i dati inseriti non vengono inviati o salvati.

## Aggiornamenti v0.21

La versione incorpora le conferme ricevute da HR il 7 ottobre 2026:

- collaboratori ROCCL normalmente su 13 mensilita; alcune categorie su 12;
- salario annuale considerato ai fini CP, contribuzione ripartita su 12 mesi;
- fascia d'eta LPP determinata per anno civile;
- aliquote b1/b2/b3 confermate;
- soglia d'entrata CHF 20'160 fissa;
- salario assicurato minimo CHF 13'200 fisso;
- nel calcolo CP entra lo stipendio annuale;
- deduzione di coordinamento al 35% dello stipendio annuale, con massimo CHF 26'460 proporzionato al grado d'occupazione;
- AVS 5.30%, AD 1.10% e INP 1.13% per il caso ordinario; AD e INP con base massima mensile CHF 12'350; INP docenti potenzialmente diversa;
- trattamento distinto dell'imposta alla fonte;
- confronto 2027 separa l'effetto della scelta di scala dall'eventuale cambio automatico di fascia d'eta;
- la Base CP della busta paga e usata come riferimento se stipendio e grado d'occupazione restano invariati.

## Nota

I parametri 2027 possono ancora cambiare in funzione dei valori federali e di eventuali modifiche del regolamento CPdL. La stima fiscale e volutamente approssimativa e non sostituisce un calcolo fiscale ufficiale. MyPension resta il riferimento per le prestazioni previdenziali future.


## v0.21
- Il terzo indicatore non duplica più la trattenuta in CHF: mostra il passaggio di aliquota contributiva CP e la variazione in punti percentuali.
- Il maggior contributo annuale è mostrato come informazione di supporto, senza trasformarlo in una previsione di capitale o rendita.
- Rafforzati i disclaimer previdenziali e il rinvio a MyPension e Cassa Pensioni di Lugano per simulazioni personali e precise.
