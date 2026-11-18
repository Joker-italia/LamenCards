# 🔍 Audit del Motore di Gioco (`src/engine`) vs GDD Ufficiale v2

> **Data Audit:** Step 1/4 — Verifica completa di conformità tra `KNOWLEDGE.md` (sintesi fedele di `LAMENCARDS – Game Design Document.pdf`) e l'implementazione in `src/engine/**` e `src/data/defaultData.ts`.

---

## 1. Tabella Generale delle Regole di Gioco

| Regola GDD | Stato iniziale | File:riga (pre-refactor) | Nota tecnica e piano di allineamento |
| :--- | :---: | :--- | :--- |
| **Numero giocatori (3–6)** | **OK** | `src/data/defaultData.ts:4-6`, `src/engine/gameEngine.ts:489,526` | Configurati `minPlayers: 3`, `maxPlayers: 6`, più flag `allow2PlayersTestMode` per debug rapido. |
| **Draft: 2 bustine da 5 carte (1 per classe + 1 jolly)** | **OK** | `src/engine/gameEngine.ts:278-309` | `generateBoosterPack` estrae 1 carta per ciascuna delle 4 classi (`Dormienti`, `Utenti`, `Festaioli`, `Scrocconi`) + 1 carta jolly non duplicata nella bustina. |
| **Draft: scelta 4 titolari + 2 riserve (4 scartate)** | **OK** | `src/engine/gameEngine.ts:588-632,698-748` | Ogni giocatore seleziona `teamSize = 4` titolari (mano coperta) e `reserveSize = 2` riserve (che vanno scoperte nel Mercato); le altre 4 carte non entrano in partita. |
| **Draft: scambi liberi prima della conferma** | **OK** | `src/engine/gameEngine.ts:644-696` | Azioni `PROPOSE_DRAFT_TRADE`, `ACCEPT_DRAFT_TRADE`, `REJECT_DRAFT_TRADE` permettono scambi 1-a-1 tra i pool pescati prima della conferma squadra. |
| **Gettoni iniziali (proposta: 3)** | **OK** | `src/data/defaultData.ts:13`, `src/engine/gameEngine.ts:497,551` | `startingTokens: 3` configurabile in `GameConfig`. |
| **Obiettivi: pesca 2, tienine 1 coperta** | **Diversa dal GDD** | `src/data/defaultData.ts:679-755`, `src/engine/gameEngine.ts:726-730` | La pesca di 2 carte Obiettivo e la scelta di 1 coperta (`PICK_OBJECTIVE`) sono conformi. Tuttavia `DEFAULT_OBJECTIVES` contiene 10 carte (i 6 esempi del GDD + 4 varianti specifiche per classe `obj-7..10`); inoltre per i bot l'obiettivo veniva pre-assegnato saltando `OBJECTIVE_PICK`. |
| **Tiro dei dadi: 5 dadi fino a 3 volte tenendo i dadi desiderati** | **OK** | `src/engine/gameEngine.ts:453-463,782-810` | Il 1° tiro avviene all'inizio del turno (`rollsLeft = maxRolls - 1 = 2` ritiri disponibili, totale 3 tiri). `TOGGLE_KEEP_DIE` blocca/sblocca i dadi tra un tiro e l'altro. |
| **Fasi del turno (`ROLLING` → `ACTION_DECISION` → `POST_ACTION`)** | **Mancante / Parziale** | `src/engine/types.ts:204`, `src/engine/gameEngine.ts:463,867,929` | `turnStep` passava da `ROLLING` direttamente a `POST_ACTION` senza passare per `ACTION_DECISION` e mancava l'azione esplicita `CONFIRM_DICE_ROLL` per confermare i dadi prima di scegliere tra *Gioca* e *Incassa*. *(Sistemato in Step 1–3)*. |
| **Tabella Costo → Combinazione (2=Coppia, 3=Doppia coppia, 4=Scala di 4, 5=Full, 6=Poker)** | **OK** | `src/data/defaultData.ts:28-34`, `src/engine/dice.ts:26-72,94-122` | La tabella di default rispetta fedelmente il GDD v2 (Scala di 4 al costo 4). `evaluateDiceCombos` gestisce 4 e 5 dadi. |
| **Azione Principale: Gioca oppure Incassa (1 + 1 per ogni 5 o 6)** | **OK** | `src/engine/dice.ts:78-88`, `src/engine/gameEngine.ts:853-989` | `CASH_IN_DICE` assegna `1 + count(5,6)` (o `1 + count(6)` se configurato `ONLY_SIX` / `SIX_ONLY`). `PLAY_CARD` verifica costo in gettoni e combinazione di dadi. |
| **Mercato: riserve scoperte al centro, scambio con carta in mano pagando gettoni** | **Parziale** | `src/engine/gameEngine.ts:991-1054` | Presente `MARKET_SWAP`, ma mancavano le opzioni granulari di timing (`BEFORE_ROLL` \| `AFTER_ACTION` \| `ANYTIME_IN_TURN`) e separazione esplicita tra costo (`marketSwapPrice`) e consumo azione (`marketSwapConsumesAction`). *(Completato in Step 3)*. |
| **Trattativa: max 1 offerta/turno, vietata a 1 carta dalla vittoria, vietato comprare carte giocate** | **Parziale** | `src/engine/gameEngine.ts:1056-1160` | Rispettati i vincoli (max 1 offerta, blocco a `played.length >= teamSize - 1`, solo carte in mano non giocate, protezione *Il Piumone*), ma `tradeRequiresCardSwap` (`tradeRequiresCardBack`) era sempre forzato a `true` anziché rispettare il booleano in `GameConfig`, e mancava il controllo anti-doppione nella squadra di chi compra/vende. *(Completato in Step 3)*. |
| **Personaggi doppi (Blocco in campo e unicità in squadra)** | **OK** | `src/engine/gameEngine.ts:67-93,605-619,1016-1029` | Impedito avere 2 copie della stessa carta in squadra; la prima copia giocata blocca le altre copie finché resta in gioco e si sblocca se torna in mano (*Lo Sfratto*). Supportate le opzioni `blockScope` (`SAME_CARD` \| `SAME_PERSON`) e `allowMultipleVersionsSamePerson`. |
| **Condizione di Vittoria: 4 carte in gioco E Obiettivo rispettato** | **OK** | `src/engine/objectives.ts:9-105`, `src/engine/gameEngine.ts:324-336,975-987` | `checkWinner` verifica `played.length >= teamSize` e la regola dell'Obiettivo del giocatore dopo ogni giocata e a fine turno. |
| **Determinismo e assenza di `Math.random()` / `Date.now()`** | **Mancante** | `src/engine/dice.ts:15`, `src/engine/gameEngine.ts:24,37,52,307` | Erano presenti `Math.random()` per dadi, shuffle e ID, e `Date.now()` per log e ID. *(Rimosso in Step 1 con PRNG deterministico `mulberry32` in `src/engine/rng.ts`)*. |
| **Visibilità pubblica/privata (`getPublicStateFor`) e `validateAction`** | **Mancante** | `src/engine/gameEngine.ts` | L'engine non esponeva ancora `getPublicStateFor`, `validateAction` e i selettori per la UI. *(Aggiunti in Step 1–3)*. |

