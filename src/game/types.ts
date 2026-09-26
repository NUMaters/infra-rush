export type Team = "blue" | "red";
export type Resource = "soil" | "stone" | "iron";
export type Resources = Record<Resource, number>;
export type Cost = Partial<Resources>;
export type Point = [number, number];
export type Action =
  | "mine"
  | "build"
  | "upgrade"
  | "repair"
  | "embank"
  | "clear"
  | "destroy"
  | "march";
export type BotState =
  | "IDLE"
  | "MOVING"
  | "MINING"
  | "BUILDING_BRIDGE"
  | "UPGRADING_BRIDGE"
  | "REPAIRING_BRIDGE"
  | "BUILDING_EMBANKMENT"
  | "CLEARING_EMBANKMENT"
  | "DESTROYING_BRIDGE"
  | "MARCHING"
  | "ATTACKING_CASTLE"
  | "RETURNING";
export interface Bot {
  id: string;
  team: Team;
  index: number;
  state: BotState;
  position: Point;
  home: Point;
  path: Point[];
  action: Action | null;
  target: string | null;
  progress: number;
  duration: number;
  paid: Cost;
  mineClock: number;
  mineIndex: number;
}
export interface Bridge {
  id: string;
  x: number;
  exclusive: Team | null;
  owner: Team | null;
  level: number;
  capacity: number;
  damage: number;
  blockedBy: Team | null;
  lock: string | null;
}
export interface GameEvent {
  id: number;
  kind:
    | "resource"
    | "complete"
    | "attack"
    | "return"
    | "earthquake"
    | "warning"
    | "collapse"
    | "command"
    | "end";
  team?: Team;
  position?: Point;
  text: string;
}
export interface Stats {
  mined: number;
  built: number;
  attacks: number;
  repairs: number;
  sabotage: number;
}
export interface GameState {
  time: number;
  status: "playing" | "finished";
  winner: Team | "draw" | null;
  teams: Record<Team, { resources: Resources; hp: number; stats: Stats }>;
  bots: Bot[];
  bridges: Bridge[];
  seed: number;
  nextQuake: number;
  warned: boolean;
  events: GameEvent[];
  eventSequence: number;
}
export interface Command {
  botId: string;
  action: Action | "cancel";
  target?: string;
}
