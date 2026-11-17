# 🧠 Knowledge Base — LAMENCARDS (Allineata al GDD Ufficiale)

> **FONTE DI VERITÀ:** Questo documento sintetizza fedelmente il file [`LAMENCARDS – Game Design Document.pdf`](./LAMENCARDS%20%E2%80%93%20Game%20Design%20Document.pdf) e le direttive architetturali del team.
> **REGOLA D'ORO:** Non inventare mai regole nuove non coperte dal GDD. Tutto ciò che il GDD segna come *"da definire"* o *"in forse"* deve essere implementato come **opzione configurabile** e ogni caso ambiguo non coperto dal GDD va chiesto al team prima di decidere.

---

## 1. Modalità di Gioco Digitale & Architettura Multiplayer
- **Multiplayer Peer-to-Peer (P2P) a Stanze (NO Pass & Play):**
  - Ogni giocatore usa **il proprio smartphone (iOS / Safari e Android / Chrome)** collegandosi allo stesso indirizzo web (ospitato su **GitHub Pages**).
  - **Architettura Host / Client P2P (WebRTC):** Un giocatore crea la stanza e fa da **Host** (detiene il motore delle regole e sincronizza la partita), mentre gli altri giocatori entrano nella stanza tramite **Codice Stanza / Link / QR Code**.
  - Ogni dispositivo vede in tempo reale il tavolo comune (Mercato, gettoni, dadi lanciati, carte scoperte avversarie) e vede in privato le proprie carte coperte, lo spacchettamento delle bustine e il proprio Obiettivo.
- **Giocatori:** Da **3 a ~6 giocatori** (con supporto a 2 giocatori o aggiunta di **Bot** per test e simulazioni).
- **Durata indicativa:** 20–40 minuti (da verificare con i test e col simulatore).
- **Condizione di Vittoria:** Vince il primo giocatore che ha **tutte e 4 le carte della sua squadra in gioco** (scoperte davanti a sé) **E rispetta il proprio Obiettivo**.

---

## 2. Stile Grafico "Caramella" e Anatomia della Carta

### Formato e Palette Colori
- **Formato:** `63 × 88 mm` (digitale `630 × 880 px`, scala 10 px = 1 mm), angoli molto arrotondati.
- **Palette ufficiale:**
  - **Crema (bordo esterno):** `#fffdf6`
  - **Blu notte (contorni / lineart):** `#2b2350`
  - **Verde menta (sfondo con raggi a sole):** `#bff0da`
  - **Corallo (etichetta nome con testo bianco):** `#ea5444`
- **Tipografia:** `Rubik Bubbles` (titoli), `Lilita One` (nomi), `Fredoka Bold` (effetti), `Nunito` (testi).
- **Retro unico:** Pannello marrone sfumato con puntinato da fumetto e medaglione verde lucido centrale con la mascotte del gruppo.

### Campi di una Carta Personaggio (Dati per l'Editor)
1. **Foto:** Amico scontornato con bordo bianco "adesivo" e contorno blu notte (domina la carta).
2. **Nome + Versione:** Nome/soprannome + eventuale versione (es. *"Giorgio Dormiente"*). Lo stesso amico può avere più carte/classi.
3. **Classe:** `Dormienti`, `Utenti`, `PROMO` (e altre aggiungibili). Conta per gli Obiettivi.
4. **Costo:** Da `2` a `6` gettoni (determina anche la combinazione di dadi richiesta per giocarla).
5. **Tipo di Effetto:** `Aiuto`, `Ostacolo` oppure `Caos`.
6. **Effetto (Testo + Modello):** 1–2 righe di testo + modello parametrizzato *(Nota: il documento definitivo con il dettaglio degli effetti verrà fornito a parte; attualmente il sistema supporta i campi dati e segnaposto/modelli base)*.
7. **Rarità e Numero:** `Comune`, `Rara`, `Olografica` (PROMO) + N° nel set. **La rarità è solo estetica/collezionistica e NON incide sulla forza.**

---

## 3. Regolamento del Gioco

### Preparazione (Spacchettamento & Setup Partita)
1. **Spacchettamento Iniziale (Draft / Pack Opening):**
   - All'inizio della partita ogni giocatore riceve **2 pacchetti (bustine) da aprire** sul proprio telefono.
   - Ogni pacchetto contiene **5 carte** (totale: **10 carte** sbustate per giocatore).
