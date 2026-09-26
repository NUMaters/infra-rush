# Map wayfinding and mobile framing

The map keeps the specification's two symmetric islands and three bridge positions. The landing stages, flags, quarry machinery, road edges, and reefs are visual cues only; they do not change bridge ownership, resource costs, Bot paths, or collision rules.

On a portrait display, the opening camera frames the player's island and river crossing more closely. A marching Bot can be followed until it stops or the player touches or scrolls the map. The existing pan, pinch zoom, and rotate gestures remain available, including zooming out to see both islands. The camera is mirrored for the red team.

The glowing landing-stage ring uses the same `bridgeBuilder` command validation as the build button and `!` label. It appears only where construction can currently be ordered, so the art does not suggest a usable action at an unavailable site.
