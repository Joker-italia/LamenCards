# 🎨 UI — Step 4/4: Editor carte, regole configurabili, pannello simulatore e rifinitura mobile

## Contesto
Sei l'**agent UI** di LAMENCARDS. Si gioca già una partita completa (step 1–3) con nuova Home Page, bustine stile Rainbow Six Siege, barra HUD fissa con contatore gettoni, turno diviso in fasi e vista avversari pulita. L'agent ENGINE ha esportato i modelli di effetto parametrizzati, tutte le opzioni di `GameConfig` e `runSimulation` (vedi `docs/CHANGELOG_ENGINE.md`). Componenti esistenti: `CardEditorModal.tsx`, `RulesConfigModal.tsx`, `ReferenceCardModal.tsx`, `CardComponent.tsx`.

## Obiettivo
Rendere l'app uno **strumento di playtest completo** per il gruppo e rifinirla per l'uso reale da telefono, mantenendo **caratteri grandi e massima leggibilità** in ogni modale.

## Compiti
1. **Editor carte (`CardEditorModal.tsx`):**
   - accessibile sia dalla Home sia dal menu **⚙️ Impostazioni** nella barra HUD fissa;
   - campi grandi e leggibili: foto, nome, versione, classe, rarità, costo 2–6, tipo effetto, testo, **modello di effetto + parametri** (form generato dai parametri del modello, niente codice);
   - **foto:** caricamento dalla galleria/fotocamera, ritaglio, ridimensionamento a 630×880 lato client e salvataggio compresso (usa IndexedDB o compressione WebP per non saturare `localStorage`);
   - **anteprima live grande (`size="lg"`)** della carta in stile Caramella con bordo "adesivo" e testo dell'effetto ben leggibile;
   - indicatore di **budget** (valore stimato dell'effetto vs `costo − 1`) se l'engine lo espone;
   - import/export del catalogo in JSON per condividerlo nel gruppo; reset al set di prova da 32 carte.
2. **Regole configurabili (`RulesConfigModal.tsx`):**
   - accessibile dal pulsante **⚙️ Impostazioni** della barra HUD fissa;
   - form leggibile generato dalle opzioni di `GameConfig` (con descrizione chiara, valore di default del GDD evidenziato, pulsante "Ripristina GDD"); preset salvabili; l'Host applica la config alla stanza e i client la vedono in sola lettura.
3. **Pannello simulatore:**
   - lancia `runSimulation` in un **Web Worker** (UI non bloccata, barra di avanzamento, annulla), scegli n° giocatori/partite/strategia bot/config; mostra le metriche principali con grafici chiari e la watchlist; esporta il report.
4. **Carta di riferimento (`ReferenceCardModal.tsx`):**
   - sempre accessibile dalla barra HUD fissa durante la partita, con caratteri grandi e la tabella `Costo → Combinazione` **effettiva** (rispetta *Il Trip*, *Lo Sponsor*, config).
5. **Rifinitura mobile / PWA e Verifica Finale Completa:**
   - `manifest.webmanifest`, icone, meta per iOS (`apple-mobile-web-app-capable`, `100dvh`, safe-area); verifica `base: './'` per GitHub Pages;
   - verifica finale su viewport mobile (375×812 e 390×844) che **nessuna scritta, descrizione di carta o modale risulti piccola o tagliata**.
6. **Deploy:** verifica che `.github/workflows/deploy.yml` (Node 22, `npm install`, `npm run build`, `dist/`) funzioni; aggiorna `README.md` con istruzioni di gioco per gli amici.

## Vincoli
- App sempre statica (GitHub Pages), nessun backend.
- Nessuna regola nella UI; i calcoli di budget e simulazione vengono dall'engine.
- Non cambiare le chiavi `localStorage` esistenti senza una migrazione.
- **Lavora in loop continuo:** esegui `npm test`, `npm run build` e testa l'app in esecuzione (`npm run dev`), correggendo qualsiasi difetto grafico o funzionale finché l'app non ha tutte le funzioni richieste nei 4 step e gira senza errori.

## Definizione di "fatto"
- [ ] Nuova carta creata dall'editor con foto e giocata in partita (con descrizione ben leggibile)
- [ ] Tutte le modali (Editor, Regole, Carta di Riferimento, Simulatore) apribili dalla barra HUD/Impostazioni e perfettamente leggibili su mobile
- [ ] Simulazione da 1000 partite eseguita senza bloccare la UI
- [ ] App installabile come PWA su iOS e Android
- [ ] Deploy su GitHub Pages funzionante, `npm run build` verde e app testata in esecuzione
