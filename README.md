# 🃏 LAMENCARDS — Gioco di Carte degli Amici

Web App di test, bilanciamento, Editor Carte e Simulatore per **LAMENCARDS** (stile *Caramella*, ispirato alle Lamincards dei primi anni 2000).

## 📚 Documentazione e Fonti di Verità
- **[LAMENCARDS – Game Design Document.pdf](./LAMENCARDS%20%E2%80%93%20Game%20Design%20Document.pdf)** — Il Game Design Document ufficiale.
- **[KNOWLEDGE.md](./KNOWLEDGE.md)** — Base di conoscenza completa (stile grafico, regole confermate, spacchettamento 2×5 carte, architettura P2P a stanze, opzioni configurabili).
- **[AI_PROMPT.md](./AI_PROMPT.md)** — Prompt di sistema per allineare qualsiasi assistente AI al progetto.
- **[data/game_config.template.json](./data/game_config.template.json)** — Configurazione JSON del regolamento e dei segnaposto configurabili.

## 🏗️ Architettura del Progetto
Il codice è diviso in tre livelli separati:
- **`src/engine/`** — Motore puro e deterministico delle regole (`types.ts`, `dice.ts`, `objectives.ts`, `gameEngine.ts`, `botSimulator.ts`), completamente separato dall'interfaccia grafica.
- **`src/network/p2pRoom.ts`** — Sistema di stanze Peer-to-Peer (WebRTC `PeerJS` + `BroadcastChannel`) compatibile con iOS (Safari) e Android (Chrome): un dispositivo fa da **Host** e gli altri entrano tramite Codice Stanza o Link invito.
- **`src/ui/`** — Interfaccia mobile-first in stile **Caramella** (`#fffdf6` crema, `#2b2350` blu notte, `#bff0da` verde menta, `#ea5444` corallo), con Spacchettamento di 2 bustine da 5 carte, Editor delle Carte integrato e Pannello Regole Configurabili + Simulatore Bot.

## 🚀 Avvio Locale e Deploy
```bash
npm install
npm run dev      # Avvia il server di sviluppo
npm run build    # Compila il pacchetto statico in dist/ per GitHub Pages
```
