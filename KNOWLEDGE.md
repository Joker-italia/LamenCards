# 🧠 Knowledge Base — LAMENCARDS (Allineata al GDD Ufficiale v2)

> **FONTE DI VERITÀ:** Questo documento sintetizza fedelmente il file [`LAMENCARDS – Game Design Document.pdf`](./LAMENCARDS%20%E2%80%93%20Game%20Design%20Document.pdf) (11 pagine).
> **REGOLA D'ORO:** Non inventare mai regole nuove non coperte dal GDD. Tutto ciò che il GDD segna come *"da definire"* o *"in forse"* deve essere implementato come **opzione configurabile** e ogni caso ambiguo non coperto dal GDD va chiesto al team prima di decidere.

---

## 1. Panoramica, Spirito e Architettura Multiplayer
- **Giocatori:** Da **3 a 6 giocatori**.
- **Durata indicativa:** 20–40 minuti (da verificare nei test).
- **Condizione di Vittoria:** Vince il primo giocatore che riesce a mettere in gioco **tutte e 4 le carte della sua squadra** (scoperte davanti a sé) **E rispetta il proprio Obiettivo**.
- **Modalità Web App di Test (Multiplayer P2P a Stanze):**
  - Ogni giocatore gioca dal proprio smartphone (**iOS** e **Android**) collegandosi allo stesso indirizzo web, dove un giocatore fa da **Host** della stanza e gli altri si connettono via P2P.
  - Il motore delle regole è separato dall'interfaccia grafica per supportare bot e simulazioni automatiche di centinaia di partite.