---

## 2. Audit Puntuale delle 32 Carte del Set di Prova (GDD §6)

### Classe 1: DORMIENTI (Carte #1 – #8)
| # | Carta (Costo / Tipo) | Testo GDD | Stato iniziale | File:riga | Nota |
| :- | :--- | :--- | :---: | :--- | :--- |
| 1 | **Il Pisolino** (2, Aiuto) | Quando entra: prendi 1 gettone. | **OK** | `gameEngine.ts:1301-1311` | Modello `GAIN_TOKENS` (`value: 1`). |
| 2 | **Russa Forte** (2, Ostacolo) | Quando entra: un giocatore a scelta, nel suo prossimo turno, tira i dadi solo 2 volte. | **Parziale** | `gameEngine.ts:1313-1325` | Modello `SET_TARGET_NEXT_ROLLS` (`value: 2`). Se `targetPlayerId` non è passato, deve aprire `pendingChoice` invece di colpire `opponents[0]` in automatico. |
| 3 | **Sveglia alle 7** (3, Aiuto) | Quando entra: prendi 1 gettone. Nel tuo prossimo turno puoi tirare i dadi 4 volte. | **OK** | `gameEngine.ts:1327-1338` | Modello `GAIN_TOKENS_AND_NEXT_ROLLS` (`value: 1, secondaryValue: 4`). |
| 4 | **Il Piumone** (3, Aiuto, Rara) | Finché è in gioco: nessuno può comprarti carte né rimandarti in mano carte già giocate. | **OK** | `gameEngine.ts:95-102,1069,1656` | Modello `PROTECT_FROM_BUY_AND_BOUNCE`. Sostituito helper cablato per nome con `getActiveModifiers`. |
| 5 | **Coma sul Divano** (4, Aiuto) | Finché è in gioco: quando scegli Incassa, prendi 1 gettone in più. | **OK** | `gameEngine.ts:311-322,858` | Modello `CASH_IN_BONUS` (`value: 1`). |
| 6 | **Sonno Contagioso** (4, Caos, Rara) | Quando entra: fino al tuo prossimo turno tutti gli altri tirano con 4 dadi. | **OK** | `gameEngine.ts:342-352,441-450,1340-1350` | Modello `OTHERS_FOUR_DICE_ONE_ROUND`. Dura fino all'inizio del prossimo turno di chi l'ha giocata. |
| 7 | **Il Letargo** (5, Ostacolo, Rara) | Quando entra: un giocatore a scelta salta il suo prossimo turno. | **Parziale** | `gameEngine.ts:365-379,1352-1364` | Modello `SKIP_TARGET_NEXT_TURN`. Supportare `pendingChoice` se il bersaglio non è pre-selezionato. |
| 8 | **Il Dormiente Supremo** (6, Aiuto, PROMO) | Finché è in gioco: all'inizio di ogni tuo turno prendi 2 gettoni. | **OK** | `gameEngine.ts:410-419` | Modello `TURN_START_GAIN_TOKENS` (`value: 2`). |

