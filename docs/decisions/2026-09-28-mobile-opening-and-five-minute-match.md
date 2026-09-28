# Mobile opening, guided camera, and five-minute match

The player requested a five-minute match, replacing the earlier six-minute rule. The duration lives in `master/game.json`; the browser and authoritative Go server both load it. The specification and solo telemetry draw validation now use 300 seconds. Earthquake frequency is unchanged because the request changed match length, not hazard cadence.

Mobile browsers now choose the 640×360 lightweight opening video regardless of hardware concurrency. The HTML shell loads a static poster first and does not predecode the animated WebP or HD video. A video decode failure leaves the poster visible. This keeps the opening artwork while reducing work during the 3D asset load.

The bridge tutorial pans smoothly to each actual landing in turn and places the explanation above the landing on portrait screens. The camera lesson uses animated touch gestures and mobile-first wording. The result trivia stage reuses the in-game launcher extension so the frame telescopes without detaching fixed supports; its 3D material lighting is softened for readability.
