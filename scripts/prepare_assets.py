import os
import random
from PIL import Image

SRC_IMAGE = r"C:\Users\DELL\.gemini\antigravity\brain\4886f2c0-a10f-4272-8d89-512f4c9c1aee\.user_uploaded\media_1788433647877.jpg"
ASSET_DIR = r"C:\Users\DELL\.gemini\antigravity\scratch\owl-eye-tracker\assets"

def main():
    os.makedirs(ASSET_DIR, exist_ok=True)
    img = Image.open(SRC_IMAGE).convert("RGBA")
    w, h = img.size
    print(f"Source image loaded: {w}x{h}")

    # 1. Clean stray artifacts on the right:
    # Completely blend the box x: 860..915, y: 270..338 where the cursor and red dot were
    clean_img = img.copy()
    clean_pixels = clean_img.load()
    random.seed(42)

    for y in range(270, 338):
        for x in range(860, 915):
            r, g, b, a = clean_pixels[x, y]
            # Replace any pixel in this box that deviates even slightly from clean background paper
            # Background paper mean is around r: 233, g: 231, b: 226
            is_artifact = (abs(r - 233) > 10 or abs(g - 231) > 10 or abs(b - 226) > 10 or (r > g + 12))
            if is_artifact:
                sx = x + random.randint(-4, 4)
                sy = y - 75 + random.randint(-4, 4)
                clean_pixels[x, y] = clean_pixels[sx, sy]

    clean_path = os.path.join(ASSET_DIR, "owl_clean.png")
    clean_img.save(clean_path, format="PNG")
    print(f"Saved cleaned artwork: {clean_path}")

    # 2. Create owl_cutout.png where red eyes and pupils are transparent,
    # but the stippled feather borders around the eye socket remain completely intact!
    # Left eye center: (502.5, 135.5), rx: 10.5, ry: 8.5
    # Right eye center: (565.5, 134.5), rx: 10.5, ry: 8.5
    cutout_img = clean_img.copy()
    cutout_pixels = cutout_img.load()

    for y in range(h):
        for x in range(w):
            r, g, b, a = clean_pixels[x, y]
            dl = ((x - 502.5) / 10.5)**2 + ((y - 135.5) / 8.5)**2
            dr = ((x - 565.5) / 10.5)**2 + ((y - 134.5) / 8.5)**2

            if dl < 1.05 or dr < 1.05:
                d_val = min(dl, dr)
                # Keep outer feathers (stippling dots where r, g, b are dark, e.g. < 55)
                # but cut out the red iris and pupil inside
                is_stipple_feather = (r < 55 and g < 55 and b < 55 and d_val > 0.65)
                if not is_stipple_feather:
                    if d_val > 0.85:
                        alpha = int(255 * (d_val - 0.85) / 0.20)
                    else:
                        alpha = 0
                    cutout_pixels[x, y] = (r, g, b, alpha)

    cutout_path = os.path.join(ASSET_DIR, "owl_cutout.png")
    cutout_img.save(cutout_path, format="PNG")
    print(f"Saved transparent eye cutout: {cutout_path}")

    # 3. Extract a clean 256x256 paper texture tile from the top-left margin
    paper_tile = clean_img.crop((20, 20, 276, 276)).convert("RGB")
    paper_path = os.path.join(ASSET_DIR, "paper_tile.jpg")
    paper_tile.save(paper_path, quality=95)
    print(f"Saved paper tile texture: {paper_path}")

if __name__ == "__main__":
    main()