### Classe 2: UTENTI (Carte #9 – #16)
| # | Carta (Costo / Tipo) | Testo GDD | Stato iniziale | File:riga | Nota |
| :- | :--- | :--- | :---: | :--- | :--- |
| 9 | **Giorgio, abile giocatore di carte** (2, Ostacolo) | Quando entra: lancia un dado. Con 1–2 perdi 2 gettoni, con 6 scambi una tua carta non giocata con una non giocata di un avversario. | **Diversa dal GDD** | `gameEngine.ts:1366-1405` | Con 6 scambiava automaticamente `hand.shift()` con `targetPlayer.hand.shift()` senza far scegliere la carta/avversario tramite `pendingChoice` e senza verificare *Il Piumone* o doppioni in squadra. *(Sistemato in Step 2)*. |
| 10 | **Dove ho messo le chiavi?** (2, Ostacolo) | Quando entra: un giocatore a scelta perde 1 gettone, che torna nella scorta. | **Parziale** | `gameEngine.ts:1407-1420` | Modello `LOSE_TARGET_TOKENS` (`value: 1`). Aggiunto supporto `pendingChoice` per la scelta del bersaglio. |
| 11 | **Mariong, re delle Aura Battle** (3, Aiuto, Rara) | Quando entra: lancia 2 dadi. Se la somma è 6 o 7 prendi 4 gettoni, altrimenti 1. | **OK** | `gameEngine.ts:1422-1436` | Modello `ROLL_2D6_JACKPOT_TOKENS` (`value: 4, secondaryValue: 1`). |
| 12 | **Effetto Ritardo** (3, Caos) | Quando entra: tutti, te compreso, lanciano un dado. Chi fa il numero più basso perde 2 gettoni (a pari merito, tutti). | **OK** | `gameEngine.ts:1438-1458` | Modello `ALL_ROLL_LOWEST_LOSES_TOKENS` (`value: 2`). I risultati dei dadi sono registrati anche nello stato per la visibilità pubblica. |
| 13 | **Il Dado Fortunato** (4, Aiuto, Rara) | Finché è in gioco: una volta per turno puoi girare un dado sulla faccia opposta (1↔6, 2↔5, 3↔4). | **OK** | `gameEngine.ts:104-111,830-851` | Modello `FLIP_DIE_OPPOSITE_ONCE_PER_TURN`. Sostituito helper cablato con `getActiveModifiers`. |
| 14 | **Sfattonata Collettiva** (4, Caos) | Quando entra: ogni giocatore passa una sua carta non giocata, a scelta, al giocatore alla sua sinistra. | **Diversa dal GDD** | `gameEngine.ts:1460-1477` | Passava automaticamente la prima carta (`hand.shift()`) invece di far scegliere a ogni giocatore quale carta passare tramite `pendingChoice`. *(Sistemato in Step 2)*. |
| 15 | **La Chiamata Persa** (5, Ostacolo, Rara) | Quando entra: un giocatore a scelta, nel suo prossimo turno, non può scegliere Gioca. | **Parziale** | `gameEngine.ts:189,866,1186,1479-1491` | Modello `FORBID_TARGET_PLAY_NEXT_TURN`. Aggiunto supporto `pendingChoice` se il bersaglio non è passato. |
| 16 | **Il Trip** (6, Caos, PROMO) | Quando entra: fino al tuo prossimo turno le combinazioni dei costi 2 e 6 si scambiano, e così quelle dei costi 3 e 5. | **OK** | `dice.ts:103-112`, `gameEngine.ts:354-363,1493-1503` | Modello `INVERT_COMBO_TABLE_ONE_ROUND`. Scambia i tier 2↔6 e 3↔5 fino al prossimo turno di chi l'ha giocata. |

