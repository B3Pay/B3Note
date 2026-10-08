"""Generates the B3Note icons: the B3 family's mark (B3Forge's geometry, a grey B with a 3 and a
multicolour dot) with the product's letter, a gradient N, plugged into it.

    python3 frontend/scripts/brand-icons.py <dir>

writes the SVGs below. The PNGs in frontend/public are these rasterized at the sizes their names
give: icon.svg for apple-touch-icon (180) and android-chrome (192, 512), maskable.svg for
maskable-512x512, and mark.svg, transparent, for the favicons (16, 32, and 16+32+48 in favicon.ico).
mark.svg is also logo.svg, mono.svg is safari-pinned-tab.svg.
"""
import math, sys, os

OUT = sys.argv[1]
GREY = "#808080"
# Top to bottom, sampled from B3Forge's F bar.
GRADIENT = ["#29abe2", "#348ccc", "#4a4198", "#8e2480", "#ea1f79", "#f04543", "#f3712b", "#f9a037", "#fbb03b"]
# Clockwise from 3 o'clock, sampled from B3Forge's dot.
CONIC = ["#802482", "#4a4298", "#3b71b9", "#2ba6de", "#91ae90", "#c3af68", "#f89634", "#f4722b", "#f0552c", "#ef3855", "#ed2471", "#b5217d"]

# B3ForgeIcon.tsx, in its 366 x 500 space.
B_OUTLINE = "M11 452.549V485.99C11 485.996 11.0045 486 11.01 486H216.751C349.884 482.439 404.347 306.604 289.369 241.31C287.553 240.123 287.553 238.936 289.369 237.749C382.562 165.331 328.541 21.6845 209.932 11H11.01C11.0045 11 11 11.0045 11 11.01V44.4507"
THREE = "M177.152 75.5514C198.455 75.5515 215.402 83.3523 226.95 95.8664C238.322 108.191 243.794 124.358 243.794 140.195C243.794 156.033 238.322 172.2 226.95 184.524C218.939 193.206 208.328 199.618 195.468 202.732C202.831 212.498 207.09 224.888 207.09 238.756C207.09 252.15 203.117 264.163 196.213 273.768C212.269 276.356 225.371 283.353 235.027 293.323C247.25 305.943 253.249 322.604 253.34 339.028C253.432 355.447 247.622 372.128 235.6 384.783C223.429 397.596 205.606 405.528 183.219 405.529H94.8667C88.1403 405.529 82.6875 400.075 82.6872 393.349C82.6873 386.623 88.1402 381.17 94.8667 381.17H183.219C199.561 381.169 210.785 375.538 217.94 368.007C225.245 360.316 229.042 349.871 228.983 339.163C228.923 328.461 225.012 317.995 217.53 310.271C210.191 302.694 198.708 297.022 182.008 297.022H153.696C152.031 297.149 150.341 297.218 148.629 297.218C119.284 297.218 96.5496 278.162 91.3104 250.936H52.4109C45.6844 250.936 40.2314 245.483 40.2314 238.756C40.2314 232.03 45.6844 226.577 52.4109 226.577H91.3104C96.5496 199.351 119.284 180.295 148.629 180.295C150.296 180.295 151.942 180.359 153.565 180.481H177.152C192.157 180.48 202.441 175.165 209.048 168.005C215.83 160.655 219.435 150.59 219.435 140.195C219.435 129.801 215.83 119.736 209.048 112.386C202.441 105.226 192.157 99.9104 177.152 99.9104H92.4308C85.7042 99.9104 80.2513 94.4574 80.2513 87.7309C80.2513 81.0043 85.7042 75.5514 92.4308 75.5514H177.152ZM148.629 199.782C125.84 199.782 109.655 215.967 109.655 238.756C109.655 261.545 125.84 277.731 148.629 277.731C171.418 277.731 187.603 261.545 187.603 238.756C187.603 215.967 171.418 199.782 148.629 199.782Z"
DOT = (148.628, 238.756, 33.0)
# B3Forge's exported icons draw the mark bolder than the component (about 29 units).
STROKE = 28
THREE_OUTLINE = 5
# The N, left of the connector, as tall as B3Forge's F.
N_TOP, N_BOTTOM = 177.0, 300.5
N_LEFT, N_RIGHT = -76.0, 4.0
CONTENT = (N_LEFT - STROKE / 2, -3.0, 369.0, 500.0)  # x0, y0, x1, y1 in mark space


