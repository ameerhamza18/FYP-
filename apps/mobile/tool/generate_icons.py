"""Generate the TrustLayer Android launcher icons.

Why this exists: `AndroidManifest.xml` references `@mipmap/ic_launcher`, so the
build fails with "resource mipmap/ic_launcher not found" if the PNGs are absent.
Committing a small generator keeps the icons reproducible and reviewable instead
of shipping opaque binaries of unknown origin.

Usage (from apps/mobile):
    python tool/generate_icons.py

Writes:
    android/app/src/main/res/mipmap-*/ic_launcher.png
    android/app/src/main/res/mipmap-*/ic_launcher_round.png
    android/app/src/main/res/mipmap-*/ic_launcher_foreground.png   (adaptive)
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

# Mirrors TrustLayerColors in lib/main.dart.
BACKGROUND = (15, 23, 42, 255)   # #0F172A slate-900
PRIMARY = (59, 130, 246, 255)    # #3B82F6 electric blue
CHECK = (248, 250, 252, 255)     # #F8FAFC slate-50

RES = Path(__file__).resolve().parents[1] / "android" / "app" / "src" / "main" / "res"

# Standard launcher densities, and the larger canvas adaptive icons require
# (108dp foreground with the inner 72dp treated as the safe zone).
LAUNCHER_SIZES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
FOREGROUND_SIZES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

SS = 4  # supersampling factor


def _quad(p0, p1, p2, steps=48):
    """Points along a quadratic Bézier curve (used for the shield's shoulders)."""
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
        ))
    return out


def shield_points(size: int, inset: float):
    """A classic security shield inscribed in a box of `size`, inset by a fraction."""
    lo = size * inset
    hi = size * (1 - inset)
    mid = size / 2
    shoulder = lo + (hi - lo) * 0.46

    pts = [
        (lo, lo + (hi - lo) * 0.08),
        (lo, lo),
        (hi, lo),
        (hi, lo + (hi - lo) * 0.08),
        (hi, shoulder),
    ]
    pts += _quad((hi, shoulder), (hi, hi + (hi - lo) * 0.06), (mid, hi))
    pts += _quad((mid, hi), (lo, hi + (hi - lo) * 0.06), (lo, shoulder))
    return pts


def render_shield(big: int, inset: float, fill, with_check: bool):
    """Draw the shield on a transparent `big`x`big` canvas.

    Deliberately does NOT resize: callers composite at supersampled scale and
    downscale once at the end (compositing mismatched sizes silently pastes the
    source into the top-left corner).
    """
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.polygon(shield_points(big, inset), fill=fill)

    if with_check:
        d.line(
            [
                (big * 0.34, big * 0.50),
                (big * 0.455, big * 0.615),
                (big * 0.68, big * 0.375),
            ],
            fill=CHECK,
            width=max(2, int(big * 0.085)),
            joint="curve",
        )
    return img


def render_rounded_tile(big: int, radius_frac: float = 0.22):
    """Opaque dark rounded-square tile of `big`x`big`."""
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle(
        [0, 0, big - 1, big - 1],
        radius=int(big * radius_frac),
        fill=BACKGROUND,
    )
    return img


def main() -> None:
    for density, size in LAUNCHER_SIZES.items():
        out_dir = RES / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)
        big = size * SS

        # Legacy square icon: dark tile + blue shield, composited at full scale.
        tile = render_rounded_tile(big)
        tile.alpha_composite(render_shield(big, 0.17, PRIMARY, with_check=True))
        icon = tile.resize((size, size), Image.LANCZOS)
        icon.save(out_dir / "ic_launcher.png")

        # Legacy round icon: same art, circular alpha mask.
        mask = Image.new("L", (big, big), 0)
        ImageDraw.Draw(mask).ellipse([0, 0, big - 1, big - 1], fill=255)
        round_icon = tile.copy()
        round_icon.putalpha(mask)
        round_icon.resize((size, size), Image.LANCZOS).save(out_dir / "ic_launcher_round.png")

        print(f"mipmap-{density}: ic_launcher.png, ic_launcher_round.png")

    for density, size in FOREGROUND_SIZES.items():
        out_dir = RES / f"mipmap-{density}"
        out_dir.mkdir(parents=True, exist_ok=True)
        # Adaptive foreground: transparent, shield confined to the safe zone so
        # the launcher's mask cannot clip it.
        fg = render_shield(size * SS, 0.30, PRIMARY, with_check=True)
        fg.resize((size, size), Image.LANCZOS).save(out_dir / "ic_launcher_foreground.png")
        print(f"mipmap-{density}: ic_launcher_foreground.png")


if __name__ == "__main__":
    main()