### Classe 3: FESTAIOLI (Carte #17 – #24)
| # | Carta (Costo / Tipo) | Testo GDD | Stato iniziale | File:riga | Nota |
| :- | :--- | :--- | :---: | :--- | :--- |
| 17 | **Offro Io** (2, Caos) | Quando entra: tutti prendono 1 gettone, tu ne prendi 2. | **OK** | `gameEngine.ts:1505-1521` | Modello `ALL_GAIN_TOKENS_SELF_MORE` (`value: 2, secondaryValue: 1`). |
| 18 | **Il Ritardatario** (2, Aiuto) | Si può giocare senza combinazione di dadi, pagando 3 gettoni invece di 2. Nessun altro effetto. | **OK** | `gameEngine.ts:132-135,222-226,913-919` | Modello `NO_COMBO_ALTERNATE_COST` (`value: 3`). |
| 19 | **Il PR** (3, Aiuto) | Quando entra: prendi 1 gettone. Il tuo prossimo scambio col Mercato è gratis. | **OK** | `gameEngine.ts:1523-1534` | Modello `GAIN_TOKENS_AND_FREE_MARKET` (`value: 1`). |
| 20 | **Giro di Shot** (3, Caos, Rara) | Quando entra: ogni altro giocatore sceglie se darti 1 gettone o tirare con 4 dadi nel suo prossimo turno. | **Diversa dal GDD** | `gameEngine.ts:1536-1557` | Obbligava automaticamente chi aveva ≥1 gettone a pagare senza poter scegliere di tirare con 4 dadi. *(Sistemato in Step 2 con `pendingChoice` per ogni avversario)*. |
| 21 | **Anima della Festa** (4, Aiuto) | Finché è in gioco: quando un altro giocatore gioca una carta, prendi 1 gettone (massimo 2 per giro). | **OK** | `gameEngine.ts:382,944-968` | Modello `ON_OTHER_PLAY_GAIN_TOKEN` (`value: 1, secondaryValue: 2`). |
| 22 | **Il DJ** (4, Caos, Rara) | Quando entra: a partire da te, ogni giocatore può scambiare gratis una sua carta non giocata con una del Mercato. | **Diversa dal GDD** | `gameEngine.ts:1559-1571` | Incrementava solo `freeMarketSwapsCount` a tutti invece di permettere lo scambio gratuito in ordine di turno a partire da chi gioca *Il DJ* tramite `pendingChoice`. *(Sistemato in Step 2)*. |
| 23 | **After Party** (5, Aiuto, Rara) | Quando entra: puoi giocare subito un'altra carta pagando i gettoni, senza combinazione di dadi. | **OK** | `gameEngine.ts:200-209,923-924,1573-1583` | Modello `PLAY_EXTRA_CARD_NO_COMBO`. |
| 24 | **Lo Sponsor** (6, Aiuto, PROMO) | Finché è in gioco: le tue carte costano 1 gettone in meno e chiedono la combinazione del costo inferiore. | **OK** | `gameEngine.ts:113-139,154` | Modello `DISCOUNT_COST_AND_COMBO_TIER` (`value: 1`). Sostituito helper cablato con `getActiveModifiers`. |