def lerp(a, b, t):
    pa = [int(a[i:i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return "#%02x%02x%02x" % tuple(round(x + (y - x) * t) for x, y in zip(pa, pb))


def conic_slices(cx, cy, r, mono=None):
    parts, n = [], 120
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1.15) / n
        pos = i / n * len(CONIC)
        k = int(pos)
        colour = mono or lerp(CONIC[k % len(CONIC)], CONIC[(k + 1) % len(CONIC)], pos - k)
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        parts.append(f'<path d="M{cx:.2f} {cy:.2f}L{x0:.2f} {y0:.2f}A{r} {r} 0 0 1 {x1:.2f} {y1:.2f}Z" fill="{colour}"/>')
    return "".join(parts)


def mark(mono=None):
    grey = mono or GREY
    n_stroke = mono or "url(#b3note-n)"
    n_path = f"M{N_LEFT} {N_BOTTOM}V{N_TOP}L{N_RIGHT} {N_BOTTOM}V{N_TOP}"
    defs = "" if mono else (
        f'<defs><linearGradient id="b3note-n" x1="0" y1="{N_TOP - STROKE/2}" x2="0" y2="{N_BOTTOM + STROKE/2}" gradientUnits="userSpaceOnUse">'
        + "".join(f'<stop offset="{i / (len(GRADIENT) - 1):.3f}" stop-color="{c}"/>' for i, c in enumerate(GRADIENT))
        + "</linearGradient></defs>")
    return (defs
            + f'<path d="{B_OUTLINE}" stroke="{grey}" stroke-width="{STROKE}" stroke-linecap="round" fill="none"/>'
            + f'<path d="{THREE}" fill="{grey}" stroke="{grey}" stroke-width="{THREE_OUTLINE}" stroke-linejoin="round"/>'
            + f'<path d="{n_path}" stroke="{n_stroke}" stroke-width="{STROKE}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
            + conic_slices(*DOT, mono=mono))


def svg(size, fill, background=None, mono=None, square=True):
    """`fill`: the share of the canvas the mark's height takes."""
    x0, y0, x1, y1 = CONTENT
    w, h = x1 - x0, y1 - y0
    if square:
        scale = size * fill / h
        tx = (size - w * scale) / 2 - x0 * scale
        ty = (size - h * scale) / 2 - y0 * scale
        vb_w = vb_h = size
    else:
        scale, tx, ty = 1, -x0, -y0
        vb_w, vb_h = w, h
    bg = f'<rect width="{vb_w}" height="{vb_h}" fill="{background}"/>' if background else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vb_w:g} {vb_h:g}" width="{vb_w:g}" height="{vb_h:g}">'
            + bg + f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">' + mark(mono) + "</g></svg>")


def wordmark():
    """The mark beside "B3Note", for the README."""
    x0, y0, x1, y1 = CONTENT
    scale = 200 / (y1 - y0)
    tx, ty = 20 - x0 * scale, 20 - y0 * scale
    text_x = 20 + (x1 - x0) * scale + 36
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 240" width="760" height="240">'
            + f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale:.4f})">' + mark() + "</g>"
            + f'<text x="{text_x:.0f}" y="163" font-family="Inter, \'Segoe UI\', system-ui, -apple-system, sans-serif" '
            + 'font-size="124" font-weight="700" letter-spacing="-3">'
            + f'<tspan fill="{GREY}">B3</tspan><tspan fill="#6d4aff">Note</tspan></text></svg>')


os.makedirs(OUT, exist_ok=True)
variants = {
    "mark.svg": svg(512, 0.86),                     # transparent, tight: favicons and the app header
    "icon.svg": svg(512, 0.667, background="#000"),  # home-screen icon (iOS shows transparency as black)
    "maskable.svg": svg(512, 0.54, background="#000"),  # Android maskable: inside the 80% safe zone
    "mono.svg": svg(512, 0.86, mono="#000"),        # Safari pinned tab
    "logo-long.svg": wordmark(),
}
for name, text in variants.items():
    with open(os.path.join(OUT, name), "w") as f:
        f.write(text)
print("wrote", ", ".join(variants))
