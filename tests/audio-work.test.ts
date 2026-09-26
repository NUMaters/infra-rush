import { describe, expect, it, vi } from "vitest";
import { Sound } from "../src/ui/audio";

function clockedSound() {
  const sound = new Sound();
  const clock = { currentTime: 0, state: "running" };
  Object.assign(sound, { ctx: clock });
  const play = vi.spyOn(sound, "play").mockImplementation(() => {});
  return { sound, clock, play };
}

describe("work sound cadence", () => {
  it("plays one mining cue for a group of miners and does not stack every frame", () => {
    const { sound, clock, play } = clockedSound();
    sound.updateWork(["mine", "mine", "mine"], true);
    expect(play).toHaveBeenCalledExactlyOnceWith("mine");
    clock.currentTime = 0.6;
    sound.updateWork(["mine", "mine"], true);
    expect(play).toHaveBeenCalledTimes(1);
    clock.currentTime = 1.3;
    sound.updateWork(["mine"], true);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("switches promptly to destruction and stops during pause or mute", () => {
    const { sound, clock, play } = clockedSound();
    sound.updateWork(["mine"], true);
    clock.currentTime = 0.2;
    sound.updateWork(["mine", "destroy"], true);
    expect(play).toHaveBeenLastCalledWith("destroy");
    sound.updateWork(["destroy"], false);
    clock.currentTime = 0.3;
    sound.updateWork(["destroy"], true);
    expect(play).toHaveBeenCalledTimes(3);
    sound.muted = true;
    clock.currentTime = 1;
    sound.updateWork(["destroy"], true);
    expect(play).toHaveBeenCalledTimes(3);
  });
});
