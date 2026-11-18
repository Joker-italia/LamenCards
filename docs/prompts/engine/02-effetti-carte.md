# 🧠 ENGINE — Step 2/4: Effetti delle 32 carte come modelli parametrizzati

## Contesto
Sei l'**agent ENGINE** di LAMENCARDS. Lo step 1 ha prodotto `docs/ENGINE_AUDIT.md`, RNG con seed e test Vitest. Leggi `KNOWLEDGE.md` §2, §5, §6. Lavori solo in `src/engine/**`, `src/data/**`, test.

## Obiettivo
Ogni carta del set di prova (32 carte, 8 per classe, costi `2,2,3,3,4,4,5,6`) deve funzionare **esattamente come scritto nel GDD**, tramite **modelli di effetto con parametri** (non `if (card.name === ...)`).

## Compiti
1. **Catalogo modelli:** rivedi `EffectTemplateId` / `EffectModel` in `types.ts`. Ogni modello ha: `timing` (`ON_ENTER` | `WHILE_IN_PLAY`), `category` (`Aiuto` | `Ostacolo` | `Caos`), parametri tipizzati (es. `{ amount: 2 }`, `{ target: 'CHOSEN_PLAYER' }`). L'editor carte (UI) deve poter creare nuove carte combinando modelli e parametri senza codice.
2. **Rimuovi gli effetti cablati per nome** (es. `isPlayerProtectedByPiumone`, `getLoSponsorDiscount`, `hasLuckyDieInPlay`): sostituiscili con funzioni generiche basate sul modello (es. `getActiveModifiers(player)`), mantenendo eventuali alias deprecati per non rompere la UI.
3. **Effetti che richiedono scelte** (bersaglio, carta da passare, dado da girare, scelta "dai 1 gettone o tira con 4 dadi"): modellali come **scelte in sospeso** nello stato (`pendingChoice` con chi deve scegliere, tipo di scelta, opzioni valide e cosa è visibile pubblicamente agli altri giocatori durante l'attesa) risolte da una `GameAction` dedicata. Così funzionano sia per umani via P2P sia per i bot.
4. **Effetti con durata** ("nel suo prossimo turno", "fino al tuo prossimo turno", "all'inizio del tuo prossimo turno restituisci 1"): gestiscili con modificatori a scadenza agganciati all'inizio/fine turno del giocatore corretto.
5. **Casi delicati da testare uno per uno:** *Il Trip* (scambio combinazioni 2↔6 e 3↔5), *Lo Sponsor* (costo −1 **e** combinazione del costo inferiore), *After Party* (seconda carta senza dadi), *Il Ritardatario* (giocabile senza dadi pagando 3), *Lo Sfratto* (sblocca la carta per gli altri), *Il Piumone* (protezione da acquisti e Sfratto), *Anima della Festa* (max 2 per giro), *Il Mantenuto* (pareggi sul "chi ne ha di più" → domanda per il team se non definito), *Mi Presti 2 Euro?* (debito).
6. **Test:** almeno **un test per ciascuna delle 32 carte**, con seed fisso, che verifichi lo stato prima/dopo.
7. **Dati:** allinea `src/data/defaultData.ts` ai testi esatti del GDD (nome, classe, costo, tipo, testo conciso e leggibile).

## Vincoli
- Gettoni presi "dalla scorta" vs "rubati a un giocatore" sono diversi: rispettali.
- Se un testo è ambiguo, non decidere: aggiungi la domanda in `docs/ENGINE_AUDIT.md` e implementa la lettura più letterale come **opzione configurabile** in `GameConfig`.
- Ogni cambio di tipo condiviso → `docs/CHANGELOG_ENGINE.md`.
- **Lavora in loop continuo:** implementa, testa con `npm test` e `npm run build`, correggi ogni fallimento e non fermarti finché tutte le 32 carte non passano i test e l'app gira senza errori.

## Definizione di "fatto"
- [ ] 32/32 carte implementate tramite modelli, 32/32 test verdi
- [ ] Nessuna logica basata sul nome della carta
- [ ] `pendingChoice` documentato per l'agent UI nel CHANGELOG
- [ ] `npm test` e `npm run build` verdi
