# 📱 Guida Test Multiplayer P2P a Stanze (`TEST_P2P.md`)

> Come testare le stanze multiplayer Peer-to-Peer di **LAMENCARDS** sia in locale (multi-scheda) sia su smartphone reali (**iOS Safari** e **Android Chrome**).

---

## 1. Test Rapido su un Singolo Dispositivo (Multi-Tab `BroadcastChannel`)
1. Avvia il server di sviluppo con `npm run dev` (o apri l'app pubblicata su GitHub Pages).
2. Nella **Tab 1 (Host)**:
   - Inserisci il tuo soprannome (es. *Giorgio*) e premi **"🏠 Crea Stanza con gli Amici"**.
   - Annota il **Codice Stanza** (es. `K7M4P`) o premi **"🔗 Condividi / Copia Link Invito"**.
3. Apri una **Tab 2** e una **Tab 3** sullo stesso browser incollando il link `?room=K7M4P` (oppure inserendo il codice `K7M4P` nel box *"🔑 Entra con Codice Stanza"*).
4. Ogni scheda riceve un `playerId` indipendente (salvato in `sessionStorage`) e comunica istantaneamente sia tramite `BroadcastChannel` sia tramite WebRTC (`PeerJS`).

## 2. Test su Smartphone Reali (iOS & Android)
1. Assicurati che l'app sia servita su HTTPS (es. GitHub Pages) o sulla stessa rete locale.
2. Sul telefono dell'**Host**:
   - Crea la stanza: comparirà nella Lobby il **QR Code** generato lato client e il pulsante **Condividi Link Invito** (che apre il menu nativo di condivisione WhatsApp/Telegram/AirDrop su iOS e Android).
3. Sui telefoni degli **Amici (3–6 giocatori)**:
   - Inquadra il **QR Code** sullo schermo dell'Host con la fotocamera del telefono oppure apri il link ricevuto.
   - Il codice stanza viene precompilato automaticamente: basta scrivere il proprio nome e toccare **"➔ Entra nella Stanza"**.

## 3. Verifica Privacy e Filtro Stato (`getPublicStateFor`)
- L'Host è l'unica autorità del motore di gioco (`src/engine/gameEngine.ts`).
- Quando lo stato cambia, l'Host invia a ciascun giocatore una vista filtrata con `getPublicStateFor(state, targetPlayerId)`:
  - Ogni giocatore vede in chiaro **solo** la propria mano (`me.hand`) e il proprio Obiettivo coperto (`me.objective`).
  - Degli avversari sono visibili **solo** le informazioni pubbliche: numero di carte in mano (`🃏 N in mano`), gettoni (`🪙`), dadi tirati e tenuti in tempo reale, carte giocate scoperte sul tavolo, scambi col Mercato e offerte di trattativa.
  - L'Obiettivo di un avversario diventa visibile solo se `objectiveVisibility === 'PUBLIC'` oppure se lo si è spiato giocando **Il Ficcanaso**.

## 4. Riconnessione Automatica da Standby Mobile
- Se uno smartphone blocca lo schermo o passa in background (`visibilitychange`), al risveglio `P2PRoomManager` verifica lo stato del canale WebRTC e, se disconnesso, riesegue automaticamente il handshake `HELLO_JOIN` con lo stesso `playerId`, recuperando subito la propria mano e il proprio posto al tavolo.
