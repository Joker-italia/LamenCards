# 🎨 UI — Step 3/4: Bustine stile Rainbow Six, Barra HUD fissa, Turno a Fasi e Vista Avversari

## Contesto
Sei l'**agent UI** di LAMENCARDS. Step 1–2 completati (carte grandi e leggibili, `GameHudBar`, nuova Home Page, lobby P2P). L'agent ENGINE ha esportato in `src/engine/index.ts` le fasi `TurnStep` (`ROLLING`, `ACTION_DECISION`, `POST_ACTION`), `getPublicStateFor` e i selettori (`getLegalActions`, `getPlayableCards`, ecc.). Lavori in `src/ui/**`, `src/App.tsx`, `src/index.css`.

## Obiettivo
Realizzare un'esperienza di gioco su smartphone **spettacolare, leggibile e ben scandita**, risolvendo tutti i punti chiave di UX richiesti.

## Compiti obbligatori

### 1. Apertura Bustine stile Rainbow Six Siege (Drag-to-Tear)
- Durante la fase `PACK_OPENING`, quando il giocatore apre una delle sue **2 bustine da 5 carte**:
  - Mostra la bustina grande al centro dello schermo con riflessi foil/olografici e una **linea di strappo luminosa** nella parte superiore, accompagnata da un invito animato chiaro: **"👆 Trascina il dito lungo la linea per strappare la bustina!"**.
  - **Interazione touch/mouse (`pointerdown` → `pointermove` → `pointerup`):**
    - Trascinando il dito da sinistra a destra lungo il bordo superiore, la linguetta della bustina **si strappa progressivamente seguendo il dito** (0% → 100%), con scintille/particelle, bagliore che cresce dal retro della busta (colorato in base alla rarità massima contenuta: es. arcobaleno olografico se c'è una `PROMO`, oro se `Rara`, verde menta se `Comune`) e vibrazione aptica (`navigator.vibrate`).
    - Superata la soglia di strappo (~75%), la cima della busta vola via con un'esplosione di coriandoli/luce e le **5 carte escono in sequenza** girandosi una a una in grande formato leggibile.
  - Dopo lo spacchettamento, schermata chiara con carte grandi per scegliere **4 Titolari + 2 Riserve**, scambi liberi pre-partita e scelta dell'**Obiettivo** (2 carte grandi, tienine 1).

### 2. Barra Superiore Fissa (HUD) con Contatore Gettoni Sempre a Schermo
- In cima allo schermo (`GameHudBar.tsx`, sempre fissa e visibile durante tutte le fasi della partita) devono esserci sempre:
  1. **Contatore dei tuoi Gettoni (`🪙 X`) sempre in primo piano:** badge grande, dorato, con animazione `+N` / `-N` quando guadagni o spendi gettoni.
  2. **Info della Partita raggruppate** in pulsanti/pillole chiari e leggibili:
     - **🎯 Il tuo Obiettivo:** mostra titolo/progresso (`es. 2/4`) e al tocco apre il pop-up col testo completo del tuo Obiettivo coperto;
     - **🏪 Mercato:** apre il drawer del Mercato (con badge numero carte);
     - **📜 Registro Mosse:** apre il drawer con la cronologia mosse;
     - **📖 Regole / Combinazioni:** apre la Carta di Riferimento (`Costo → Combinazione`).
  3. **⚙️ Tasto Impostazioni:** apre un menu rapido con Configurazione Regole, Editor Carte, Codice Stanza / Link Invito e tasto Esci.

### 3. Divisione del Turno in Fasi + Tavolo Sempre Visibile + Mano Condensata in Basso
- **Carte scoperte sul tavolo SEMPRE visibili (`TableBoard.tsx`):**
  - La parte centrale del tavolo mostra sempre chiaramente le carte già giocate scoperte sul tavolo (le tue e quelle degli avversari, con i loro gettoni e stato).
- **Quando TOCCA A ME (`isMyTurn === true`), dividi l'interfaccia in base alla fase del turno:**
  - **FASE A — Lancio dei Dadi (`TurnStep === 'ROLLING'`):**
    - Appare sulla tavola una **Interfaccia di Lancio dei Dadi dedicata e animata (`DiceStage.tsx`)**: 5 dadi grandi 3D/cartoon che rotolano e rimbalzano quando tiri, tap sul singolo dado per bloccarlo (`TENUTO 🔒` / `LIBERO`), contatore tiri grande (`Tiro 1 di 3`), anteprima live delle combinazioni sbloccate (Coppia, Doppia Coppia, Scala di 4, Full, Poker) e dell'eventuale bottone *Il Dado Fortunato*.
    - Bottoni grandi e chiari: **"🎲 Tira / Ritira i Dadi"**, **"🪙 Incassa Subito (+X gettoni)"** oppure **"🃏 Conferma Dadi e Vai alle Carte"**.
    - Durante il lancio dei dadi, le carte della tua mano restano **raccolte/abbassate sul bordo inferiore** così il tavolo dei dadi ha tutto lo spazio.
  - **FASE B — Scelta Azione e Mano di Carte (`TurnStep === 'ACTION_DECISION'` o `'POST_ACTION'`):**
    - L'interfaccia grande dei dadi si compatta in una striscia riassuntiva in alto sul tavolo (mostrando i dadi finali usciti e le combinazioni ottenute).
    - **In basso si alza la tua Mano di Carte (`PlayerHandFan.tsx`) disposta a ventaglio / condensata in basso come se le stessi tenendo in mano:**
      - Le carte coperte della tua mano sono affiancate/sovrapposte leggermente ad arco in basso.
      - Le carte giocabili con i dadi e i gettoni attuali brillano con bordo verde e badge **"✓ GIOCABILE"**; quelle bloccate da un doppione in campo mostrano **"🔒 BLOCCATA"**.
      - Toccando una carta della mano, questa **si solleva in primo piano (grande e perfettamente leggibile)** mostrando il pulsante **"▶ Gioca Carta (X 🪙)"**, mentre un secondo tap o il tasto `🔍` la apre a tutto schermo.
      - Sono visibili i controlli per **Incassa** (se non hai ancora giocato), **Scambia col Mercato**, **Fai Offerta a un Avversario** e **"➔ Passa il Turno"**.

### 4. Vista Pulita nei Turni degli Altri Giocatori (`isMyTurn === false`)
- Quando **NON tocca a te**, l'interfaccia deve mostrare **solo le informazioni che è giusto si vedano**:
  - **Nessun pulsante di azione del turno attivo** (niente bottoni "Ritira dadi", "Incassa", "Passa il turno" o "Compra carta" che confondono).
  - **Banner chiaro in alto sul tavolo:** *"⏳ Turno di [Nome Giocatore] — Sta tirando i dadi / Sta scegliendo la mossa..."*.
  - **Osservazione Live del Tavolo:** vedi in tempo reale i **dadi che l'avversario sta lanciando e tenendo** sulla tavola, le carte che gioca scoperte sul tavolo, gli **scambi col Mercato** e le **offerte di trattativa** pubbliche.
  - **Informazioni segrete protette:** degli altri giocatori vedi solo il numero di carte coperte in mano (`🃏 3 in mano`), i gettoni (`🪙`) e le carte scoperte in gioco (l'obiettivo altrui resta nascosto a meno che tu non l'abbia spiato con *Il Ficcanaso* o le regole siano impostate su obiettivi pubblici).
  - La tua mano rimane **condensata e raccolta in basso** (puoi toccare le tue carte per rileggerle mentre aspetti, ma senza pulsanti "Gioca").
  - **Reazioni / Scelte fuori turno:** se l'avversario ti fa un'offerta di scambio o gioca un effetto che richiede una tua scelta (*Giro di Shot*, *Sfattonata Collettiva*, *Effetto Ritardo*), compare subito una modale chiara e grande per rispondere.

## Vincoli
- **Zero regole duplicate nella UI:** usa sempre i selettori dell'engine.
- **Leggibilità assoluta:** tutte le scritte e le carte devono rispettare le dimensioni maggiorate dello Step 1.
- **Lavora in loop continuo:** testa l'intero flusso (spacchettamento con trascinamento dito → barra gettoni fissa → fase lancio dadi → fase mano a ventaglio → turno avversario) con `npm run dev` e `npm run build` finché tutte le funzioni richieste non ci sono e l'app gira perfettamente.

## Definizione di "fatto"
- [ ] Apertura bustine con trascinamento del dito (stile Rainbow Six Siege) fluida e spettacolare
- [ ] Barra HUD fissa sempre a schermo con contatore gettoni, impostazioni e info partita raggruppate
- [ ] Turno diviso chiaramente tra interfaccia animata Lancio Dadi e Mano di carte a ventaglio in basso, con carte scoperte sul tavolo sempre visibili
- [ ] Nei turni degli altri giocatori si vedono solo le azioni pubbliche in tempo reale (dadi, scambi, carte giocate)
- [ ] `npm run build` verde e app verificata nel browser
