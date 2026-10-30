"""
Generates every Motion Lab icon/splash asset from one vector-ish description.
Run: python3 scripts/generate-assets.py

Mark: a violet gradient tile with a white ball rising to the top-right,
leaving a fading trail (the "motion" in Motion Lab).
"""
from PIL import Image, ImageDraw

SIZE = 1024
SS = 4  # supersampling factor for crisp anti-aliased edges
W = SIZE * SS
C1 = (142, 115, 255)  # #8E73FF top-left
C2 = (94, 63, 230)    # #5E3FE6 bottom-right
CORNER_RATIO = 0.15   # matches Expo Go's 30pt radius on a 200pt icon

# (cx, cy, r, alpha) in 1024 space, trail first, ball last.
TRAIL = [
    (300, 704, 44, 0.22),
    (418, 568, 58, 0.40),
    (546, 448, 76, 0.62),
    (692, 354, 122, 1.00),
]


def gradient(size):
    small = 64
    img = Image.new("RGB", (small, small))
    px = img.load()
    for y in range(small):
        for x in range(small):
            t = (x + y) / (2 * (small - 1))
            px[x, y] = tuple(round(C1[i] + (C2[i] - C1[i]) * t) for i in range(3))
    img = img.resize((size, size), Image.BICUBIC)
    # Soft highlight top-left so the tile doesn't look flat.
    glow = Image.new("L", (small, small), 0)
    gp = glow.load()
    for y in range(small):
        for x in range(small):
            d = ((x / small - 0.2) ** 2 + (y / small - 0.15) ** 2) ** 0.5
            gp[x, y] = max(0, min(255, round(255 * (1 - d / 0.9) * 0.22)))
    glow = glow.resize((size, size), Image.BICUBIC)
    white = Image.new("RGB", (size, size), (255, 255, 255))
    return Image.composite(white, img, glow).convert("RGBA")


def glyph(size, scale=1.0, color=(255, 255, 255)):
    """White trail-and-ball on a transparent canvas, drawn at `size`."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    k = size / SIZE
    for cx, cy, r, a in TRAIL:
        # Scale about the center of the tile.
        x = (cx - SIZE / 2) * scale + SIZE / 2
        y = (cy - SIZE / 2) * scale + SIZE / 2
        rr = r * scale
        dot = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(dot).ellipse(
            [(x - rr) * k, (y - rr) * k, (x + rr) * k, (y + rr) * k],
            fill=color + (round(255 * a),),
        )
        layer = Image.alpha_composite(layer, dot)
    return layer


def rounded_mask(size, ratio):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=size * ratio, fill=255)
    return mask


def down(img, size=SIZE):
    return img.resize((size, size), Image.LANCZOS)


def dark_gradient(size):
    """Deeper violet for the iOS dark-appearance icon."""
    global C1, C2
    saved = (C1, C2)
    C1, C2 = (84, 56, 214), (38, 24, 110)
    try:
        return gradient(size)
    finally:
        C1, C2 = saved


def main():
    tile = Image.alpha_composite(gradient(W), glyph(W))

    # iOS/App icon: full bleed, the OS applies its own mask.
    down(tile).convert("RGB").save("assets/icon.png", optimize=True)

    # iOS 18+ appearance variants: a darker tile, and a grayscale-on-transparent
    # image that the system tints itself.
    down(Image.alpha_composite(dark_gradient(W), glyph(W))).convert("RGB").save("assets/icon-dark.png", optimize=True)
    tinted = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    tinted = Image.alpha_composite(tinted, glyph(W, color=(255, 255, 255)))
    down(tinted).convert("LA").save("assets/icon-tinted.png", optimize=True)

    # Splash image: the same tile with the corner radius baked in, transparent outside.
    rounded = tile.copy()
    rounded.putalpha(rounded_mask(W, CORNER_RATIO))
    down(rounded).save("assets/splash-icon.png", optimize=True)

    # Favicon.
    down(rounded, 64).save("assets/favicon.png", optimize=True)

    # Android adaptive icon layers. Foreground content stays inside the 66% safe zone.
    down(gradient(W)).convert("RGB").save("assets/android-icon-background.png", optimize=True)
    down(glyph(W, scale=0.66)).save("assets/android-icon-foreground.png", optimize=True)
    down(glyph(W, scale=0.66)).save("assets/android-icon-monochrome.png", optimize=True)
    print("assets written")


if __name__ == "__main__":
    main()
