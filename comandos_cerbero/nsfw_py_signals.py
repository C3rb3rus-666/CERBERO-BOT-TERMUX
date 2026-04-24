#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         CERBERO NSFW — Python Signal Engine  v1.0                          ║
║         Señales avanzadas de análisis de imagen (100% local, sin red)       ║
║                                                                              ║
║  Señal 1 — LBP  (Local Binary Pattern): micro-textura en zonas de piel      ║
║             Piel desnuda → alta uniformidad (superficie lisa)                ║
║             Ropa / pelo  → baja uniformidad (textura compleja)               ║
║                                                                              ║
║  Señal 2 — GLCM (Gray-Level Co-occurrence Matrix): energía de textura       ║
║             Alta energía en piel → uniforme → desnudo probable              ║
║             Baja energía         → heterogéneo → ropa / patrón              ║
║                                                                              ║
║  Señal 3 — Blob Shape: forma del blob de piel (bounding box + fill)         ║
║             Elongación vertical > 1.8 + alta cobertura → silueta corporal   ║
║                                                                              ║
║  Señal 4 — Shannon Entropy en piel: diversidad de luminosidad               ║
║             Entropía baja en zona de piel → superficie uniforme → desnudo   ║
║                                                                              ║
║  Entrada : ruta de imagen como sys.argv[1]                                  ║
║  Salida  : JSON por stdout con scores y contribución al suspectScore de JS   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import sys
import json
import numpy as np
from PIL import Image
import warnings
warnings.filterwarnings('ignore')

SIZE = 96  # resolución de trabajo (mismo que JS para coherencia)


# ─── Carga y preprocesamiento ─────────────────────────────────────────────────
def load_image(path):
    img = Image.open(path).convert('RGB')
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    return np.array(img, dtype=np.uint8)


def to_gray(rgb):
    return (0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]).astype(np.uint8)


# ─── Máscara de piel YCbCr BT.601 (mismo criterio que JS) ────────────────────
def ycbcr_skin_mask(rgb):
    r = rgb[:, :, 0].astype(float)
    g = rgb[:, :, 1].astype(float)
    b = rgb[:, :, 2].astype(float)
    Y  =  0.299 * r + 0.587 * g + 0.114 * b
    Cb = -0.169 * r - 0.331 * g + 0.500 * b + 128
    Cr =  0.500 * r - 0.419 * g - 0.081 * b + 128
    return (Y > 80) & (Cb >= 85) & (Cb <= 135) & (Cr >= 135) & (Cr <= 180)


# ─── Señal 1: LBP uniformidad en zonas de piel ───────────────────────────────
# Local Binary Pattern: compara cada píxel con sus 8 vecinos.
# Patrón "uniforme" (≤2 transiciones binarias) = textura regular = piel lisa.
# Ropa y pelo tienen patrones no-uniformes (muchas transiciones).
def lbp_uniformity(gray, skin_mask=None):
    h, w = gray.shape
    n_points = 8
    radius = 1
    angles = [2 * np.pi * p / n_points for p in range(n_points)]
    offsets = [(int(round(radius * np.sin(a))), int(round(radius * np.cos(a)))) for a in angles]

    pad = radius
    padded = np.pad(gray, pad, mode='reflect').astype(np.int16)
    center = padded[pad:pad + h, pad:pad + w]

    lbp = np.zeros((h, w), dtype=np.uint8)
    for bit, (dy, dx) in enumerate(offsets):
        neighbor = padded[pad + dy:pad + dy + h, pad + dx:pad + dx + w]
        lbp |= ((neighbor >= center).astype(np.uint8) << bit)

    # Códigos uniformes: ≤2 transiciones circulares 0→1 o 1→0
    def count_transitions(code):
        bits = [(code >> i) & 1 for i in range(8)]
        return sum(bits[i] != bits[(i + 1) % 8] for i in range(8))

    uniform_codes = set(c for c in range(256) if count_transitions(c) <= 2)

    mask = skin_mask if (skin_mask is not None and skin_mask.any()) else np.ones((h, w), dtype=bool)
    masked_lbp = lbp[mask]
    if len(masked_lbp) == 0:
        return 0.5
    uniform = np.isin(masked_lbp, list(uniform_codes)).sum()
    return float(uniform) / len(masked_lbp)