2. **Scelta delle 6 carte e Scambi pre-partita:**
   - Dalle carte ottenute (con possibilità facoltativa di **scambiarsi carte liberamente** tra giocatori prima di iniziare), ogni giocatore seleziona **6 carte**: **4 titolari** + **2 riserve**.
3. **Squadra (Mano):** Ognuno tiene davanti a sé, **coperte** (visibili sul proprio telefono), le sue **4 carte titolari**.
4. **Mercato:** Le **2 riserve** di ogni giocatore vengono messe al centro del tavolo comune, **scoperte**.
5. **Gettoni iniziali:** Ognuno riceve i gettoni iniziali (proposta base: `3`, configurabile).
6. **Obiettivo:** **Solo ora** (a squadre già decise), ogni giocatore pesca **2 carte Obiettivo** sul proprio dispositivo, ne tiene **1** e scarta l'altra.

### Struttura del Turno (Senso Orario)
1. **Fase 1 — Tiro dei Dadi:**
   - Il giocatore di turno tira i **5 dadi fino a 3 volte** (dopo il 1° e 2° tiro sceglie quali dadi tenere e quali ritirare).
2. **Fase 2 — Scelta Principale (UNA delle due):**
   - **Opzione A — GIOCA:** Sceglie una carta dalla propria squadra (mano coperta), **paga il suo costo in gettoni** e mostra la **combinazione di dadi richiesta** da quel costo. La carta viene messa **scoperta in gioco** davanti a sé.
   - **Opzione B — INCASSA:** Prende **1 gettone base + 1 gettone per ogni dado che mostra `5` o `6`**.
3. **Fase 3 — Trattativa / Acquisto tra giocatori (facoltativa):**
   - Nel proprio turno si può fare **una sola offerta** in gettoni per comprare una carta **non ancora giocata** da un altro giocatore (notifica P2P inviata al telefono del destinatario).
   - L'altro giocatore sceglie dal suo telefono se accettare o rifiutare.
   - Se accetta, l'offerente paga i gettoni pattuiti e gli dà in cambio una propria carta non giocata (così entrambi restano con 4 carte totali — *configurabile*).
   - **Restrizioni sugli Acquisti:**
     - **Chi è a 1 carta dalla vittoria (3 carte già in gioco su 4) NON può comprare**, così nessuno chiude la partita coi soldi.
     - **Le carte già giocate in campo NON si possono comprare.**

### Mercato (Centro Tavolo)
- Nel proprio turno si può scambiare una propria carta non ancora giocata con una delle carte scoperte del Mercato pagando gettoni; la carta ceduta resta scoperta nel Mercato. *(Prezzo e momento esatto del turno: configurabili).*

### Tabella Combinazioni Dadi per Costo (Configurabile)
| Costo Carta | Gettoni Richiesti | Combinazione dei 5 dadi richiesta (Default GDD) |
| :---: | :---: | :--- |
| **2** | 2 gettoni | **Una coppia** (es. due dadi uguali) |
| **3** | 3 gettoni | **Doppia coppia** (due coppie diverse) |
| **4** | 4 gettoni | **Tris** (tre dadi uguali) |
| **5** | 5 gettoni | **Full** (Tris + Coppia) *oppure* **Scala di 4** (es. 1-2-3-4, 2-3-4-5, 3-4-5-6) |
| **6** | 6 gettoni | **Poker** (quattro dadi uguali) *oppure* **Scala di 5** (1-2-3-4-5 o 2-3-4-5-6) |

---

## 4. Carte di Prova e Obiettivi (Dal GDD)