- **Componenti fisici:**
  - **Carte personaggio:** 4 titolari + 2 riserve per giocatore (scelte dal draft iniziale di 2 bustine da 5 carte).
  - **Carte Obiettivo:** 10–15 carte (decidono come deve essere composta la squadra per vincere).
  - **Gettoni:** Scorta comune (~60 gettoni; l'AURA della prima versione è messa da parte e può essere recuperata solo come tema o nome dei gettoni, non come meccanica).
  - **Dadi a 6 facce:** 5 dadi.
  - **Carta di riferimento:** 1 per giocatore con la tabella `Costo → Combinazione` e il riassunto del turno.

---

## 2. Le Carte Personaggio, le 4 Classi e lo Stile Grafico

### Anatomia della Carta
Ogni carta è un amico e per il gioco porta due informazioni chiave: il **costo in gettoni** e un **effetto**.
1. **Foto:** L'amico scontornato, con bordo bianco "adesivo" (domina la carta).
2. **Nome:** Nome o soprannome, più l'eventuale versione (es. *"Giorgio Dormiente"*).
3. **Classe:** Una delle **4 classi** (`Dormienti`, `Utenti`, `Festaioli`, `Scrocconi`). Conta per gli Obiettivi.
4. **Costo:** Da `2` a `6` gettoni (decide anche la combinazione di dadi richiesta).
5. **Effetto:** Una o due righe di testo, appartenente a uno dei 3 tipi (`Aiuto`, `Ostacolo`, `Caos`).
6. **Rarità e numero:** `Comune`, `Rara`, `Olografica` (`PROMO`) + N° della carta nel set. **La rarità non incide sulla forza:** le carte rare/PROMO hanno lo stesso costo e la stessa forza, ma un effetto più strano o divertente.

### Le 4 Classi e la Rarità PROMO
Le classi sono **4** (due confermate e due con nome provvisorio). **`PROMO` è una rarità (versione olografica di un personaggio), non una classe.**

| Classe / Rarità | Stato | Identità | Cosa fanno gli effetti |
| :--- | :--- | :--- | :--- |
| **Dormienti** | Confermata | Lenti ma solidi | Gettoni nel tempo, protezione, rallentano gli altri |
| **Utenti** | Confermata | Sfattonati: sviste, dimenticanze, caso | Dadi, scommesse, effetti casuali |
| **Festaioli** | Nome provvisorio | L'anima del gruppo | Gettoni a tutti, Mercato, giocare più carte |
| **Scrocconi** | Nome provvisorio | Vivono alle spalle degli altri | Rubano gettoni, prendono carte, spiano |
| *PROMO* | *Rarità* | *Versione olografica di un personaggio* | *Stesso costo e stessa forza, effetto più strano* |

### Stile Grafico "Caramella"
- **Formato:** `63 × 88 mm` (digitale `630 × 880 px`). Il layout attuale è provvisorio e va rifatto attorno a foto, costo ed effetto.
- **Palette:** Crema `#fffdf6` (bordo esterno), Blu notte `#2b2350` (contorno), Verde menta `#bff0da` (sfondo), Corallo `#ea5444` (etichetta nome).

---

## 3. Preparazione (Draft con le Bustine) e Turno di Gioco

### Preparazione (Draft all'inizio di ogni partita)
1. **Bustine:** Ognuno apre **2 bustine da 5 carte**, quindi vede **10 carte**.
   - **Composizione bustina:** Ogni bustina contiene **1 carta per classe** (1 *Dormienti*, 1 *Utenti*, 1 *Festaioli*, 1 *Scrocconi*) più **1 carta jolly di classe a caso** (che può essere rara o olografica). Così ognuno ha **almeno 2 carte per classe**.
2. **Scelta:** Dalle 10 carte ognuno ne tiene **6**: **4 titolari** (la squadra, coperte) e **2 riserve**. Le altre 4 finiscono nella collezione e non si usano in partita.
3. **Scambi liberi (facoltativi):** Prima di confermare, i giocatori possono scambiarsi carte.
4. **Pronti:** Quando tutti hanno confermato, l'host avvia la partita.
5. **Mercato:** Le 2 riserve di ogni giocatore vanno al centro, scoperte.
6. **Gettoni:** Ognuno riceve i gettoni iniziali (proposta: `3`).
7. **Obiettivo:** Ognuno pesca **2 carte Obiettivo**, ne tiene **1 coperta** e scarta l'altra.

### Il Turno (Senso Orario)
1. **Tiro:** Tiri i 5 dadi fino a **3 volte**. Dopo ogni tiro puoi tenere i dadi che vuoi e ritirare gli altri.
2. **Scelta (una delle due):**
   - **Gioca:** Scegli una carta della tua squadra, paghi il suo costo in gettoni e mostri la combinazione di dadi richiesta da quel costo. La carta va scoperta davanti a te e il suo effetto si applica.
   - **Incassa:** Prendi **1 gettone**, più **1 gettone per ogni dado che mostra `5` o `6`** *(rende in media 4,5 gettoni tenendo tutti i 5 e i 6)*.
3. **Trattativa (facoltativa):** Nel tuo turno puoi fare **una sola offerta** per comprare una carta non ancora giocata da un altro giocatore.

### Tabella Combinazione Richiesta per Costo
*(Probabilità stimate su 200.000 turni giocando per quella combinazione; la Scala di 4 ha sostituito il Tris al costo 4 perché il Tris aveva probabilità 74%, quasi identica al 77% della Doppia coppia).*

| Costo | Combinazione dei 5 dadi | Probabilità in 3 tiri (5 dadi) | Note con 4 dadi |
| :---: | :--- | :---: | :--- |
| **2** | **Una coppia** | ~100% | — |
| **3** | **Doppia coppia** | 77% | — |
| **4** | **Scala di 4** | 59% | Scende al **31%** con 4 dadi |
| **5** | **Full** | 37% | — |
| **6** | **Poker** | 29% | Scende al **10%** con 4 dadi |

---

## 4. Obiettivi, Mercato, Acquisti e Personaggi Doppi

### Carte Obiettivo
- Si sceglie **dopo la squadra** (pescane 2, tienine 1 coperta). Per vincere, le tue 4 carte in gioco devono rispettare il tuo Obiettivo.
- **Esempi di Obiettivi:**
  - `4 classi diverse`
  - `Almeno 2 carte della stessa classe`
  - `Costo totale della squadra almeno 14`
  - `Nessuna carta da 6`
  - `Almeno un effetto per ognuno dei tre tipi`
  - `Al massimo una carta PROMO`

### Mercato
- Le carte di riserva di tutti stanno al centro, scoperte.
- Nel tuo turno puoi scambiare una tua carta non ancora giocata con una del Mercato, pagando gettoni. La tua carta resta nel Mercato e può prenderla un altro. *(Prezzo e momento del turno: da definire).*

### Acquisti tra giocatori
- Nel tuo turno puoi fare **una sola offerta** in gettoni per comprare una carta non ancora giocata da un altro giocatore.
- Se l'altro accetta, le carte si scambiano (gli dai una tua carta non giocata in cambio, così la squadra resta di 4 — *da confermare*).
- **Chi è a una carta dalla vittoria non può comprare**, così nessuno chiude la partita con i soldi.
- **Le carte già giocate non si possono comprare.**

### Personaggi doppi (Regola Blocco)
- Lo stesso personaggio può essere nella squadra di più giocatori, ma **in gioco ne entra uno solo: il primo che lo gioca lo blocca per tutti gli altri**.
- **Si blocca la stessa carta:** versioni diverse della stessa persona (es. *Giorgio Dormiente* e *Giorgio Utente*) sono carte diverse, a meno che i test non dicano il contrario.
- **Nella propria squadra non si possono avere due copie della stessa carta** (e da confermare se possa entrare una sola versione per persona).
- **Come sbloccare o sostituire copie bloccate:**
  - Le copie bloccate restano in mano: per completare la squadra chi le ha deve cambiarle col Mercato, con un acquisto o con un effetto.
  - Se la carta in gioco torna in mano al proprietario (es. con *Lo Sfratto*), **si sblocca** e chiunque ne abbia una copia può giocarla.
  - Le copie bloccate si possono comunque vendere o scambiare (valgono meno in trattativa).

---

## 5. Linee Guida Matematiche per il Bilanciamento degli Effetti

- **Momenti degli effetti:**
  - `Quando entra in gioco`: succede una volta, appena la carta viene giocata.
  - `Finché è in gioco`: vale per tutto il tempo in cui la carta resta scoperta davanti a te (si conta come **2–3 usi**, ma può essere rimandata in mano).
- **Unità di misura:** `1 gettone`. Un turno intero vale circa **4,5 gettoni** (quanto rende *Incassa* in media).
- **Budget per costo:** L'effetto vale circa **`costo - 1` gettoni**:
  - Costo 2 → budget `1` | Costo 3 → budget `2` | Costo 4 → budget `3` | Costo 5 → budget `4` | Costo 6 → budget `5`.
- **Valori di riferimento in gettoni:**
  - `+1 gettone` = **1**
  - `Rubare 1 gettone` = **1,5**
  - `Sconto di 1 sul costo` = **1**
  - `Un tiro in più` = **~1**
  - `Un avversario con 4 dadi per un turno` = **~1**
  - `Far saltare un turno` = **~4,5**
  - `Rimandare in mano una carta giocata` = **il suo costo + 1**
- **Malus e dadi:** Una carta con un malus o un tiro di dado rischioso può superare il budget di quanto vale il rischio.
- **Bersagli:** `Ostacolo` colpisce **un solo giocatore scelto**; quello che tocca tutti è `Caos`. Gli effetti che crescono con i giocatori (*"ogni altro giocatore"*) hanno un tetto per non diventare troppo forti in 6.

---

## 6. Set di Prova Ufficiale: 32 Carte (8 per Classe)

Ogni classe ha **8 carte** con la stessa distribuzione di costi: **`2, 2, 3, 3, 4, 4, 5, 6`**. *(Nomi provvisori, tranne Giorgio e Mariong).*

### Classe 1: DORMIENTI (8 carte)
| # | Carta | Costo | Tipo | Effetto |
| :- | :--- | :---: | :--- | :--- |
| 1 | **Il Pisolino** | 2 | Aiuto | Quando entra: prendi 1 gettone. |
| 2 | **Russa Forte** | 2 | Ostacolo | Quando entra: un giocatore a scelta, nel suo prossimo turno, tira i dadi solo 2 volte. |
| 3 | **Sveglia alle 7** | 3 | Aiuto | Quando entra: prendi 1 gettone. Nel tuo prossimo turno puoi tirare i dadi 4 volte. |
| 4 | **Il Piumone** | 3 | Aiuto | Finché è in gioco: nessuno può comprarti carte né rimandarti in mano carte già giocate. |
| 5 | **Coma sul Divano** | 4 | Aiuto | Finché è in gioco: quando scegli Incassa, prendi 1 gettone in più. |
| 6 | **Sonno Contagioso** | 4 | Caos | Quando entra: fino al tuo prossimo turno tutti gli altri tirano con 4 dadi. |
| 7 | **Il Letargo** | 5 | Ostacolo | Quando entra: un giocatore a scelta salta il suo prossimo turno. |
| 8 | **Il Dormiente Supremo** | 6 | Aiuto | Finché è in gioco: all'inizio di ogni tuo turno prendi 2 gettoni. |

### Classe 2: UTENTI (8 carte)
| # | Carta | Costo | Tipo | Effetto |
| :- | :--- | :---: | :--- | :--- |
| 9 | **Giorgio, abile giocatore di carte** | 2 | Ostacolo | Quando entra: lancia un dado. Con 1–2 perdi 2 gettoni, con 6 scambi una tua carta non giocata con una non giocata di un avversario. |
| 10 | **Dove ho messo le chiavi?** | 2 | Ostacolo | Quando entra: un giocatore a scelta perde 1 gettone, che torna nella scorta. |
| 11 | **Mariong, re delle Aura Battle** | 3 | Aiuto | Quando entra: lancia 2 dadi. Se la somma è 6 o 7 prendi 4 gettoni, altrimenti 1. |
| 12 | **Effetto Ritardo** | 3 | Caos | Quando entra: tutti, te compreso, lanciano un dado. Chi fa il numero più basso perde 2 gettoni (a pari merito, tutti). |
| 13 | **Il Dado Fortunato** | 4 | Aiuto | Finché è in gioco: una volta per turno puoi girare un dado sulla faccia opposta (1↔6, 2↔5, 3↔4). |
| 14 | **Sfattonata Collettiva** | 4 | Caos | Quando entra: ogni giocatore passa una sua carta non giocata, a scelta, al giocatore alla sua sinistra. |
| 15 | **La Chiamata Persa** | 5 | Ostacolo | Quando entra: un giocatore a scelta, nel suo prossimo turno, non può scegliere Gioca. |
| 16 | **Il Trip** | 6 | Caos | Quando entra: fino al tuo prossimo turno le combinazioni dei costi 2 e 6 si scambiano, e così quelle dei costi 3 e 5. |

### Classe 3: FESTAIOLI (8 carte — Nome classe provvisorio)
| # | Carta | Costo | Tipo | Effetto |
| :- | :--- | :---: | :--- | :--- |
| 17 | **Offro Io** | 2 | Caos | Quando entra: tutti prendono 1 gettone, tu ne prendi 2. |
| 18 | **Il Ritardatario** | 2 | Aiuto | Si può giocare senza combinazione di dadi, pagando 3 gettoni invece di 2. Nessun altro effetto. |
| 19 | **Il PR** | 3 | Aiuto | Quando entra: prendi 1 gettone. Il tuo prossimo scambio col Mercato è gratis. |
| 20 | **Giro di Shot** | 3 | Caos | Quando entra: ogni altro giocatore sceglie se darti 1 gettone o tirare con 4 dadi nel suo prossimo turno. |
| 21 | **Anima della Festa** | 4 | Aiuto | Finché è in gioco: quando un altro giocatore gioca una carta, prendi 1 gettone (massimo 2 per giro). |
| 22 | **Il DJ** | 4 | Caos | Quando entra: a partire da te, ogni giocatore può scambiare gratis una sua carta non giocata con una del Mercato. |
| 23 | **After Party** | 5 | Aiuto | Quando entra: puoi giocare subito un'altra carta pagando i gettoni, senza combinazione di dadi. |
| 24 | **Lo Sponsor** | 6 | Aiuto | Finché è in gioco: le tue carte costano 1 gettone in meno e chiedono la combinazione del costo inferiore. |

### Classe 4: SCROCCONI (8 carte — Nome classe provvisorio)
| # | Carta | Costo | Tipo | Effetto |
| :- | :--- | :---: | :--- | :--- |
| 25 | **Lo Scroccone** | 2 | Ostacolo | Quando entra: ruba 1 gettone a un giocatore. |
| 26 | **Mi Presti 2 Euro?** | 2 | Ostacolo | Quando entra: prendi 2 gettoni da un giocatore. All'inizio del tuo prossimo turno gliene restituisci 1. |
| 27 | **Il Ladro di Patatine** | 3 | Ostacolo | Quando entra: ruba 2 gettoni a un giocatore. |
| 28 | **L'Imbucato** | 3 | Aiuto | Quando entra: prendi gratis una carta dal Mercato al posto di una tua carta non giocata, che va nel Mercato. |
| 29 | **Il Parassita** | 4 | Aiuto | Finché è in gioco: quando il giocatore alla tua sinistra sceglie Incassa, prendi 1 gettone dalla scorta. |
| 30 | **Il Ficcanaso** | 4 | Ostacolo | Quando entra: guarda l'Obiettivo di un giocatore e rubagli 1 gettone. |
| 31 | **Lo Sfratto** | 5 | Ostacolo | Quando entra: rimanda in mano a un giocatore una sua carta in gioco di costo 4 o meno. |
| 32 | **Il Mantenuto** | 6 | Ostacolo | Finché è in gioco: all'inizio di ogni tuo turno ruba 1 gettone al giocatore che ne ha di più. |

---

## 7. Opzioni "In Forse / Da Definire" e Punti da Tenere d'Occhio nei Test

### Regole Configurabili ("In forse e da definire")
1. **In forse – Tiro extra a pagamento:** pagare 1 gettone per un 4° tiro dei dadi (difficile da bilanciare, per ora escluso).
2. **Gettoni iniziali:** proposta `3`.
3. **Mercato:** prezzo dello scambio e se conta come azione del turno.
4. **Acquisti:** cosa riceve in cambio chi vende, per non restare con meno di 4 carte da giocare.
5. **Cambio Obiettivo:** cosa succede alle carte già giocate quando un effetto cambia l'Obiettivo; Obiettivo coperto o scoperto.
6. **Versioni della stessa persona / Personaggi doppi:** se ne può entrare più di una nella stessa squadra, e se il blocco in campo riguarda solo la stessa identica carta o anche versioni diverse della stessa persona.
7. **Numero di carte Obiettivo e testi definitivi.**
8. **Tabella delle combinazioni:** da verificare con il simulatore.
9. **Durata reale di una partita da 3 a 6 giocatori.**

### Da tenere d'occhio nei test (Watchlist Bilanciamento)
- **Il Letargo** (far saltare un turno) e **After Party** (giocare subito una seconda carta) sono le carte più forti: se dominano, il costo 5 non basta.
- **Incassa** rende in media 4,5 gettoni: se le partite sono troppo veloci, testare l'opzione in cui dà `+1 gettone` solo per ogni `6` invece che per ogni `5 o 6`.
- **Effetti che tolgono un dado:** con 4 dadi il Poker scende dal 29% al 10% e la Scala di 4 dal 59% al 31%.
- **Effetti che crescono col numero di giocatori** (*Giro di Shot*, *Anima della Festa*, *Offro Io*): controllare che non siano troppo forti in 6 o troppo deboli in 3.
- **Personaggi doppi:** capire quanto spesso due giocatori hanno la stessa carta e se il blocco rende la partita più divertente o solo frustrante.