# ─── Señal 2: GLCM energy en zona de piel ────────────────────────────────────
# Gray-Level Co-occurrence Matrix a 16 niveles.
# Energy = Σ p(i,j)² → alta energía = textura repetitiva uniforme = piel lisa.
def glcm_energy(gray, skin_mask=None):
    quantized = (gray // 16).astype(np.uint8)  # 16 niveles

    if skin_mask is not None and skin_mask.any():
        rows, cols = np.where(skin_mask)
        pairs = [(int(quantized[r, c]), int(quantized[r, c + 1]))
                 for r, c in zip(rows, cols) if c + 1 < SIZE]
    else:
        h, w = quantized.shape
        pairs = [(int(quantized[y, x]), int(quantized[y, x + 1]))
                 for y in range(h) for x in range(w - 1)]

    if not pairs:
        return 0.05

    glcm = np.zeros((16, 16), dtype=float)
    for a, b in pairs:
        glcm[a, b] += 1

    total = glcm.sum()
    if total > 0:
        glcm /= total

    return float(np.sum(glcm ** 2))


# ─── Señal 3: Forma del blob de piel ─────────────────────────────────────────
# Bounding box de la región de piel.
# Elongación vertical > 1.8 + alta densidad de piel → silueta corporal típica
# de contenido explícito (cuerpo de pie, acostado, etc.)
def skin_blob_shape(skin_mask):
    if not skin_mask.any():
        return 1.0, 0.0

    rows = np.any(skin_mask, axis=1)
    cols = np.any(skin_mask, axis=0)
    rmin, rmax = int(np.where(rows)[0][0]),  int(np.where(rows)[0][-1])
    cmin, cmax = int(np.where(cols)[0][0]),  int(np.where(cols)[0][-1])

    height = rmax - rmin + 1
    width  = cmax - cmin + 1
    elongation = height / max(width, 1)
    fill_ratio = float(np.sum(skin_mask)) / max(height * width, 1)

    return elongation, fill_ratio


# ─── Señal 4: Entropía de Shannon en zona de piel ────────────────────────────
# Diversidad de luminosidad en los píxeles de piel.
# Entropía baja = píxeles muy similares entre sí = superficie homogénea = desnudo.
# Entropía alta = mucha variación = patrón de ropa, pelo, sombras complejas.
def shannon_entropy_skin(gray, skin_mask):
    if not skin_mask.any():
        return 4.0  # valor neutro

    skin_pixels = gray[skin_mask]
    hist, _ = np.histogram(skin_pixels, bins=32, range=(0, 256))
    hist = hist / max(hist.sum(), 1)
    hist = hist[hist > 0]
    return float(-np.sum(hist * np.log2(hist)))


# ─── Motor principal ──────────────────────────────────────────────────────────
def analyze(image_path):
    rgb       = load_image(image_path)
    gray      = to_gray(rgb)
    skin_mask = ycbcr_skin_mask(rgb)
    skin_ratio = float(np.sum(skin_mask)) / (SIZE * SIZE)

    # ── Señal 1: LBP ─────────────────────────────────────────────────────────
    lbp_unif = lbp_uniformity(gray, skin_mask if skin_mask.any() else None)
    # Piel desnuda: uniformidad LBP alta (>0.65). Con piel escasa, no puntúa.
    if skin_ratio > 0.15:
        lbp_suspect = max(0.0, (lbp_unif - 0.55) / 0.40)
    else:
        lbp_suspect = 0.0

    # ── Señal 2: GLCM energy ──────────────────────────────────────────────────
    glcm_e = glcm_energy(gray, skin_mask if skin_mask.any() else None)
    # Escalar: GLCM energía típica en piel desnuda ~0.08-0.15, ropa ~0.02-0.06
    if skin_ratio > 0.15:
        glcm_suspect = min(1.0, max(0.0, (glcm_e - 0.04) / 0.10))
    else:
        glcm_suspect = 0.0

    # ── Señal 3: Blob shape ───────────────────────────────────────────────────
    elongation, fill_ratio = skin_blob_shape(skin_mask)
    blob_suspect = 0.0
    if skin_ratio > 0.20:
        if elongation > 1.8 and fill_ratio > 0.35:
            blob_suspect = 1.0
        elif elongation > 1.4 and fill_ratio > 0.45:
            blob_suspect = 0.6

    # ── Señal 4: Shannon entropy ──────────────────────────────────────────────
    entropy = shannon_entropy_skin(gray, skin_mask)
    entropy_suspect = 0.0
    if skin_ratio > 0.20:
        if entropy < 2.8:
            entropy_suspect = 1.0
        elif entropy < 3.5:
            entropy_suspect = (3.5 - entropy) / 0.7

    # ── Score de contribución final (0.0 – 2.5) ───────────────────────────────
    # Ponderado: LBP y blob son los más confiables
    contribution = (
        lbp_suspect     * 0.75 +
        glcm_suspect    * 0.50 +
        blob_suspect    * 0.75 +
        entropy_suspect * 0.50
    )
    contribution = round(min(2.5, max(0.0, contribution)), 3)

    signals = []
    if lbp_suspect     > 0.35: signals.append(f"lbp_smooth({lbp_unif:.2f})")
    if glcm_suspect    > 0.35: signals.append(f"glcm_uniform({glcm_e:.4f})")
    if blob_suspect    > 0.35: signals.append(f"blob_v({elongation:.1f}x fill={fill_ratio:.2f})")
    if entropy_suspect > 0.35: signals.append(f"low_entropy({entropy:.2f})")

    return {
        "skin_ratio":                round(skin_ratio, 3),
        "lbp_uniformity":            round(float(lbp_unif), 3),
        "glcm_energy":               round(float(glcm_e), 5),
        "blob_elongation":           round(float(elongation), 2),
        "blob_fill":                 round(float(fill_ratio), 2),
        "skin_entropy":              round(float(entropy), 3),
        "suspect_score_contribution": contribution,
        "signals":                   signals,
        "error":                     None
    }


# ─── Entrypoint ───────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No image path provided",
            "suspect_score_contribution": 0.0,
            "signals": []
        }))
        sys.exit(1)
    try:
        result = analyze(sys.argv[1])
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "suspect_score_contribution": 0.0,
            "signals": []
        }))
        sys.exit(1)