### Classe 4: SCROCCONI (Carte #25 – #32)
| # | Carta (Costo / Tipo) | Testo GDD | Stato iniziale | File:riga | Nota |
| :- | :--- | :--- | :---: | :--- | :--- |
| 25 | **Lo Scroccone** (2, Ostacolo) | Quando entra: ruba 1 gettone a un giocatore. | **Parziale** | `gameEngine.ts:1585-1599` | Modello `STEAL_TOKENS` (`value: 1`). Aggiunto supporto `pendingChoice` se il bersaglio non è passato. |
| 26 | **Mi Presti 2 Euro?** (2, Ostacolo) | Quando entra: prendi 2 gettoni da un giocatore. All'inizio del tuo prossimo turno gliene restituisci 1. | **Parziale** | `gameEngine.ts:387-404,1601-1621` | Modello `BORROW_TOKENS_REPAY_NEXT_TURN` (`value: 2, secondaryValue: 1`). Aggiunto supporto `pendingChoice` se il bersaglio non è passato. |
| 27 | **Il Ladro di Patatine** (3, Ostacolo) | Quando entra: ruba 2 gettoni a un giocatore. | **Parziale** | `gameEngine.ts:1585-1599` | Modello `STEAL_TOKENS` (`value: 2`). Aggiunto supporto `pendingChoice` se il bersaglio non è passato. |
| 28 | **L'Imbucato** (3, Aiuto, Rara) | Quando entra: prendi gratis una carta dal Mercato al posto di una tua carta non giocata, che va nel Mercato. | **Parziale** | `gameEngine.ts:1623-1633` | Modello `FREE_IMMEDIATE_MARKET_SWAP`. Aggiunto `pendingChoice` per selezionare subito la carta dalla mano e dal Mercato (oltre a supportare `MARKET_SWAP` gratuito). |
| 29 | **Il Parassita** (4, Aiuto) | Finché è in gioco: quando il giocatore alla tua sinistra sceglie Incassa, prendi 1 gettone dalla scorta. | **OK** | `gameEngine.ts:878-899` | Modello `LEFT_NEIGHBOR_CASH_IN_BONUS` (`value: 1`). |
| 30 | **Il Ficcanaso** (4, Ostacolo, Rara) | Quando entra: guarda l'Obiettivo di un giocatore e rubagli 1 gettone. | **Parziale** | `gameEngine.ts:1635-1652` | Modello `PEEK_OBJECTIVE_AND_STEAL` (`value: 1`). Aggiunto supporto `pendingChoice` se il bersaglio non è passato. |
| 31 | **Lo Sfratto** (5, Ostacolo, Rara) | Quando entra: rimanda in mano a un giocatore una sua carta in gioco di costo 4 o meno. | **Parziale** | `gameEngine.ts:1654-1682` | Modello `RETURN_PLAYED_CARD` (`value: 4`). Rispetta *Il Piumone* e sblocca eventuali copie bloccate. Aggiunto `pendingChoice` per scegliere bersaglio e/o carta giocata quando ci sono più scelte valide. |
| 32 | **Il Mantenuto** (6, Ostacolo, PROMO) | Finché è in gioco: all'inizio di ogni tuo turno ruba 1 gettone al giocatore che ne ha di più. | **Parziale** | `gameEngine.ts:420-437` | Modello `TURN_START_STEAL_FROM_RICHEST` (`value: 1`). Il caso di pareggio tra più giocatori con il massimo di gettoni non è specificato nel GDD: reso configurabile (`richestTiePolicy`). |

