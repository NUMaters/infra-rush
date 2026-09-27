# Numeric invitations and title attract match

Dedicated rooms use a five-digit server-generated code. The server keeps its longer alphanumeric reconnect tokens separate from room codes and rejects nonnumeric room joins. The lobby uses an in-game keypad so tapping the code field does not open the device keyboard. The share action uses the device share sheet when available and otherwise copies a message containing the code and a direct room URL. The URL's `room` parameter is accepted only when it is exactly five digits; opening it connects to the match server and joins that room. Invite links use the current game's base URL so a deployed Pages link retains `/infra-rush/`.

The title scene runs two normal CPU controllers against a disposable local game state at four times game speed. Each team starts two stone short of its first bridge, so construction becomes visible promptly. The title match never modifies a player's match and resets after a result. This uses existing Bot, bridge, and machine behavior instead of a looping video.

Quarry excavators are instantiated only when a Bot actually works; static decorative excavators were removed to avoid suggesting that they can be selected.
