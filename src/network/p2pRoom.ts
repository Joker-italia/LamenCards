import Peer, { DataConnection } from 'peerjs';
import { GameAction, GameState } from '../engine/types';
import { getPublicStateFor, validateClientAction } from './engineAdapter';

const PEER_PREFIX = 'lamencards-room-v1-';

export type NetworkMessage =
  | { type: 'HELLO_JOIN'; playerId: string; playerName: string }
  | { type: 'CLIENT_ACTION'; playerId: string; action: GameAction }
  | { type: 'STATE_SYNC'; targetPlayerId?: string; state: GameState };

export interface P2PRoomCallbacks {
  onStateSync?: (newState: GameState) => void;
  onClientJoin?: (playerId: string, playerName: string) => void;
  onClientAction?: (action: GameAction, senderPlayerId?: string) => void;
  onStatusChange?: (
    status: 'CONNECTING' | 'ONLINE' | 'LOCAL_ONLY' | 'ERROR',
    detail?: string
  ) => void;
}

export class P2PRoomManager {
  private role: 'HOST' | 'CLIENT';
  private roomCode: string;
  private myPlayerId = '';
  private myPlayerName = '';
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private clientConnections: Map<string, DataConnection> = new Map();
  private peerToPlayerId: Map<string, string> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private callbacks: P2PRoomCallbacks;
  private latestHostState: GameState | null = null;
  private destroyed = false;
  private visibilityHandler: (() => void) | null = null;

  constructor(role: 'HOST' | 'CLIENT', roomCode: string, callbacks: P2PRoomCallbacks) {
    this.role = role;
    this.roomCode = roomCode.toUpperCase().trim();
    this.callbacks = callbacks;
  }

  public start(playerId: string, playerName: string) {
    this.myPlayerId = playerId;
    this.myPlayerName = playerName;
    this.destroyed = false;
    this.callbacks.onStatusChange?.('CONNECTING', 'Connessione alla stanza in corso...');

    // 1. Canale locale istantaneo (per testare più tab sullo stesso dispositivo)
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(`${PEER_PREFIX}${this.roomCode}`);
      this.broadcastChannel.onmessage = (event) => {
        const msg = event.data as NetworkMessage;
        this.handleIncomingMessage(msg);
      };
    }

    // 2. Rete WebRTC Peer-to-Peer multi-device (iOS / Android / Desktop)
    this.initPeerConnection();