---

## 3. Domande per il Team (Casi non coperti o ambigui nel GDD)

Tutti i punti seguenti non sono specificati univocamente nel GDD v2; in conformità alla Regola d'Oro (`AI_PROMPT.md`), **non sono state inventate regole fisse**, ma è stata implementata la lettura più letterale con un'**opzione configurabile in `GameConfig`**:

1. **#32 *Il Mantenuto* — Pareggio sul "giocatore che ne ha di più":**
   - *Domanda:* Se all'inizio del turno due o più avversari sono a pari merito per il maggior numero di gettoni, chi perde il gettone? E se il giocatore con più gettoni al tavolo è proprio il proprietario de *Il Mantenuto*, si considera il più ricco tra gli *altri* giocatori o non si ruba nulla?
   - *Opzione in `GameConfig`:* `richestTiePolicy: 'FIRST_CLOCKWISE' | 'CHOOSE'` (default `'FIRST_CLOCKWISE'` a partire dalla sinistra del giocatore attivo, considerando gli avversari con almeno 1 gettone).
2. **#26 *Mi Presti 2 Euro?* — Bersaglio con 1 solo gettone (o 0):**
   - *Domanda:* Se il giocatore scelto ha solo 1 gettone (quindi prendi 1 gettone invece di 2), all'inizio del tuo prossimo turno devi comunque restituirgli 1 gettone (guadagno netto 0) o il debito scatta solo se hai preso effettivamente 2 gettoni?
   - *Lettura letterale implementata:* Se prendi almeno 1 gettone (`taken > 0`), all'inizio del prossimo turno restituisci `min(tokens, 1)` gettone.
3. **#9 *Giorgio, abile giocatore di carte* — Risultato 6 sul dado:**
   - *Domanda:* Con il 6 ("scambi una tua carta non giocata con una non giocata di un avversario"), chi sceglie la carta dell'avversario (dato che le carte in mano sono coperte)? Si pesca una carta casuale dalla mano dell'avversario scelto o l'avversario/Giorgio la sceglie? Inoltre, *Il Piumone* protegge anche dallo scambio di *Giorgio*?
   - *Implementazione:* Chi gioca *Giorgio* sceglie la propria carta in mano e l'avversario bersaglio (escludendo chi è protetto da *Il Piumone* se configurato); se non è specificata una carta bersaglio, viene scambiata una carta dalla mano dell'avversario senza violare il divieto di carte duplicate in squadra.
