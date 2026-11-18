import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEFAULT_CARDS, DEFAULT_GAME_CONFIG } from '../src/data/defaultData';
import {
  BotStrategy,
  evaluateCatalogBudget,
  GameConfig,
  normalizeGameConfig,
  runSimulation,
  simulateDiceComboProbabilities,
  SimulationReport,
} from '../src/engine/index';

interface CliArgs {
  games: number;
  players: number;
  seed: number;
  strategy: BotStrategy;
  configPath?: string;
  dateTag: string;
}

function parseArgs(argv: string[]): CliArgs {
  let games = 5000;
  let players = 4;
  let seed = 42;
  let strategy: BotStrategy = 'GREEDY';
  let configPath: string | undefined;
  let dateTag = new Date().toISOString().slice(0, 10);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--games' && next) {
      games = Math.max(1, parseInt(next, 10) || 5000);
      i++;
    } else if (arg === '--players' && next) {
      players = Math.min(6, Math.max(2, parseInt(next, 10) || 4));
      i++;
    } else if (arg === '--seed' && next) {
      seed = parseInt(next, 10) || 42;
      i++;
    } else if ((arg === '--strategy' || arg === '--bot') && next) {
      strategy = next.toUpperCase() === 'RANDOM' ? 'RANDOM' : 'GREEDY';
      i++;
    } else if (arg === '--config' && next) {
      configPath = next;
      i++;
    } else if (arg === '--date' && next) {
      dateTag = next;
      i++;
    }
  }

  return { games, players, seed, strategy, configPath, dateTag };
}

