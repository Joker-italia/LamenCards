# 🎨 UI — Step 2/4: Nuova Home Page accogliente, Lobby e stanze P2P con stato filtrato

## Contesto
Sei l'**agent UI** di LAMENCARDS. Lo step 1 ha separato `App.tsx` in schermate/componenti e ha sistemato leggibilità e dimensioni delle carte. Rete: `src/network/p2pRoom.ts` (`P2PRoomManager`, PeerJS + `BroadcastChannel`). Un telefono fa da **Host** ed esegue l'engine; gli altri sono **client**. Lavori in `src/ui/**`, `src/network/**`, `src/App.tsx`, `index.html`.

### Problema critico attuale da risolvere in questo step
Nella schermata principale (`HomeScreen`) il titolo tecnico **`"Tavolo Multiplayer P2P"`** e la descrizione asciutta (*"Gioca da 3 a 6 amici ognuno col proprio smartphone..."*) sono brutti e freddi. Serve un **look della pagina iniziale molto più curato e accattivante** con una **brevissima e simpatica introduzione al gioco**.

## Obiettivo
1. Rifare il look della **Home Page** in pieno stile *Caramella* con un'introduzione simpatica e immediata.
2. Rendere l'ingresso in stanza con 3–6 amici **immediato e robusto** da Safari iOS e Chrome Android.
3. Garantire a livello di rete P2P che **ogni giocatore riceva solo le informazioni che è giusto veda** (`getPublicStateFor`).

## Compiti
1. **Nuovo Look della Pagina Iniziale (`HomeScreen.tsx`):**
   - **Elimina la scritta `"Tavolo Multiplayer P2P"`** e la vecchia descrizione tecnica.
   - Crea una **Hero / Splash Card Caramella** vivace e d'impatto:
     - Titolo giocoso e grande (es. **"Chiama la Compagnia!"** o **"Pronti a Spacchettare gli Amici?"**) accompagnato da un piccolo ventaglio decorativo di 3 carte *Lamencards* inclinate.
     - **Brevissima e simpatica introduzione al gioco** (2–3 righe brillanti e leggibili, es.: *"I tuoi amici sono finiti dentro le bustine! Apri 2 pacchetti, tira i dadi, ruba gettoni agli Scrocconi e schiera per primo la tua squadra di 4 leggende!"*).
     - **3 mini-badge visivi "Come si gioca in 10 secondi"**:
       1. `📦 Apri 2 Bustine` (scegli 4 titolari + 2 riserve)
       2. `🎲 Tira i Dadi o Incassa` (combina i dadi o fai cassa di gettoni)
       3. `🏆 Gioca 4 Carte + Obiettivo` (blocca i doppi agli amici e vinci!)
     - Box **Gioca Subito** ben evidente e con font grandi: campo "Come ti chiamano nel gruppo?", bottone grande corallo **"🏠 Crea Stanza con gli Amici"** e riquadro verde menta **"🔑 Entra con Codice Stanza"**.
     - Sotto (o in tab espandibile ben curato), la **Galleria delle 32 Carte degli Amici** con carte grandi (`size="md"`), filtrabili per classe (`Dormienti`, `Utenti`, `Festaioli`, `Scrocconi`) e cliccabili per lo zoom o per aprire l'Editor.
2. **Sala d'attesa (`LobbyScreen.tsx`):**
   - Codice stanza grande e leggibile (niente caratteri ambigui `0/O`, `1/I`), pulsante **Condividi Link Invito** (`?room=CODICE`, Web Share API + fallback copia) e **QR Code** generato lato client per far entrare gli amici inquadrando lo schermo.
   - Lista giocatori connessi (3–6) con badge grandi, pulsante "+ Aggiungi Bot" per testare anche in meno di 3, riepilogo rapido delle regole attive e pulsante grande per avviare lo spacchettamento.
3. **Protocollo host-autoritativo e Privacy delle Informazioni in `p2pRoom.ts`:**
   - I client inviano **solo `GameAction`** con `playerId`; l'Host le valida (`validateAction` dell'engine) e aggiorna lo stato;
   - **Filtraggio informazioni per giocatore:** l'Host **non** invia lo stato completo in chiaro a tutti, ma invia a ciascun client la sua vista filtrata tramite `getPublicStateFor(state, targetPlayerId)` (o adattatore equivalente in `src/network/engineAdapter.ts` finché l'engine non lo espone), così nessun client possiede o può vedere le carte in mano o gli obiettivi segreti degli altri giocatori.
4. **Resilienza mobile:** riconnessione automatica quando il telefono va in standby (`visibilitychange`), rientro con lo stesso `playerId`, indicatore di stato connessione e messaggi d'errore chiari in italiano.

## Vincoli
- Nessun server proprio: si usa il broker PeerJS + `BroadcastChannel` per tab locali.
- Nessun testo piccolo: rispetta la scala tipografica dello Step 1.
- **Lavora in loop continuo:** verifica ogni modifica con `npm run build` e `npm run dev`, testa la nuova Home Page e il flusso di creazione/ingresso stanza e non fermarti finché tutto non funziona senza errori.

## Definizione di "fatto"
- [ ] `"Tavolo Multiplayer P2P"` rimosso; nuova Home Page accattivante con introduzione simpatica e leggibile
- [ ] Partita avviabile via link/QR code con lobby chiara
- [ ] I client ricevono solo lo stato filtrato (`getPublicStateFor`) senza mani/obiettivi segreti altrui
- [ ] `npm run build` verde e app funzionante nel browser
