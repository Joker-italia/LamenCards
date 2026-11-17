# 🃏 LAMENCARDS — Gioco di Carte degli Amici

Web App multiplayer P2P di test, bilanciamento, Editor Carte e Simulatore per **LAMENCARDS** (3–6 giocatori).

## 📚 Documentazione e Fonti di Verità
- **[LAMENCARDS – Game Design Document.pdf](./LAMENCARDS%20%E2%80%93%20Game%20Design%20Document.pdf)** — Il Game Design Document ufficiale (11 pagine: regole, tabella dadi, 4 classi, linee guida di bilanciamento e set di prova da 32 carte).
- **[KNOWLEDGE.md](./KNOWLEDGE.md)** — Base di conoscenza completa allineata al GDD (regole confermate, draft con 2 bustine da 5 carte, blocco personaggi doppi, set di 32 carte e opzioni configurabili).
- **[AI_PROMPT.md](./AI_PROMPT.md)** — Prompt di sistema per allineare qualsiasi assistente AI al progetto.
- **[data/game_config.template.json](./data/game_config.template.json)** — Configurazione JSON del regolamento e delle opzioni "in forse / da definire".

## 🏗️ Architettura del Progetto
Il codice è diviso in tre livelli separati:
- **`src/engine/`** — Motore puro e deterministico delle regole (`types.ts`, `dice.ts`, `objectives.ts`, `gameEngine.ts`, `botSimulator.ts`), completamente separato dall'interfaccia grafica.
- **`src/network/p2pRoom.ts`** — Sistema di stanze Peer-to-Peer (WebRTC `PeerJS` + `BroadcastChannel`) compatibile con iOS (Safari) e Android (Chrome): un dispositivo fa da **Host** e gli altri entrano tramite Codice Stanza o Link invito.
- **`src/ui/`** — Interfaccia mobile-first con Spacchettamento di 2 bustine da 5 carte, Editor delle Carte integrato e Pannello Regole Configurabili + Simulatore Bot.

## 🚀 Avvio Locale e Deploy
```bash
npm install
npm run dev      # Avvia il server di sviluppo
npm run build    # Compila il pacchetto statico in dist/ per GitHub Pages
```