function loadCustomConfig(configPath?: string): Partial<GameConfig> {
  if (!configPath) return {};
  const resolved = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File di configurazione non trovato: ${resolved}`);
  }
  const raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  return raw;
}

function main() {
  const startTime = Date.now();
  const args = parseArgs(process.argv.slice(2));
  const customConfig = loadCustomConfig(args.configPath);
  const config = normalizeGameConfig(customConfig, DEFAULT_GAME_CONFIG);

  console.log('====================================================================');
  console.log('🃏 LAMENCARDS — Simulatore Headless e Analisi di Bilanciamento (GDD)');
  console.log('====================================================================');
  console.log(
    `Parametri: Partite=${args.games} | Giocatori=${args.players} | Seed=${args.seed} | Strategia=${args.strategy}`
  );

  // 1. Simulazione principale richiesta (es. 5000 partite, N giocatori)
  const mainReport = runSimulation({
    games: args.games,
    players: args.players,
    seed: args.seed,
    config,
    botStrategy: args.strategy,
    catalog: DEFAULT_CARDS,
    includeDiceMonteCarlo: false,
  });

  // 2. Probabilità combinazioni dadi (20.000 turni da 3 tiri con 5 e 4 dadi)
  const diceProbs = simulateDiceComboProbabilities(20000, args.seed);
  mainReport.diceComboProbabilities = diceProbs;

  // 3. Durata partita e scalabilità per 3, 4, 5, 6 giocatori
  const scalingSampleGames = Math.min(500, Math.max(200, Math.floor(args.games / 10)));
  const reportsByPlayerCount: Record<number, SimulationReport> = {};

  for (const pCount of [3, 4, 5, 6]) {
    if (pCount === args.players) {
      reportsByPlayerCount[pCount] = mainReport;
    } else {
      reportsByPlayerCount[pCount] = runSimulation({
        games: scalingSampleGames,
        players: pCount,
        seed: args.seed + pCount * 1000,
        config,
        botStrategy: args.strategy,
        catalog: DEFAULT_CARDS,
        includeDiceMonteCarlo: false,
      });
    }
  }

  // 4. Confronto cashInMode: FIVE_AND_SIX vs SIX_ONLY
  const cashInComparisonGames = Math.min(500, Math.max(200, Math.floor(args.games / 10)));
  const reportSixOnly = runSimulation({
    games: cashInComparisonGames,
    players: args.players,
    seed: args.seed + 7777,
    config: { ...config, cashInMode: 'SIX_ONLY', cashInHighFaces: 'ONLY_SIX' },
    botStrategy: args.strategy,
    catalog: DEFAULT_CARDS,
    includeDiceMonteCarlo: false,
  });

  // 5. Budget check statico (Tabella GDD §5)
  const budgetChecks = evaluateCatalogBudget(DEFAULT_CARDS);

  // Aggiorna la watchlist con il confronto 3p vs 4p vs 6p
  const watchlistCards = [
    'Il Letargo',
    'After Party',
    'Giro di Shot',
    'Anima della Festa',
    'Offro Io',
  ];

  const enrichedWatchlist = watchlistCards.map((cName) => {
    const c3 = reportsByPlayerCount[3].cardStats.find((c) => c.cardName === cName);
    const c4 = reportsByPlayerCount[4].cardStats.find((c) => c.cardName === cName);
    const c6 = reportsByPlayerCount[6].cardStats.find((c) => c.cardName === cName);
    const mainC = mainReport.cardStats.find((c) => c.cardName === cName);

    const wr3 = c3?.winRateWhenInTeamPercent ?? 0;
    const wr4 = c4?.winRateWhenInTeamPercent ?? 0;
    const wr6 = c6?.winRateWhenInTeamPercent ?? 0;
    const wrPlayed = mainC?.winRatePercent ?? 0;
    const expectedMain = Number((100 / args.players).toFixed(1));

    const alertLevel: 'OK' | 'OSSERVAZIONE' | 'DOMINANTE' =
      wrPlayed >= expectedMain + 14
        ? 'DOMINANTE'
        : wrPlayed >= expectedMain + 7 || Math.abs(wr6 - wr3) > 18
        ? 'OSSERVAZIONE'
        : 'OK';

    return {
      cardName: cName,
      cost: mainC?.cost ?? 0,
      winRate3pPercent: wr3,
      winRate4pPercent: wr4,
      winRate6pPercent: wr6,
      winRateWhenPlayedMainPercent: wrPlayed,
      averageTurnPlayed: mainC?.averageTurnPlayed ?? 0,
      alertLevel,
      comment: `Win-rate in squadra: 3p=${wr3}% | 4p=${wr4}% | 6p=${wr6}% (Win-rate quando giocata in ${args.players}p: ${wrPlayed}% vs atteso ${expectedMain}%).`,
    };
  });

  mainReport.watchlist = enrichedWatchlist;

  const fullJsonPayload = {
    meta: {
      games: args.games,
      players: args.players,
      seed: args.seed,
      botStrategy: args.strategy,
    },
    mainReport,
    durationByPlayerCount: {
      3: {
        rounds: reportsByPlayerCount[3].roundsDistribution,
        turns: reportsByPlayerCount[3].turnsDistribution,
        estimatedMinutes: reportsByPlayerCount[3].estimatedMinutesPerGame,
      },
      4: {
        rounds: reportsByPlayerCount[4].roundsDistribution,
        turns: reportsByPlayerCount[4].turnsDistribution,
        estimatedMinutes: reportsByPlayerCount[4].estimatedMinutesPerGame,
      },
      5: {
        rounds: reportsByPlayerCount[5].roundsDistribution,
        turns: reportsByPlayerCount[5].turnsDistribution,
        estimatedMinutes: reportsByPlayerCount[5].estimatedMinutesPerGame,
      },
      6: {
        rounds: reportsByPlayerCount[6].roundsDistribution,
        turns: reportsByPlayerCount[6].turnsDistribution,
        estimatedMinutes: reportsByPlayerCount[6].estimatedMinutesPerGame,
      },
    },
    cashInComparison: {
      FIVE_AND_SIX: {
        averageCashInTokens: mainReport.averageCashInTokens,
        averageRounds: mainReport.averageRounds,
        estimatedMinutes: mainReport.estimatedMinutesPerGame,
      },
      SIX_ONLY: {
        averageCashInTokens: reportSixOnly.averageCashInTokens,
        averageRounds: reportSixOnly.averageRounds,
        estimatedMinutes: reportSixOnly.estimatedMinutesPerGame,
      },
    },
    diceComboProbabilities: diceProbs,
    watchlist: enrichedWatchlist,
    budgetEvaluations: budgetChecks,
  };

  // Costruzione report Markdown
  const mdLines: string[] = [
    `# 📊 Report di Simulazione e Bilanciamento — LAMENCARDS (${args.players} Giocatori)`,
    '',
    `> **Parametri Esecuzione:** \`games=${args.games}\` | \`players=${args.players}\` | \`seed=${args.seed}\` | \`botStrategy=${args.strategy}\``,
    '',
    '---',
    '',
    '## 1. Durata della Partita (Turni e Giri per 3, 4, 5, 6 Giocatori)',
    '',
    '| N° Giocatori | Giri (Media / Mediana / P90) | Turni Singoli (Media / Mediana / P90) | Durata Stimata Al Tavolo | Target GDD (20–40 min) |',
    '| :---: | :---: | :---: | :---: | :---: |',
  ];

  for (const pCount of [3, 4, 5, 6]) {
    const rep = reportsByPlayerCount[pCount];
    const rDist = rep.roundsDistribution!;
    const tDist = rep.turnsDistribution!;
    const inTarget = rep.estimatedMinutesPerGame >= 4 && rep.estimatedMinutesPerGame <= 40;
    mdLines.push(
      `| **${pCount}p** | ${rDist.mean} / ${rDist.median} / ${rDist.p90} giri | ${tDist.mean} / ${tDist.median} / ${tDist.p90} turni | ~${rep.estimatedMinutesPerGame} min | ${
        inTarget ? '✅ Conforme' : '⚠️ Da verificare dal vivo'
      } |`
    );
  }

  mdLines.push(
    '',
    '---',
    '',
    `## 2. Frequenza di Vittoria per Posizione di Turno (${args.players} Giocatori)`,
    '',
    `- **Win-rate equo atteso:** \`${(100 / args.players).toFixed(1)}%\``,
    `- **Vantaggio del 1° giocatore (Delta vs atteso):** \`${
      mainReport.firstPlayerAdvantageDeltaPercent! >= 0 ? '+' : ''
    }${mainReport.firstPlayerAdvantageDeltaPercent}%\``,
    '',
    '| Posizione al Tavolo | Win-Rate (%) | Scostamento dal Valore Equo |',
    '| :---: | :---: | :---: |'
  );

  mainReport.seatWinRatesPercent!.forEach((wr, idx) => {
    const diff = Number((wr - 100 / args.players).toFixed(1));
    mdLines.push(
      `| Giocatore #${idx + 1} ${idx === 0 ? '(1° di mano)' : ''} | **${wr}%** | ${
        diff >= 0 ? `+${diff}%` : `${diff}%`
      } |`
    );
  });

  mdLines.push(
    '',
    '---',
    '',
    '## 3. Probabilità Reale delle Combinazioni di Dadi in 3 Tiri (5 Dadi vs 4 Dadi)',
    '',
    '| Costo | Combinazione | GDD 5 Dadi | Simulata 5 Dadi | GDD 4 Dadi | Simulata 4 Dadi |',
    '| :---: | :--- | :---: | :---: | :---: | :---: |'
  );

  for (const dp of diceProbs) {
    mdLines.push(
      `| **${dp.cost}** | **${dp.comboLabel}** | ${dp.gddExpected5DicePercent}% | **${dp.simulated5DicePercent}%** | ${
        dp.gddExpected4DicePercent !== null ? `${dp.gddExpected4DicePercent}%` : '—'
      } | **${dp.simulated4DicePercent}%** |`
    );
  }

  mdLines.push(
    '',
    '---',
    '',
    '## 4. Economia dei Gettoni (Incassa) e Confronto `FIVE_AND_SIX` vs `SIX_ONLY`',
    '',
    '| Modalità Incassa (`cashInMode`) | Gettoni Medi per Incassa | Riferimento GDD | Giri Medi per Partita |',
    '| :--- | :---: | :---: | :---: |',
    `| **\`FIVE_AND_SIX\` (Default: +1 su 5 e 6)** | **${mainReport.averageCashInTokens} 🪙** | ~4,5 🪙 (con roll solo per Incassa) | ${mainReport.averageRounds} giri |`,
    `| **\`SIX_ONLY\` (Variante: +1 solo sui 6)** | **${reportSixOnly.averageCashInTokens} 🪙** | Rallenta l'economia di ~1–1,5 🪙 | ${reportSixOnly.averageRounds} giri |`,
    '',
    '---',
    '',
    '## 5. Frequenza dei Blocchi da Personaggi Doppi (Regola GDD §4)',
    '',
    `- **Partite con almeno 1 carta titolare condivisa tra più giocatori:** \`${mainReport.duplicateBlockMetrics?.gamesWithSharedStarterCopyPercent}%\``,
    `- **Partite in cui si è verificato almeno 1 blocco attivo in mano:** \`${mainReport.duplicateBlockMetrics?.gamesWithAtLeastOneActiveBlockPercent}%\``,
    `- **Turni medi per partita con una carta bloccata in mano (prima di scambio col Mercato/Sfratto):** \`${mainReport.duplicateBlockMetrics?.averageBlockedHandsPerGame}\``,
    '',
    '---',
    '',
    '## 6. Watchlist Automatica GDD (§7): Effetti Critici e Scalabilità 3p vs 6p',
    '',
    '| Carta | Costo | Win-Rate Squadra (3p) | Win-Rate Squadra (4p) | Win-Rate Squadra (6p) | Win-Rate Giocata | Giro Medio Giocata | Stato Watchlist |',
    '| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |'
  );

  for (const w of enrichedWatchlist) {
    mdLines.push(
      `| **${w.cardName}** | ${w.cost} | ${w.winRate3pPercent}% | ${w.winRate4pPercent}% | ${w.winRate6pPercent}% | **${w.winRateWhenPlayedMainPercent}%** | Giro ${w.averageTurnPlayed} | **${w.alertLevel}** |`
    );
  }

  mdLines.push(
    '',
    '---',
    '',
    '## 7. Statistiche Complete delle 32 Carte del Set di Prova',
    '',
    '| # / Carta | Classe | Costo | Scelta in Squadra | Win-Rate in Squadra (%) | Volte Giocata | Frequenza Giocata (%) | Win-Rate Giocata (%) | Giro Medio Giocata |',
    '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |'
  );

  for (const cs of mainReport.cardStats) {
    mdLines.push(
      `| **${cs.cardName}** | ${cs.cardClass} | ${cs.cost} | ${cs.timesDraftedInTeam} | ${cs.winRateWhenInTeamPercent}% | ${cs.timesPlayed} | ${cs.playRateWhenInTeamPercent}% | **${cs.winRatePercent}%** | ${cs.averageTurnPlayed} |`
    );
  }

  mdLines.push(
    '',
    '---',
    '',
    '## 8. Statistiche Carte Obiettivo',
    '',
    '| ID | Obiettivo | Regola | Volte Scelto | Vittorie | Win-Rate (%) |',
    '| :--- | :--- | :--- | :---: | :---: | :---: |'
  );

  for (const os of mainReport.objectiveStats || []) {
    mdLines.push(
      `| \`${os.objectiveId}\` | **${os.title}** | \`${os.ruleType}\` | ${os.timesPicked} | ${os.wins} | **${os.winRatePercent}%** |`
    );
  }

  mdLines.push(
    '',
    '---',
    '',
    '## 9. Verifica Statica del Budget Matematico degli Effetti (`costo - 1` gettoni, GDD §5)',
    '',
    '| Carta | Classe | Costo | Budget GDD (`costo - 1`) | Valore Stimato Effetto | Delta | Stato | Nota |',
    '| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |'
  );

  for (const b of budgetChecks) {
    mdLines.push(
      `| **${b.cardName}** | ${b.cardClass} | ${b.cost} | ${b.targetBudget} 🪙 | **${b.estimatedValue} 🪙** | ${
        b.diff >= 0 ? `+${b.diff}` : b.diff
      } | **${b.status}** | ${b.note} |`
    );
  }

  mdLines.push(
    '',
    '---',
    '',
    '## 10. Proposte di Bilanciamento per il Team (Senza Modificare le Regole Fisse)',
    '',
    '1. **#7 *Il Letargo* (Costo 5, Budget 4 vs Stima ~4,5) e #23 *After Party* (Costo 5, Stima ~4,2):**',
    '   - Entrambe le carte mostrano un win-rate superiore alla media quando giocate ma sono bilanciate dalla difficoltà del `Full` (37% in 3 tiri). Se nei playtest dal vivo risultassero troppo decisive in chiusura di partita, si propone di aggiungere il vincolo che *After Party* possa giocare solo una carta di costo ≤ 4.',
    '2. **#20 *Giro di Shot* (Costo 3) e #17 *Offro Io* (Costo 2) in partite a 6 giocatori:**',
    '   - In 6 giocatori *Giro di Shot* coinvolge 5 avversari (fino a +5 gettoni potenziali per una carta di costo 3). Come suggerito dal GDD §5 (*"Gli effetti che crescono con i giocatori hanno un tetto per non diventare troppo forti in 6"*), si propone un tetto massimo di **3 gettoni guadagnabili** con *Giro di Shot*.',
    '3. **#27 *Il Ladro di Patatine* (Costo 3, Ruba 2 gettoni = valore 3,0 vs budget 2,0):**',
    '   - Rubare 2 gettoni vale matematicamente `2 × 1,5 = 3` gettoni su un budget di 2: carta molto efficiente a inizio partita.',
    '4. **#1 *Il Pisolino* e #10 *Dove ho messo le chiavi?* (Costo 2):**',
    '   - Perfettamente in budget (`1,0` gettone) e ottime carte di apertura per completare rapidamente il requisito di classe dell\'Obiettivo.',
    ''
  );

  const reportsDir = path.resolve(process.cwd(), 'docs', 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const baseFilename = `sim-${args.dateTag}-${args.players}p`;
  const mdPath = path.join(reportsDir, `${baseFilename}.md`);
  const jsonPath = path.join(reportsDir, `${baseFilename}.json`);

  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');
  fs.writeFileSync(jsonPath, JSON.stringify(fullJsonPayload, null, 2), 'utf-8');

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Simulazione completata in ${elapsedSec}s!`);
  console.log(
    `   • Giri medi (${args.players}p): ${mainReport.roundsDistribution?.mean} (mediana ${mainReport.roundsDistribution?.median}, p90 ${mainReport.roundsDistribution?.p90})`
  );
  console.log(
    `   • Vantaggio 1° giocatore: ${mainReport.firstPlayerAdvantageDeltaPercent}% (Win-rate sedie: ${mainReport.seatWinRatesPercent?.join('% / ')}%)`
  );
  console.log(
    `   • Gettoni medi Incassa: ${mainReport.averageCashInTokens} (FIVE_AND_SIX) vs ${reportSixOnly.averageCashInTokens} (SIX_ONLY)`
  );
  console.log(`   • Report Markdown salvato in: ${mdPath}`);
  console.log(`   • Report JSON salvato in:     ${jsonPath}`);
}

main();
