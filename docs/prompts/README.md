# 🤖 Prompt per gli Agent — LAMENCARDS

Due agent lavorano in parallelo, ognuno su **4 step sequenziali**. Ogni file è un prompt autonomo da incollare all'agent (insieme a `AI_PROMPT.md` e `KNOWLEDGE.md`).

| Step | 🧠 Agent ENGINE (`src/engine/`, `src/data/`) | 🎨 Agent UI (`src/ui/`, `src/App.tsx`, `src/network/`) |
| :---: | :--- | :--- |
| 1 | [Audit, test e determinismo](./engine/01-audit-test-determinismo.md) | [Refactor di App.tsx, leggibilità globale e dimensioni carte](./ui/01-refactor-architettura.md) |
| 2 | [Effetti delle 32 carte](./engine/02-effetti-carte.md) | [Nuova Home Page, Lobby e stanze P2P con stato filtrato](./ui/02-lobby-stanze-p2p.md) |
| 3 | [Mercato, trattative, fasi turno, visibilità e validazione](./engine/03-regole-mercato-trattative.md) | [Tavolo di gioco: bustine R6, barra HUD fissa, fasi turno e vista avversari](./ui/03-tavolo-di-gioco.md) |
| 4 | [Simulatore headless e report di bilanciamento](./engine/04-simulatore-bilanciamento.md) | [Editor, regole, simulatore e rifinitura mobile](./ui/04-editor-rifinitura-deploy.md) |

## Priorità UX/UI trasversali (integrate nei prompt UI ed Engine)
1. **Leggibilità e dimensioni maggiorate:** testi, pulsanti, carte e descrizioni degli effetti devono essere grandi e immediatamente leggibili su smartphone (niente micro-testi sotto `14px`, carte più grandi + zoom al tocco).
2. **Spacchettamento stile Rainbow Six Siege:** apertura delle bustine trascinando il dito lungo la linea di strappo superiore con feedback visivo/aptico.
3. **Nuova Home Page accogliente:** via il titolo freddo *"Tavolo Multiplayer P2P"* e la descrizione tecnica; dentro un look curato in stile Caramella con una brevissima e simpatica introduzione al gioco.
4. **Barra HUD sempre visibile a schermo:** contatore dei gettoni sempre in primo piano, tasto impostazioni e info partita raggruppate (Obiettivo, Mercato, Registro mosse, Carta di riferimento).
5. **Turno diviso in fasi:**
   - **Fase Lancio Dadi:** interfaccia di lancio dadi animata al centro del tavolo;
   - **Fase Azione / Carte:** carte scoperte sul tavolo sempre visibili e carte della propria mano condensate in basso a ventaglio (*come se le stessi tenendo in mano*).
6. **Vista pulita nei turni altrui:** durante il turno degli altri giocatori si vedono solo le informazioni pubbliche (lancio dadi in tempo reale, carte giocate, scambi, effetti pubblici) e mai mani coperte, obiettivi segreti o pulsanti d'azione non pertinenti.

## Regole di convivenza tra i due agent
- **Confini dei file:** ENGINE modifica solo `src/engine/**`, `src/data/**`, `scripts/**`, test dell'engine. UI modifica solo `src/ui/**`, `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/network/**`, `index.html`.
- **Contratto condiviso:** `src/engine/types.ts` e `src/engine/index.ts` (API pubblica). Solo l'agent ENGINE li modifica; ogni modifica che rompe la compatibilità va annotata in `docs/CHANGELOG_ENGINE.md` così l'agent UI può adeguarsi.
- **La UI non contiene regole di gioco:** legge lo stato e invia `GameAction`; ogni calcolo (costi, combinazioni, azioni legali, filtraggio informazioni segrete) arriva dall'engine tramite funzioni "selettore".
- **Modalità di lavoro in loop:** ogni agent deve lavorare in loop continuo (implementa → verifica con test/`npm run build`/`npm run dev` → correggi) finché tutte le funzioni richieste nello step non sono complete e l'app gira senza errori.
- **Ordine consigliato:** ENGINE-1 e UI-1 possono partire insieme. UI-3 dovrebbe iniziare dopo ENGINE-3 (fasi turno, azioni legali e vista pubblica pronte). UI-4 (pannello simulatore) dopo ENGINE-4.
- **Prerequisito:** Node.js LTS installato (`winget install OpenJS.NodeJS.LTS`) e `npm install` eseguito.
