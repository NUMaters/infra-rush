"""Compose current GLB renders into a single movie-production reference atlas."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "全素材.png"
FONT = "/Library/Fonts/Arial Unicode.ttf"
W, H = 4096, 2780
BG = (236, 248, 251, 255)
INK = (18, 55, 81, 255)
ACCENT = (35, 142, 190, 255)
ITEMS = (
    ("bot", "作業Bot", "CHARACTER / WORKER BOT"),
    ("excavator", "油圧ショベル", "VEHICLE / EXCAVATOR"),
    ("dozer", "ブルドーザー", "VEHICLE / BULLDOZER"),
    ("grader", "モーターグレーダー", "VEHICLE / MOTOR GRADER"),
    ("drill", "掘削機", "VEHICLE / DRILL EXCAVATOR"),
    ("launcher", "架橋機", "VEHICLE / BRIDGE LAUNCHER"),
)

def font(size):
    return ImageFont.truetype(FONT, size)

def put_model(canvas, name, view, box):
    image = Image.open(ROOT / "renders" / f"{name}-{view}.png").convert("RGBA")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds:
        image = image.crop(bounds)
    x0, y0, x1, y1 = box
    image.thumbnail((x1 - x0, y1 - y0), Image.Resampling.LANCZOS)
    x = x0 + (x1 - x0 - image.width) // 2
    y = y0 + (y1 - y0 - image.height) // 2
    canvas.alpha_composite(image, (x, y))

sheet = Image.new("RGBA", (W, H), BG)
draw = ImageDraw.Draw(sheet)
draw.rounded_rectangle((42, 38, 4054, 174), radius=38, fill=(18, 55, 81, 255))
draw.text((92, 56), "INFRA RUSH", font=font(68), fill=(255, 255, 255, 255))
draw.text((798, 75), "CHARACTER + VEHICLE REFERENCE ATLAS", font=font(38), fill=(147, 228, 250, 255))
draw.text((3250, 91), "CURRENT GAME GLB  /  2026.09", font=font(26), fill=(204, 236, 244, 255))

margin_x, gap_x, card_w = 42, 28, 1318
top, gap_y, card_h = 210, 30, 1240
for i, (name, ja, en) in enumerate(ITEMS):
    col, row = i % 3, i // 3
    x = margin_x + col * (card_w + gap_x)
    y = top + row * (card_h + gap_y)
    draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=36, fill=(255, 255, 255, 255), outline=(133, 203, 218, 255), width=5)
    draw.rounded_rectangle((x + 20, y + 20, x + 95, y + 95), radius=20, fill=(255, 204, 70, 255))
    draw.text((x + 37, y + 27), f"{i + 1:02d}", font=font(33), fill=INK)
    draw.text((x + 115, y + 20), ja, font=font(54), fill=INK)
    draw.text((x + 117, y + 84), en, font=font(23), fill=ACCENT)
    draw.rounded_rectangle((x + 30, y + 139, x + card_w - 30, y + 803), radius=26, fill=(241, 250, 251, 255))
    put_model(sheet, name, "hero", (x + 70, y + 151, x + card_w - 70, y + 790))
    draw.text((x + 52, y + 818), "3/4 VIEW", font=font(26), fill=ACCENT)
    draw.line((x + 30, y + 868, x + card_w - 30, y + 868), fill=(184, 220, 229, 255), width=3)
    mini_w = (card_w - 96) // 2
    for n, view, label in ((0, "front", "FRONT"), (1, "side", "SIDE")):
        sx = x + 32 + n * (mini_w + 32)
        draw.rounded_rectangle((sx, y + 885, sx + mini_w, y + 1190), radius=22, fill=(241, 250, 251, 255))
        put_model(sheet, name, view, (sx + 12, y + 894, sx + mini_w - 12, y + 1158))
        draw.text((sx + 22, y + 1156), label, font=font(23), fill=ACCENT)

draw.text((62, 2734), "Model renders from public/models/*.glb   •   Reference atlas for opening movie production   •   Not a mesh UV unwrap", font=font(25), fill=INK)
sheet.convert("RGB").save(OUT, optimize=True)
print(OUT)
