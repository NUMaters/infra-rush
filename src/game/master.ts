import game from "../../master/game.json";
import resources from "../../master/resources.json";
import bots from "../../master/bots.json";
import castle from "../../master/castle.json";
import bridges from "../../master/bridges.json";
import tasks from "../../master/tasks.json";
import earthquake from "../../master/earthquake.json";
import vehicles from "../../master/vehicles.json";
import cpu from "../../master/cpu.json";
export const M = {
  game,
  resources,
  bots,
  castle,
  bridges,
  tasks,
  earthquake,
  vehicles,
  cpu,
};
export type Difficulty = keyof typeof cpu;
