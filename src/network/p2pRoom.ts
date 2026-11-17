import Peer, { DataConnection } from 'peerjs';
import { GameAction, GameState } from '../engine/types';

const PEER_PREFIX = 'lamencards-room-v1-';

export type NetworkMessage =
  | { type: 'HELLO_JOIN'; playerId: string; playerName: string }
  | { type: 'CLIENT_ACTION'; action: GameAction }
  | { type: 'STATE_SYNC'; state: GameState };

export interface P2PRoomCallbacks {
  onStateSync?: (newState: GameState) => void;
  onClientJoin?: (playerId: string, playerName: string) => void;
  onClientAction?: (action: GameAction) => void;
  onStatusChange?: (status: 'CONNECTING' | 'ONLINE' | 'LOCAL_ONLY' | 'ERROR', detail?: string) => void;
}

export class P2PRoomManager {
  private role: 'HOST' | 'CLIENT';
  private roomCode: string;
  private peer: Peer | null = null;
  private hostConnection: DataConnection | null = null;
  private clientConnections: Map<string, DataConnection> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;
  private callbacks: P2PRoomCallbacks;
  private latestHostState: GameState | null = null;

  constructor(role: 'HOST' | 'CLIENT', roomCode: string, callbacks: P2PRoomCallbacks) {
    this.role = role;
    this.roomCode = roomCode.toUpperCase().trim();
    this.callbacks = callbacks;
  }

  public start(playerId: string, playerName: string) {
    this.callbacks.onStatusChange?.('CONNECTING');

    // 1. Canale locale istantaneo (per testare più tab sullo stesso dispositivo)
    if (typeof BroadcastChannel !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel(`${PEER_PREFIX}${this.roomCode}`);
      this.broadcastChannel.onmessage = (event) => {
        const msg = event.data as NetworkMessage;
        this.handleIncomingMessage(msg);
      };
    }

    // 2. Rete WebRTC Peer-to-Peer multi-device (iOS / Android / Desktop)
    try {
      const peerId =
        this.role === 'HOST'
          ? `${PEER_PREFIX}${this.roomCode}`
          : `${PEER_PREFIX}${this.roomCode}-client-${playerId.slice(-6)}-${Math.floor(Math.random() * 999)}`;

      this.peer = new Peer(peerId, {
        debug: 0,
      });

      this.peer.on('open', () => {
        if (this.role === 'HOST') {
          this.callbacks.onStatusChange?.('ONLINE', `Stanza ${this.roomCode} attiva (P2P WebRTC)`);
        } else {
          this.connectToHostPeer(playerId, playerName);
        }
      });

      this.peer.on('connection', (conn) => {
        if (this.role !== 'HOST') return;
        this.setupHostDataConnection(conn);
      });

      this.peer.on('error', (err) => {
        // Anche se il server di signaling pubblico è bloccato o offline, il BroadcastChannel locale funziona
        this.callbacks.onStatusChange?.(
          'LOCAL_ONLY',
          `Modalità rete locale / fallback (${err.type || 'P2P'})`
        );
        if (this.role === 'CLIENT') {
          this.broadcastChannel?.postMessage({
            type: 'HELLO_JOIN',
            playerId,
            playerName,
          } satisfies NetworkMessage);
        }
      });
    } catch {
      this.callbacks.onStatusChange?.('LOCAL_ONLY', 'Canale locale attivo');
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

  private connectToHostPeer(playerId: string, playerName: string) {
    if (!this.peer) return;
    const hostPeerId = `${PEER_PREFIX}${this.roomCode}`;
    const conn = this.peer.connect(hostPeerId, { reliable: true });
    this.hostConnection = conn;

    conn.on('open', () => {
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
      this.callbacks.onStatusChange?.('LOCAL_ONLY', 'Connessione Host chiusa');
    });
  }

  private setupHostDataConnection(conn: DataConnection) {
    this.clientConnections.set(conn.peer, conn);

    conn.on('open', () => {
      if (this.latestHostState) {
        conn.send({
          type: 'STATE_SYNC',
          state: this.latestHostState,
        } satisfies NetworkMessage);
      }
    });

    conn.on('data', (data) => {
      this.handleIncomingMessage(data as NetworkMessage, conn);
    });

    conn.on('close', () => {
      this.clientConnections.delete(conn.peer);
    });
  }

  private handleIncomingMessage(msg: NetworkMessage, sourceConn?: DataConnection) {
    if (!msg || typeof msg !== 'object') return;

    if (this.role === 'HOST') {
      if (msg.type === 'HELLO_JOIN') {
        this.callbacks.onClientJoin?.(msg.playerId, msg.playerName);
        if (sourceConn && this.latestHostState) {
          sourceConn.send({
            type: 'STATE_SYNC',
            state: this.latestHostState,
          } satisfies NetworkMessage);
        }
      } else if (msg.type === 'CLIENT_ACTION') {
        this.callbacks.onClientAction?.(msg.action);
      }
    } else {
      if (msg.type === 'STATE_SYNC') {
        this.callbacks.onStateSync?.(msg.state);
      }
    }
  }

  public broadcastStateFromHost(state: GameState) {
    if (this.role !== 'HOST') return;
    this.latestHostState = state;
    const msg: NetworkMessage = {
      type: 'STATE_SYNC',
      state,
    };

    this.broadcastChannel?.postMessage(msg);
    for (const conn of this.clientConnections.values()) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  public sendActionFromClient(action: GameAction) {
    if (this.role === 'HOST') {
      this.callbacks.onClientAction?.(action);
      return;
    }
    const msg: NetworkMessage = {
      type: 'CLIENT_ACTION',
      action,
    };
    this.broadcastChannel?.postMessage(msg);
    if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(msg);
    }
  }

  public destroy() {
    this.hostConnection?.close();
    for (const conn of this.clientConnections.values()) {
      conn.close();
    }
    this.clientConnections.clear();
    this.peer?.destroy();
    this.broadcastChannel?.close();
  }
}
