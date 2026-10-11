"""Turn the Chrome screenshot of the paper invoice into a phone-photo-like JPEG.

Usage: python3 -I photo-postprocess.py <in.png> <out.jpg> [quality]

Warm tint, a touch of blur and fixed-seed sensor noise, then JPEG. Uses Pillow;
numpy is optional (without it the noise step is skipped). Output has no EXIF.
"""
import sys

from PIL import Image, ImageEnhance, ImageFilter


def main() -> None:
    src, dst = sys.argv[1], sys.argv[2]
    quality = int(sys.argv[3]) if len(sys.argv) > 3 else 82

    img = Image.open(src).convert("RGB")

    # Warm, slightly flat indoor light.
    r, g, b = img.split()
    r = r.point(lambda v: min(255, int(v * 1.035 + 4)))
    g = g.point(lambda v: min(255, int(v * 1.0 + 1)))
    b = b.point(lambda v: int(v * 0.915))
    img = Image.merge("RGB", (r, g, b))
    img = ImageEnhance.Contrast(img).enhance(0.95)

    # Phone lens softness.
    img = img.filter(ImageFilter.GaussianBlur(radius=0.55))

    # Fixed-seed sensor noise so reruns give the same pixels.
    try:
        import numpy as np

        rng = np.random.default_rng(1003)
        arr = np.asarray(img).astype(np.float32)
        luma = rng.normal(0.0, 3.2, size=arr.shape[:2])[..., None]
        chroma = rng.normal(0.0, 1.2, size=arr.shape)
        arr = np.clip(arr + luma + chroma, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr, "RGB")
    except ImportError:
        pass

    img.save(dst, "JPEG", quality=quality, optimize=True, subsampling=2)


if __name__ == "__main__":
    main()
