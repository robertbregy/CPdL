# CPdL - Simulatore scala contributiva - v0.22

Prototipo statico per GitHub Pages. Tutti i calcoli avvengono nel browser; i dati inseriti non vengono inviati o salvati.

## Aggiornamenti v0.22

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

## v0.22
- Il terzo indicatore mostra una proiezione lineare dei maggiori o minori contributi CP nel tempo invece di ripetere la stessa cifra della trattenuta mensile.
- Nel riepilogo sono mostrati gli ordini di grandezza a 1, 5 e 10 anni, assumendo salario assicurato e scala invariati.
- La proiezione non considera interessi, evoluzione salariale, grado d'occupazione, durata effettiva dell'assicurazione, pensionamento o modifiche regolamentari e non e una previsione del capitale o della rendita.
- Rafforzato il rinvio a MyPension e alla Cassa Pensioni per simulazioni personali e precise.
- Rafforzato il contrasto della sezione finale, dei pulsanti e del footer.
