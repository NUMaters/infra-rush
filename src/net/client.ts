import type { Command, GameState, Team } from "../game/types";

export interface OnlinePlayer {
  name: string;
  ready: boolean;
  connected: boolean;
}
export type ServerMessage =
  | { type: "hello"; token: string; seq: number; resumed: boolean }
  | { type: "queueing" }
  | {
      type: "room";
      roomId: string;
      locked: boolean;
      team: Team;
      phase: "waiting" | "ready" | "playing" | "finished";
      players: Partial<Record<Team, OnlinePlayer>>;
      rematch?: [boolean, boolean];
      startAt: number;
      serverNow: number;
    }
  | { type: "state"; state: GameState }
  | { type: "ack"; seq: number; error?: string; duplicate?: boolean }
  | { type: "error"; message: string }
  | { type: "opponent_disconnected"; team: Team; seconds: number }
  | { type: "rematch"; players: [boolean, boolean] }
  | { type: "pong"; at: number }
  | { type: "left" };

export class OnlineClient {
  onMessage: (message: ServerMessage) => void = () => {};
  onStatus: (
    status: "connected" | "reconnecting" | "offline" | "unavailable",
  ) => void = () => {};
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private seq = 0;
  private active = false;
  private token =
    sessionStorage.getItem("infra-rush-online-token") ??
    localStorage.getItem("infra-rush-online-token") ??
    "";

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }
  connect() {
    if (this.connected || this.socket?.readyState === WebSocket.CONNECTING)
      return;
    const configured = import.meta.env.VITE_ONLINE_WS_URL?.trim();
    if (configured) {
      try {
        const url = new URL(configured);
        if (
          !["ws:", "wss:"].includes(url.protocol) ||
          (location.protocol === "https:" && url.protocol !== "wss:")
        ) {
          this.onStatus("unavailable");
          return;
        }
      } catch {
        this.onStatus("unavailable");
        return;
      }
    }
    if (!configured && location.hostname.endsWith(".github.io")) {
      this.onStatus("unavailable");
      return;
    }
    this.active = true;
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    const previewPort = ["5173", "5177", "5178"].includes(location.port);
    const host = previewPort ? `${location.hostname}:8080` : location.host;
    const socket = new WebSocket(configured || `${scheme}//${host}/ws`);
    this.socket = socket;
    socket.onopen = () => {
      this.send({ type: "hello", token: this.token });
      this.onStatus("connected");
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "hello") {
        this.token = message.token;
        this.seq = message.seq;
        sessionStorage.setItem("infra-rush-online-token", message.token);
        localStorage.setItem("infra-rush-online-token", message.token);
      }
      this.onMessage(message);
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.onStatus(this.active ? "reconnecting" : "offline");
      if (this.active)
        this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
    };
    socket.onerror = () => socket.close();
  }
  send(message: Record<string, unknown>) {
    if (this.connected) this.socket!.send(JSON.stringify(message));
  }
  command(command: Command) {
    this.send({ type: "command", seq: ++this.seq, command });
  }
  leave() {
    this.send({ type: "leave" });
    this.seq = 0;
    sessionStorage.removeItem("infra-rush-online-token");
    localStorage.removeItem("infra-rush-online-token");
    this.token = "";
  }
  close() {
    this.active = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
    this.socket = null;
  }
}
