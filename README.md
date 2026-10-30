# Morada · portale immobiliare per il Venezuela

Aggregatore immobiliare (stile immobiliare.it / idealista) adattato al mercato venezuelano e potenziato con gli elementi dello studio di fattibilità *“Piattaforma PropTech in Venezuela”*. Interfaccia in spagnolo, prezzi in USD con equivalente in bolívares al tasso BCV.

Il marchio, i testi, la grafica e il codice sono originali: dei portali di riferimento sono state studiate solo le meccaniche (ricerca con mappa, filtri a faccette, schede, contatto, pubblicazione a passi, piani per agenzie). Nessun asset, codice o dato è stato copiato o estratto.

## Avvio

```bash
cd morada
npm start            # http://localhost:8080  (Node ≥ 20, nessuna dipendenza)
npm test             # test del motore
node scripts/build-static.mjs   # versione statica in dist/ (modo demo nel browser)
```

Al primo avvio viene creato `data/db.json` con dati di esempio (fittizi). Account demo, password `morada2026`:

| Account | Tipo cliente | Cosa provare |
|---|---|---|
| agencia@morada.demo | Agenzia, piano Agency Pro Max | CRM kanban, pagamenti USD/Bs., contratti Ley 2026, rete B2B |
| costa@morada.demo | Agenzia, piano Professional | CRM e pagamenti; rete e contratti bloccati (upsell) |
| constructora@morada.demo | Costruttore | Obra nueva, pay-per-lead qualificato |
| propietario@morada.demo | Privato | 1 annuncio gratis + annunci extra a pagamento |
| internacional@morada.demo | Broker estero (Pro Max) | Referral di acquirenti con split 20-40 % |
| comprador@morada.demo | Acquirente della diaspora | Ricerche salvate, due diligence, escrow |
| admin@morada.demo | Amministrazione | Coda verifica titoli SAREN, tasso BCV, ricavi |

## Meccaniche implementate

**Portale (dal modello immobiliare.it)**
- Ricerca vendita/affitto/nuove costruzioni con autocompletamento per città e zona.
- Lista e mappa sincronizzate (marker con prezzo, clustering, evidenziazione al passaggio), "cerca muovendo la mappa" e **zona disegnata a mano** (poligono).
- Filtri: tipo, prezzo, m², camere, bagni, piano, stato, servizi tipici del Venezuela (planta eléctrica, tanque/pozo de agua, vigilancia 24h, paneles solares), forma di pagamento (USD, Bs., USDT, Zelle), solo titoli verificati, parcheggio.
- Ordinamento per rilevanza (annunci in evidenza e verificati prima), prezzo, prezzo/m², superficie.
- Scheda con galleria e visore, dati, indicatore "prezzo rispetto alla zona", stima AVM, mappa, simili, preferiti, condivisione.
- Contatto: richiesta informazioni o visita, pre-qualifica (reddito, fondi in valuta, tempistica), WhatsApp, telefono.
- Pubblicazione a 7 passi: posizione sulla mappa, caratteristiche, **prezzo suggerito con comparabili**, foto (ridimensionate nel browser), documenti, anteprima. Bozza salvata automaticamente.
- Ricerche salvate con conteggio dei nuovi annunci, preferiti, area personale.

**Dallo studio**
- Tipi di cliente: privati, agenzie (CIV/PREANI), costruttori, broker internazionali, acquirenti della diaspora, amministrazione.
- Piani Starter $35 / Professional $75 / Agency Pro Max $140 con limiti reali (annunci attivi, vetrine incluse, funzioni sbloccate).
- Visibilità a pagamento (Destacado, Top en zona, newsletter diaspora); annunci extra per privati; pay-per-lead per costruttori.
- **Due Diligence digitale e sigillo "Título verificado SAREN"**: l'inserzionista carica titolo, gravamen, cédula catastral e solvencias; l'amministrazione approva o rifiuta; il fascicolo è visibile solo a chi acquista una due diligence ($90/$160/$250) o alla rete Pro Max.
- **Ley de Arrendamiento 2026 (Gaceta 7.065)**: guida, calcolatrice (deposito max 3 mesi, soglia 30 % manutenzioni), generatore di contratto con firma elettronica e domicilio digitale.
- **Riconciliazione bivaluta**: canoni in USD, pagamenti in Bs. al tasso BCV del giorno, saldo, scaduti e allerta oltre 3 mensilità (Art. 23).
- **Rete di co-brokering B2B** (solo Pro Max): accordo Broker-to-Broker con split 20-40 %, fee piattaforma 15 %, stati proposto → accettato → visita → offerta → chiuso con cronologia.
- Simulatore di prestito ponte in valuta (9-13 %, 3-5 anni) e pagina diaspora con SPV, debito privato ed escrow.
- Valutatore AVM pubblico (vendita, affitto, rendimento lordo) e prezzi mediani al m² per zona.
- Servizi per la casa (traslochi, assicurazione, ristrutturazione) come fonte di ricavo da affiliazione.

## Architettura

- `shared/` – dominio e API (`engine.js`), regole e calcoli (`core.js`), dati demo (`seed.js`). Codice puro: gira identico su Node e nel browser.
- `server.js` – server HTTP senza dipendenze: API JSON con token Bearer, password PBKDF2, upload su `data/uploads/`, salvataggio atomico su `data/db.json`.
- `public/` – SPA in JavaScript moderno senza build: router a hash, viste in `views/`, Leaflet + MarkerCluster inclusi in `vendor/`.
- Senza server (es. pagina statica) l'app usa lo stesso motore nel browser con `localStorage` ("modo demo").

## Simulato in questa versione

Pagamenti (piani, visibilità, due diligence), escrow, OCR dei documenti, invio email/notifiche e WhatsApp Business API.

## Tasso BCV automatico

Il server legge il tasso ufficiale all'avvio e ogni 6 ore: prima dalla pagina del BCV, poi da DolarApi come riserva. Un valore che differisce più del 40 % dal precedente viene scartato. Se la lettura fallisce resta l'ultimo tasso valido e il pannello admin mostra l'errore; l'admin può forzare la lettura o inserire il tasso a mano. Variabili: `RATE_EVERY_HOURS` (default 6), `RATE_AUTO=0` per disattivare. Le illustrazioni degli annunci senza foto sono generate dal codice.

## Verso la produzione (come indica lo studio)

PostgreSQL + PostGIS per le query spaziali, Typesense/Meilisearch per i filtri, rendering lato server (Next.js) per la SEO delle schede, archiviazione immagini su S3, integrazione con pasarela di pagamento, firma elettronica qualificata e feed del tasso BCV. L'interfaccia `createEngine({ db, save, storeFile })` è il punto in cui sostituire la persistenza.