    // 3. Resilienza mobile: riconnessione automatica al risveglio dallo standby
    if (typeof document !== 'undefined') {
      this.visibilityHandler = () => {
        if (document.visibilityState === 'visible' && !this.destroyed) {
          this.handleWakeFromStandby();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    // Invia comunque il join anche sul canale broadcast locale
    if (this.role === 'CLIENT') {
      this.broadcastChannel?.postMessage({
        type: 'HELLO_JOIN',
        playerId,
        playerName,
      } satisfies NetworkMessage);
    }
  }

  private initPeerConnection() {
    try {
      const peerId =
        this.role === 'HOST'
          ? `${PEER_PREFIX}${this.roomCode}`
          : `${PEER_PREFIX}${this.roomCode}-client-${this.myPlayerId.slice(-6)}-${Math.floor(Math.random() * 999)}`;

      this.peer = new Peer(peerId, {
        debug: 0,
      });

      this.peer.on('open', () => {
        if (this.destroyed) return;
        if (this.role === 'HOST') {
          this.callbacks.onStatusChange?.(
            'ONLINE',
            `Stanza ${this.roomCode} attiva (P2P WebRTC)`
          );
        } else {
          this.connectToHostPeer(this.myPlayerId, this.myPlayerName);
        }
      });

      this.peer.on('connection', (conn) => {
        if (this.role !== 'HOST' || this.destroyed) return;
        this.setupHostDataConnection(conn);
      });

      this.peer.on('disconnected', () => {
        if (this.destroyed) return;
        try {
          this.peer?.reconnect();
        } catch {
          // fallback
        }
      });

      this.peer.on('error', (err) => {
        if (this.destroyed) return;
        this.callbacks.onStatusChange?.(
          'LOCAL_ONLY',
          `Rete locale attiva (${err.type || 'P2P'})`
        );
        if (this.role === 'CLIENT') {
          this.broadcastChannel?.postMessage({
            type: 'HELLO_JOIN',
            playerId: this.myPlayerId,
            playerName: this.myPlayerName,
          } satisfies NetworkMessage);
        }
      });
    } catch {
      this.callbacks.onStatusChange?.('LOCAL_ONLY', 'Canale locale attivo');
    }
  }

  private handleWakeFromStandby() {
    if (this.role === 'CLIENT') {
      // Invia subito HELLO_JOIN su BroadcastChannel e verifica la connessione WebRTC
      this.broadcastChannel?.postMessage({
        type: 'HELLO_JOIN',
        playerId: this.myPlayerId,
        playerName: this.myPlayerName,
      } satisfies NetworkMessage);

      if (!this.hostConnection || !this.hostConnection.open) {
        if (this.peer && !this.peer.destroyed) {
          if (this.peer.disconnected) {
            this.peer.reconnect();
          }
          this.connectToHostPeer(this.myPlayerId, this.myPlayerName);
        } else {
          this.initPeerConnection();
        }
      }
    } else if (this.role === 'HOST' && this.latestHostState) {
      if (this.peer && this.peer.disconnected && !this.peer.destroyed) {
        this.peer.reconnect();
      }
      this.broadcastStateFromHost(this.latestHostState);
    }
  }

  private connectToHostPeer(playerId: string, playerName: string) {
    if (!this.peer || this.destroyed) return;
    const hostPeerId = `${PEER_PREFIX}${this.roomCode}`;
    const conn = this.peer.connect(hostPeerId, { reliable: true });
    this.hostConnection = conn;

    conn.on('open', () => {
      if (this.destroyed) return;
      this.callbacks.onStatusChange?.('ONLINE', `Connesso alla stanza ${this.roomCode}`);
      conn.send({
        type: 'HELLO_JOIN',
        playerId,
        playerName,
      } satisfies NetworkMessage);
    });

    conn.on('data', (data) => {
      this.handleIncomingMessage(data as NetworkMessage);
    });

    conn.on('close', () => {
      if (this.destroyed) return;
      this.callbacks.onStatusChange?.('LOCAL_ONLY', 'Connessione Host in riconnessione...');
    });
  }

  private setupHostDataConnection(conn: DataConnection) {
    this.clientConnections.set(conn.peer, conn);

    conn.on('open', () => {
      const targetPlayerId = this.peerToPlayerId.get(conn.peer);
      if (this.latestHostState && targetPlayerId) {
        conn.send({
          type: 'STATE_SYNC',
          targetPlayerId,
          state: getPublicStateFor(this.latestHostState, targetPlayerId),
        } satisfies NetworkMessage);
      }
    });

    conn.on('data', (data) => {
      this.handleIncomingMessage(data as NetworkMessage, conn);
    });

    conn.on('close', () => {
      this.clientConnections.delete(conn.peer);
      this.peerToPlayerId.delete(conn.peer);
    });
  }

  private handleIncomingMessage(msg: NetworkMessage, sourceConn?: DataConnection) {
    if (!msg || typeof msg !== 'object' || this.destroyed) return;

    if (this.role === 'HOST') {
      if (msg.type === 'HELLO_JOIN') {
        if (sourceConn) {
          this.peerToPlayerId.set(sourceConn.peer, msg.playerId);
        }
        this.callbacks.onClientJoin?.(msg.playerId, msg.playerName);
        if (sourceConn && sourceConn.open && this.latestHostState) {
          sourceConn.send({
            type: 'STATE_SYNC',
            targetPlayerId: msg.playerId,
            state: getPublicStateFor(this.latestHostState, msg.playerId),
          } satisfies NetworkMessage);
        } else if (this.latestHostState) {
          this.broadcastStateFromHost(this.latestHostState);
        }
      } else if (msg.type === 'CLIENT_ACTION') {
        const senderId =
          msg.playerId || (sourceConn ? this.peerToPlayerId.get(sourceConn.peer) : undefined);
        if (this.latestHostState) {
          const check = validateClientAction(this.latestHostState, msg.action, senderId);
          if (!check.valid) return;
        }
        this.callbacks.onClientAction?.(msg.action, senderId);
      }
    } else {
      if (msg.type === 'STATE_SYNC') {
        if (msg.targetPlayerId && msg.targetPlayerId !== this.myPlayerId) {
          return;
        }
        const filteredForMe = getPublicStateFor(msg.state, this.myPlayerId);
        this.callbacks.onStateSync?.(filteredForMe);
      }
    }
  }

  public broadcastStateFromHost(state: GameState) {
    if (this.role !== 'HOST' || this.destroyed) return;
    this.latestHostState = state;

    // 1. Su BroadcastChannel invia a ciascun giocatore registrato la sua vista filtrata
    if (this.broadcastChannel) {
      for (const player of state.players) {
        if (player.id === this.myPlayerId || player.isBot) continue;
        const filtered = getPublicStateFor(state, player.id);
        this.broadcastChannel.postMessage({
          type: 'STATE_SYNC',
          targetPlayerId: player.id,
          state: filtered,
        } satisfies NetworkMessage);
      }
    }

    // 2. Su WebRTC invia a ciascuna connessione la vista filtrata solo per quel playerId
    for (const [peerId, conn] of this.clientConnections.entries()) {
      if (conn.open) {
        const targetPlayerId = this.peerToPlayerId.get(peerId) || '';
        const filtered = getPublicStateFor(state, targetPlayerId);
        conn.send({
          type: 'STATE_SYNC',
          targetPlayerId: targetPlayerId || undefined,
          state: filtered,
        } satisfies NetworkMessage);
      }
    }
  }

  public sendActionFromClient(action: GameAction) {
    if (this.role === 'HOST') {
      this.callbacks.onClientAction?.(action, this.myPlayerId);
      return;
    }
    const msg: NetworkMessage = {
      type: 'CLIENT_ACTION',
      playerId: this.myPlayerId,
      action,
    };
    this.broadcastChannel?.postMessage(msg);
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }
  }

  public destroy() {
    this.destroyed = true;
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.hostConnection?.close();
    for (const conn of this.clientConnections.values()) {
      conn.close();
    }
    this.clientConnections.clear();
    this.peerToPlayerId.clear();
    this.peer?.destroy();
    this.broadcastChannel?.close();
  }
}
