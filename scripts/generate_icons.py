from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError as exc:  # pragma: no cover - developer helper only
    raise SystemExit(
        "Pillow is required for icon generation. Install it with: python -m pip install Pillow"
    ) from exc


ROOT = Path(__file__).resolve().parents[1]
ICON_DIR = ROOT / "icons"
SIZES = (16, 48, 128)
CANVAS = 512


def _rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def render_master() -> Image.Image:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))

    shadow = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    _rounded(shadow_draw, (42, 50, 482, 490), 104, (0, 0, 0, 80))
    image.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))

    draw = ImageDraw.Draw(image)
    _rounded(draw, (28, 24, 484, 480), 104, "#0f5c52")
    draw.rounded_rectangle((40, 36, 472, 468), radius=94, outline="#4dd0bd", width=10)

    # RSS signal: bold enough to survive the 16px favicon size.
    orange = "#ff8a1f"
    gold = "#ffc857"
    draw.arc((60, 104, 452, 496), 270, 360, fill=orange, width=42)
    draw.arc((110, 154, 354, 398), 270, 360, fill=gold, width=42)
    draw.ellipse((116, 276, 192, 352), fill="#fff7e6")
    draw.ellipse((130, 290, 178, 338), fill=orange)

    # Open book / shelf mark.
    draw.rounded_rectangle((106, 324, 406, 412), radius=24, fill=(6, 51, 47, 150))
    draw.polygon([(118, 292), (252, 324), (252, 424), (112, 388)], fill="#f8fafc")
    draw.polygon([(260, 324), (394, 292), (402, 388), (260, 424)], fill="#eef7f4")
    draw.line((256, 320, 256, 424), fill="#0f5c52", width=10)
    draw.line((142, 334, 228, 354), fill="#b8d8d0", width=8)
    draw.line((142, 366, 226, 386), fill="#b8d8d0", width=8)
    draw.line((286, 354, 370, 334), fill="#b8d8d0", width=8)
    draw.line((286, 386, 370, 366), fill="#b8d8d0", width=8)
    draw.rounded_rectangle((112, 408, 402, 438), radius=14, fill="#ffc857")

    return image


def main() -> None:
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    master = render_master()

    for size in SIZES:
        icon = master.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(ICON_DIR / f"{size}.png", format="PNG", optimize=True)

    print(f"Wrote {len(SIZES)} icons to {ICON_DIR}")


if __name__ == "__main__":
    main()
