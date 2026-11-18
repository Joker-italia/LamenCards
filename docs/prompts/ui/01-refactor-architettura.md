# 🎨 UI — Step 1/4: Refactor di App.tsx, leggibilità globale e ridimensionamento Carte

## Contesto
Sei l'**agent UI** di LAMENCARDS. Leggi `AI_PROMPT.md` e `KNOWLEDGE.md`. Stack: **React 18 + TypeScript + Vite**, deploy statico su GitHub Pages, multiplayer P2P con PeerJS. **Niente backend/PHP**: l'app deve restare 100% statica.

Lavori **solo** in `src/ui/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/network/**`, `index.html`. **Non modificare `src/engine/**`** (lo gestisce l'agent ENGINE in parallelo): se ti serve qualcosa dall'engine, scrivilo in `docs/UI_REQUESTS.md`.

### Problema critico attuale da risolvere subito in questo step
1. `src/App.tsx` è un monolite da ~84 KB con decine di `useState`.
2. **I caratteri delle carte, la dimensione delle carte, l'interfaccia e in generale le scritte a schermo sono troppo piccoli e risultano illegibili**, specialmente le descrizioni degli effetti delle carte (oggi in `CardComponent.tsx` arrivano a `0.51rem` ≈ `8px` con `WebkitLineClamp: 3` che tronca pure il testo!).

## Obiettivo
Spezzare `App.tsx` in componenti modulari e **rifondare la scala tipografica, le dimensioni delle carte e la barra HUD superiore**, rendendo ogni testo e ogni carta grandi, nitidi e perfettamente leggibili anche su smartphone.

## Compiti
1. **Struttura cartelle:**
   ```
   src/ui/
     screens/    HomeScreen, LobbyScreen, DraftScreen, GameScreen, GameOverScreen
     components/ CardComponent, CardZoomModal, GameHudBar, DiceStage, PlayerHandFan,
                 TableBoard, MarketDrawer, LogDrawer, TradeModal, CardEditorModal,
                 RulesConfigModal, ReferenceCardModal…
     hooks/      useLocalStorage, useCatalog, useGameConfig, useRoom, useGameState
     state/      store o Context (GameContext, RoomContext)
     theme/      variabili CSS "Caramella" e scala tipografica
   ```
2. **Rifondazione Leggibilità e Tipografia (`src/index.css` e componenti):**
   - **Vietati i micro-font:** nessun testo nell'interfaccia deve scendere sotto `0.875rem` (`14px`); il testo base del corpo deve essere `1rem`–`1.05rem` (`16px`–`17px`), i bottoni `1rem`–`1.1rem`, i titoli ben scanditi e ad alto contrasto (`#2b2350` su `#fffdf6` o `#fffdf6` su `#2b2350`).
   - Aumenta padding, spaziatura, icone e dimensioni dei pulsanti (target di tocco minimo `48×48 px`).
3. **Redesign di `CardComponent.tsx` + Zoom Carta (`CardZoomModal.tsx`):**
   - **Aumenta sensibilmente le dimensioni delle carte:**
     - `sm`: da `134px` a minimo **`175px–190px`** (per griglie, mercato e tavolo);
     - `md`: da `188px` a minimo **`230px–250px`** (per la mano e il draft);
     - `lg`: da `246px` a **`300px–340px`** (per anteprima ed editor).
   - **Box descrizione effetto leggibile:**
     - aumenta il font della descrizione effetto ad almeno **`0.82rem–0.95rem`** (`13px–15px` reali) con `line-height: 1.25` e peso `700`;
     - riduci lo spazio sprecato dai metadati secondari (es. `#setNumber` piccolo in un angolo) per dare più area verticale e orizzontale al testo dell'effetto e al nome della carta;
     - non troncare mai l'effetto rendendolo illeggibile.
   - **Ispezione / Zoom al tocco (`CardZoomModal`):** toccando un pulsante lente `🔍` o tenendo premuto (long-press / doppio tap) su **qualsiasi** carta in qualunque schermata (mano, tavolo, mercato, draft, vetrina), si apre un'anteprima grande a centro schermo (`lg`/`xl`) con testo dell'effetto grande, classe, costo, combinazione di dadi richiesta e stato (bloccata/giocabile).
4. **Predisposizione Barra HUD Fissa (`GameHudBar.tsx`):**
   - Crea già il componente della barra superiore fissa (`sticky` top `z-index: 100`) che rimarrà sempre a schermo con:
     - **Contatore Gettoni (`🪙`) grande e sempre visibile**;
     - Accesso rapido raggruppato alle **info della partita** (Obiettivo, Mercato, Registro Mosse, Carta di Riferimento);
     - **Tasto Impostazioni (`⚙️`)** (che apre il menu con Regole, Editor Carte, Codice Stanza, Esci).
5. **Stato e Persistenza:** sposta lo stato in hook/Context dedicati mantenendo intatte le chiavi `localStorage` esistenti (`lamencards_custom_catalog_v2`, ecc.).
6. **Import dell'engine:** elenca in `docs/UI_REQUESTS.md` ogni calcolo di regole o selettore che ti serve dall'engine per gli step successivi.

## Vincoli
- Nessun file in `src/ui/` oltre ~400 righe.
- TypeScript strict, niente `any` nuovi.
- **Lavora in loop continuo:** avvia e verifica il progetto (`npm run build` e `npm run dev`), controlla visivamente che tutte le scritte e le carte siano grandi e leggibili e non fermarti finché tutto non compila e gira senza errori.

## Definizione di "fatto"
- [ ] `App.tsx` ridotto a shell/router (< 150 righe)
- [ ] Carte e testi in tutta l'app ingranditi e perfettamente leggibili (zero testi microscopici o descrizioni troncate)
- [ ] `CardZoomModal` funzionante su qualsiasi carta
- [ ] `GameHudBar` creata e sempre visibile in alto
- [ ] `docs/UI_REQUESTS.md` creato e `npm run build` senza errori