4. **#14 *Sfattonata Collettiva* — Giocatori senza carte in mano o doppioni ricevuti:**
   - *Domanda:* Se un giocatore ha 0 carte non giocate in mano (es. in varianti di regole) o se passando una carta a sinistra il destinatario riceve una copia di una carta che ha già in squadra (in mano o già giocata), come si gestisce?
   - *Implementazione:* Ogni giocatore con carte in mano sceglie quale carta passare al primo giocatore alla sua sinistra che partecipa al passaggio; se una carta creerebbe un doppione illegale, si preferisce una carta non duplicata quando disponibile.
5. **#22 *Il DJ* — Tempistica dello scambio gratuito col Mercato:**
   - *Domanda:* Il testo dice *"Quando entra: a partire da te, ogni giocatore può scambiare gratis una sua carta non giocata con una del Mercato"*. Lo scambio avviene immediatamente in sequenza (prima tu, poi in senso orario ciascun giocatore sceglie se scambiare una carta col Mercato oppure passare) o fornisce un buono scambio gratuito da usare nel proprio turno?
   - *Implementazione:* Entrambe le modalità sono supportate! Tramite `pendingChoice` sequenziale (a partire da chi gioca *Il DJ*, ogni giocatore può subito scegliere una carta dalla mano e una dal Mercato oppure passare `"SKIP"`), e se un giocatore usa l'azione `MARKET_SWAP` direttamente viene comunque supportato.
6. **#21 *Anima della Festa* — Definizione di "massimo 2 per giro":**
   - *Domanda:* Il limite di 2 gettoni "per giro" si azzera all'inizio di ogni turno del proprietario di *Anima della Festa* (1 giro completo del tavolo dal suo punto di vista) oppure quando `turnNumber` incrementa (inizio turno del giocatore #1)?
   - *Implementazione:* Si azzera all'inizio del turno del proprietario di *Anima della Festa* (`setupTurnForPlayer`), così ogni proprietario ha esattamente lo stesso tetto di 2 attivazioni tra un proprio turno e il successivo indipendentemente dalla sua posizione al tavolo.
7. **#24 *Lo Sponsor* — Combinazione del costo inferiore per carte di costo 2:**
   - *Domanda:* Le carte di costo 2 scontate da *Lo Sponsor* costano 1 gettone; per la combinazione di dadi ("chiedono la combinazione del costo inferiore"), il minimo resta *Una coppia* (costo 2) oppure non richiedono alcuna combinazione?
   - *Opzione in `GameConfig`:* Di default il tier minimo nella tabella combinazioni è `2` (*Una coppia*, probabilità ~100% in 3 tiri).
8. **Gerarchia delle combinazioni di dadi (Poker / Full / 5 dadi uguali):**
   - *Domanda:* Un Poker (es. `4-4-4-4-2`) soddisfa anche `Doppia coppia` (visto che contiene due coppie di 4)? E 5 dadi uguali (`5-5-5-5-5`) soddisfano anche `Full`, `Poker`, `Tris`, `Doppia coppia` e `Una coppia`?
   - *Implementazione in `dice.ts`:* Sì (`maxSame >= 4` include `TWO_PAIR` e `ONE_PAIR`; `maxSame >= 5` include `FULL_HOUSE`, `FOUR_OF_A_KIND`, `THREE_OF_A_KIND`, `TWO_PAIR`, `ONE_PAIR`).
9. **Mazzo Obiettivi — 6 esempi GDD vs 10 carte in `defaultData.ts`:**
   - *Domanda:* Il GDD (§1 e §4) indica "10–15 carte Obiettivo" e ne elenca 6 come esempi. Le 4 carte aggiuntive in `DEFAULT_OBJECTIVES` (`obj-7..10`: almeno 2 carte di una specifica classe) vanno mantenute nel mazzo standard?
   - *Implementazione:* Mantenute in `DEFAULT_OBJECTIVES` (totale 10 carte come da §1 "10–15 carte"), tutte valutate da `evaluateObjective`.
