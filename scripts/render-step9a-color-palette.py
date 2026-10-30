from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path.cwd()
OUT = ROOT / "screenshots/step9a-color-palette.png"

W, H = 1600, 900
BG = "#05080A"
CARD = "#0C151A"
BORDER = "#1E3038"
TEXT = "#DCEBEF"
MUTED = "#7F949A"
AMBER = "#C9A96A"

FONT_TITLE = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 30, index=0)
FONT_SUB = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 15, index=0)
FONT_CARD = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 18, index=0)
FONT_HEX = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 15, index=0)
FONT_SMALL = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 12, index=0)
FONT_TINY = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 11, index=0)

CARDS = [
    ("企业模型", "Enterprise", "#A0E3F2", "3D 已接入", "0.78 / 0.45 / 0.10"),
    ("物料流", "Material flow", "#5BB8D4", "3D 已接入", "0.85 / 0.40 / 0.15"),
    ("资金流", "Capital flow", "#2E86AB", "3D 已接入", "0.90 / 0.35 / 0.20"),
    ("技术流", "Tech flow", "#3DD6C4", "色值保持", "既有 2D 图例"),
    ("担保", "Guarantee", "#2E7D32", "色值保持", "既有 2D 图例"),
    ("同控色环", "Control ring", "#8E7CC3", "色值保持", "既有 2D 图例"),
]

image = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(image, "RGBA")

# Subtle scene grid.
for x in range(0, W, 80):
    draw.line((x, 0, x, H), fill="#0C1215", width=1)
for y in range(0, H, 80):
    draw.line((0, y, W, y), fill="#0C1215", width=1)

draw.text((70, 46), "Step 9A-Color · 流动色彩对照", font=FONT_TITLE, fill=TEXT)
draw.text(
    (72, 88),
    "黑色场景 · 淡蓝企业 / 中青蓝物料 / 深蓝资金 / 青绿技术 / 深绿担保 / 紫色同控",
    font=FONT_SUB,
    fill=MUTED,
)
draw.text((1200, 48), "3D COLOR AUDIT", font=FONT_TINY, fill=AMBER)
draw.text((1200, 66), "material vs capital", font=FONT_TINY, fill=MUTED)
draw.line((70, 122, W - 70, 122), fill="#1C2B31", width=1)

card_w, card_h = 225, 420
gap = 18
start_x = 65
top = 180

for index, (name, english, color, status, detail) in enumerate(CARDS):
    x0 = start_x + index * (card_w + gap)
    y0 = top
    x1, y1 = x0 + card_w, y0 + card_h
    draw.rounded_rectangle(
        (x0, y0, x1, y1),
        radius=10,
        fill=CARD,
        outline=BORDER,
        width=1,
    )
    draw.text((x0 + 18, y0 + 16), name, font=FONT_CARD, fill=TEXT)
    draw.text((x0 + 18, y0 + 43), english, font=FONT_SMALL, fill=MUTED)
    draw.text((x0 + 18, y0 + 70), color, font=FONT_HEX, fill=color)
    draw.text((x0 + 18, y0 + 94), status, font=FONT_TINY, fill=AMBER)

    # Swatch plate.
    plate = (x0 + 18, y0 + 122, x1 - 18, y0 + 258)
    draw.rounded_rectangle(plate, radius=7, fill="#060B0D", outline="#18282E")
    cx = (plate[0] + plate[2]) / 2
    cy = (plate[1] + plate[3]) / 2

    if index == 0:
        draw.rounded_rectangle(
            (cx - 52, cy - 36, cx + 52, cy + 36),
            radius=8,
            fill=color,
            outline="#E8FBFF",
            width=1,
        )
    elif index == 1:
        draw.line((cx - 72, cy, cx + 62, cy), fill=color, width=16)
        draw.polygon(
            [(cx + 78, cy), (cx + 56, cy - 15), (cx + 56, cy + 15)],
            fill=color,
        )
    elif index == 2:
        draw.line((cx - 78, cy, cx + 70, cy), fill=color, width=24)
        draw.ellipse((cx - 90, cy - 12, cx - 66, cy + 12), fill=color)
        draw.ellipse((cx + 58, cy - 12, cx + 82, cy + 12), fill=color)
    elif index == 3:
        for dx in range(-80, 74, 18):
            draw.line((cx + dx, cy, cx + dx + 8, cy), fill=color, width=5)
    elif index == 4:
        draw.line((cx - 82, cy, cx + 82, cy), fill=color, width=12)
    else:
        draw.ellipse(
            (cx - 46, cy - 46, cx + 46, cy + 46),
            outline=color,
            width=8,
        )

    draw.text(
        (x0 + 18, y0 + 274),
        detail,
        font=FONT_SMALL,
        fill=MUTED,
    )
    if index == 1:
        draw.text((x0 + 18, y0 + 298), "扁平带 + 箭头同色", font=FONT_TINY, fill="#93A9AF")
    elif index == 2:
        draw.text((x0 + 18, y0 + 298), "管道 + 球体弯头同色", font=FONT_TINY, fill="#93A9AF")
    elif index == 0:
        draw.text((x0 + 18, y0 + 298), "透明 / 不改填充色", font=FONT_TINY, fill="#93A9AF")
    elif index == 5:
        draw.text((x0 + 18, y0 + 298), "同控关系不画连线", font=FONT_TINY, fill="#93A9AF")

# Bottom explanatory panel.
draw.rounded_rectangle(
    (65, 650, W - 65, 828),
    radius=10,
    fill="#0A1216",
    outline="#1D2D34",
)
draw.text((88, 668), "验收口径", font=FONT_CARD, fill=TEXT)
draw.text(
    (88, 700),
    "企业淡蓝 #A0E3F2 与物料中青蓝 #5BB8D4 明度、饱和度分离；资金流 #2E86AB 进一步压暗，在黑色场景中保持三类可区分。",
    font=FONT_SMALL,
    fill=MUTED,
)
draw.text(
    (88, 726),
    "物料箭头复用物料流材质；资金管与弯头复用资金流材质；技术 #3DD6C4 青绿、担保 #2E7D32 深绿、同控 #8E7CC3 紫，在色相上互不混淆。",
    font=FONT_SMALL,
    fill=MUTED,
)
draw.text(
    (88, 754),
    "3D 当前场景绘制企业、物料流、资金流；技术/担保/同控沿用既定色值，不在 Step 9A 的贴地线几何范围内。",
    font=FONT_TINY,
    fill="#61777E",
)
draw.text(
    (88, 784),
    "材质参数：企业 0.78/0.45/0.10（不变） · 物料 0.85/0.40/0.15 · 资金 0.90/0.35/0.20（opacity/roughness/metalness）",
    font=FONT_TINY,
    fill="#61777E",
)

image.save(OUT)
print(f"saved {OUT}")
