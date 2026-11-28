"""Image intake: SHA-256 of the file, a 64-bit perceptual hash (dHash) for near-duplicate matching, and OCR.

OCR order: the `tesseract` command-line program when it is installed on the server; otherwise the text the browser
extracted (tesseract.js) and sent along; otherwise nothing. The free Render tier has no tesseract binary, so there the
browser text is the path that works. Images themselves are not stored, only their hashes and the extracted text.
"""
import hashlib
import io
import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple

import re
import unicodedata

from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 40_000_000          # reject decompression bombs before decoding
SIMILAR_MAX_DISTANCE = 10        # of 64 bits; 0 = identical, <=10 = same picture re-encoded / resized / lightly edited
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class ImageError(ValueError):
    pass


def dhash(img: Image.Image) -> str:
    """Difference hash: shrink to 9x8 grey, compare each pixel with its right neighbour, 64 bits as 16 hex chars."""
    small = ImageOps.exif_transpose(img).convert("L").resize((9, 8), Image.LANCZOS)
    px = list(small.tobytes())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (1 if px[row * 9 + col] > px[row * 9 + col + 1] else 0)
    return f"{bits:016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def have_server_ocr() -> bool:
    """PRAHARI_SERVER_OCR=0 turns server OCR off (then the browser's text is used, as on the free Render tier)."""
    if os.environ.get("PRAHARI_SERVER_OCR", "1") == "0":
        return False
    return shutil.which("tesseract") is not None


def _ocr_languages() -> str:
    try:
        out = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True, timeout=10).stdout
        langs = {line.strip() for line in out.splitlines()[1:]}
        return "eng+hin" if {"eng", "hin"} <= langs else "eng"
    except Exception:
        return "eng"


def _ocr_variant(image_bytes: bytes, denoise: bool = False) -> bytes:
    """Grey, contrast-stretched copy, upscaled so the long side is about 1600 px: helps small, dark or blurred posters.
    With denoise, a 5x5 median filter first: removes speckle noise (it recovered the grainy, tilted PS02 poster P12)."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(image_bytes))).convert("L")
    if denoise:
        img = img.filter(ImageFilter.MedianFilter(5))
    scale = min(3.0, max(1.0, 1600 / max(img.size)))
    if scale > 1.0:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    buf = io.BytesIO()
    ImageOps.autocontrast(img).save(buf, "PNG")
    return buf.getvalue()


def server_ocr(image_bytes: bytes) -> str:
    """Three passes (as uploaded, a grey upscaled copy, a denoised copy), English + Hindi when installed."""
    if not have_server_ocr():
        return ""
    texts = []
    variants: List[Optional[bytes]] = [image_bytes]
    for denoise in (False, True):
        try:
            variants.append(_ocr_variant(image_bytes, denoise))
        except Exception:
            variants.append(None)
    for data in variants:
        if not data:
            continue
        try:
            proc = subprocess.run(["tesseract", "stdin", "stdout", "-l", _ocr_languages()], input=data,
                                  capture_output=True, timeout=45)
            t = proc.stdout.decode("utf-8", errors="replace").strip()
            if t and t not in texts:
                texts.append(t)
        except Exception:
            continue
    return "\n".join(texts)


_JUNK_TOKEN = re.compile(r"^[^\w@₹]+$")


def clean_ocr_text(text: str) -> str:
    """Drop OCR noise before classification: poster borders read as '|', '!', '«', '*' and lone Devanagari marks.
    Without this, 'CURRENT ACCOUNT | RENT' does not match the phrase 'current account rent'."""
    lines = []
    for line in (text or "").splitlines():
        toks = [t for t in line.split()
                if not _JUNK_TOKEN.match(t) and not all(unicodedata.category(ch).startswith("M") for ch in t)]
        if toks:
            lines.append(" ".join(toks))
    return "\n".join(lines)


def analyse_image(data: bytes) -> Tuple[Dict[str, Any], Image.Image]:
    if not data:
        raise ImageError("Empty file")
    if len(data) > MAX_IMAGE_BYTES:
        raise ImageError("Image exceeds the 8 MB limit")
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ImageError("File is not a readable image (PNG, JPEG, WebP, GIF or BMP)") from exc
    meta = {
        "sha256": hashlib.sha256(data).hexdigest(),
        "phash": dhash(img),
        "width": img.width, "height": img.height, "bytes": len(data), "format": img.format,
    }
    return meta, img


def find_similar(phash: str, others: List[Dict[str, Any]], max_distance: int = SIMILAR_MAX_DISTANCE) -> List[Dict[str, Any]]:
    """`others` are stored posts. Returns matches nearest first."""
    hits = []
    for p in others:
        h = (p.get("image") or {}).get("phash")
        if h and p.get("id"):
            d = hamming(phash, h)
            if d <= max_distance:
                hits.append({"postId": p["id"], "channel": p.get("channel"), "distance": d})
    hits.sort(key=lambda x: x["distance"])
    return hits
