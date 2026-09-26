# Result-screen civil engineering trivia

The result screen introduces one short, source-linked civil engineering fact at a time. Players can turn to the next fact, and the first fact advances after each match. This gives returning players something new to read without interrupting the game loop. A portrait rendered from the game's existing Bot GLB serves as the guide, keeping the feature within INFRA RUSH's visual world.

The facts describe real road infrastructure, not the game's simplified bridge health or construction rules. The initial six cover bridge inspection classifications III and II, the basic five-year inspection interval, fatigue, embankment drainage, and thermal movement. Wording was checked against the linked publications by Japan's Ministry of Land, Infrastructure, Transport and Tourism. Each in-game card links to its source so players can read further. The bridge inspection facts use the [Road Bridge Periodic Inspection Manual](https://www.mlit.go.jp/road/sisaku/yobohozen/tenken/yobo7_23.pdf); the other sources are recorded beside the individual facts in `src/content/trivia.ts`.

On narrow screens, the result summary is condensed so the Bot and fact appear early, with the replay controls immediately below. A 320px-wide screen can still scroll vertically; it does not scroll horizontally.