*(Nota: gli effetti definitivi delle carte verranno forniti in un documento dedicato; queste 12 carte del GDD fungono da catalogo iniziale modificabile nell'Editor).*

### Set Iniziale di 12 Carte (Dal GDD)
| # | Nome Carta (Esempio) | Classe | Costo | Tipo | Testo Effetto (GDD Provvisorio) |
| :- | :--- | :--- | :---: | :--- | :--- |
| 1 | **Il Caffè Doppio** | Utenti | 2 | Aiuto | Quando entra in gioco: prendi 2 gettoni. |
| 2 | **Giorgio, abile giocatore di carte** | Utenti | 2 | Ostacolo | Quando entra in gioco: lancia un dado. Con 1–2 perdi 2 gettoni, con 6 scambi una tua carta non giocata con una non giocata di un avversario. |
| 3 | **Il Pisolino Strategico** | Dormienti | 3 | Aiuto | Finché è in gioco, quando scegli Incassa prendi 1 gettone in più. |
| 4 | **Quello che si addormenta sul divano** | Dormienti | 3 | Caos | Fino al tuo prossimo turno tutti tirano con 4 dadi invece di 5. |
| 5 | **L'amico che si dimentica tutto** | Utenti | 3 | Ostacolo | Scegli un giocatore: nel suo prossimo turno può tirare i dadi solo 2 volte. |
| 6 | **Il Ladro di Patatine** | Utenti | 4 | Ostacolo | Quando entra in gioco: ruba 2 gettoni a un giocatore. |
| 7 | **La Fortuna del Principiante** | Dormienti | 4 | Aiuto | Quando entra in gioco: il tuo prossimo tiro ha un dado jolly che vale il numero che vuoi. |
| 8 | **Cambio di Programma** | PROMO | 4 | Caos | Quando entra in gioco: ogni giocatore pesca 1 Obiettivo e sceglie se tenerlo al posto del suo. |
| 9 | **Il Re della Serata** | Utenti | 5 | Aiuto | Quando entra in gioco: la tua prossima carta costa 2 gettoni in meno. |
| 10 | **Giro di Carte** | PROMO | 5 | Caos | Quando entra in gioco: ogni giocatore passa una carta non giocata al giocatore alla sua sinistra. |
| 11 | **Il Risveglio Brusco** | Dormienti | 6 | Ostacolo | Quando entra in gioco: rimanda in mano a un avversario una sua carta in gioco con costo 4 o meno. |
| 12 | **Il Boss** | Utenti | 6 | Ostacolo | Scegli un giocatore: finché questa carta è in gioco, le sue carte richiedono la combinazione del costo superiore. |

### Esempi di Carte Obiettivo (Dal GDD)
1. **4 classi diverse** in gioco.
2. **Almeno 2 carte della stessa classe** in gioco.
3. **Costo totale della squadra almeno 14**.
4. **Nessuna carta da costo 6**.
5. **Almeno un effetto per ognuno dei tre tipi** (`Aiuto`, `Ostacolo`, `Caos`).
6. **Al massimo una carta PROMO**.

---

## 5. Opzioni "In Forse" e "Da Definire" (Parametri Configurabili)

| Parametro Configurabile | Default / Proposta | Opzioni / Varianti da supportare |
| :--- | :--- | :--- |
| **Bustine iniziali** (`packsPerPlayer`, `cardsPerPack`) | `2` bustine da `5` carte (`10` carte) | Numeri configurabili per il draft iniziale |
| **Gettoni iniziali** (`startingTokens`) | `3` gettoni | Valore numerico configurabile (`0–10`) |
| **Numero di tiri per turno** (`maxRollsPerTurn`) | `3` tiri | Configurabile (`2–4`) |
| **Tiro extra a pagamento** (`paidExtraRoll`) | `Disattivato` | Attivabile: pagare `1` gettone (o `N`) per un 4° tiro |
| **Mercato: prezzo e timing** (`marketPrice`, `marketTiming`) | Da definire (es. `1` gettone) | Prezzo in gettoni (`0–5`); Timing: *Azione gratuita nel turno* vs *Al posto di Gioca/Incassa* |
| **Acquisti tra giocatori: scambio carta** (`tradeRequiresCardSwap`) | Dare 1 carta non giocata in cambio | Opzione A: Scambio carta + gettoni (squadra resta di 4) / Opzione B: Acquisto puro + pesca dal Mercato |
| **Visibilità Obiettivo** (`objectiveVisibility`) | `Coperto` (segreto) | `Coperto` oppure `Scoperto` (visibile a tutti) |
| **Cambio Obiettivo con carte già giocate incompatibili** (`onObjectiveMismatch`) | Da decidere | Opzione A: Riprendere in mano carte giocate / Opzione B: Scambiarle col Mercato / Opzione C: Nessun aiuto automatico |
| **Versioni della stessa persona in squadra** (`uniquePersonPerTeam`) | Max `1` versione per persona | `true` (una sola versione per amico) / `false` (libero) |
| **Tabella combinazioni dadi** (`costCombinationsTable`) | Tabella standard (Costi 2–6) | Mappatura modificabile per testare difficoltà diverse |
