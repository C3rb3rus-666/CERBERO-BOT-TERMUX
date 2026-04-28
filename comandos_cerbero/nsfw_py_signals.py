#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         CERBERO NSFW — Python Signal Engine  v2.0                          ║
║         8 señales avanzadas de análisis de imagen (100% local, sin red)     ║
║                                                                              ║
║  Señal 1 — LBP  (Local Binary Pattern): micro-textura en zonas de piel      ║
║  Señal 2 — GLCM (Gray-Level Co-occurrence Matrix): energía de textura       ║
║  Señal 3 — Blob Shape: elongación vertical de la silueta de piel            ║
║  Señal 4 — Shannon Entropy: diversidad de luminosidad en piel               ║
║  Señal 5 — DCT ratio: energía DCT concentrada en bajas frecuencias          ║
║  Señal 6 — Face detection (OpenCV Haar): cara presente reduce sospecha      ║
║  Señal 7 — Gabor texture: 12 filtros orientación/escala en piel             ║
║  Señal 8 — Local variance map: zonas lisas bordeadas por bordes             ║
║                                                                              ║
║  Entrada : ruta de imagen como sys.argv[1]                                  ║
║  Salida  : JSON por stdout                                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import sys
import json
import numpy as np
from PIL import Image
import warnings
warnings.filterwarnings('ignore')

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

try:
    from scipy.ndimage import uniform_filter
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

SIZE = 96

def load_image(path):
    img = Image.open(path).convert('RGB')
    img = img.resize((SIZE, SIZE), Image.LANCZOS)
    return np.array(img, dtype=np.uint8)

def to_gray(rgb):
    return (0.299*rgb[:,:,0] + 0.587*rgb[:,:,1] + 0.114*rgb[:,:,2]).astype(np.uint8)

def ycbcr_skin_mask(rgb):
    r,g,b = rgb[:,:,0].astype(float), rgb[:,:,1].astype(float), rgb[:,:,2].astype(float)
    Y  =  0.299*r + 0.587*g + 0.114*b
    Cb = -0.169*r - 0.331*g + 0.500*b + 128
    Cr =  0.500*r - 0.419*g - 0.081*b + 128
    return (Y>80)&(Cb>=85)&(Cb<=135)&(Cr>=135)&(Cr<=180)

def lbp_uniformity(gray, skin_mask=None):
    h,w = gray.shape
    angles = [2*np.pi*p/8 for p in range(8)]
    offsets = [(int(round(np.sin(a))), int(round(np.cos(a)))) for a in angles]
    padded = np.pad(gray, 1, mode='reflect').astype(np.int16)
    center = padded[1:1+h, 1:1+w]
    lbp = np.zeros((h,w), dtype=np.uint8)
    for bit,(dy,dx) in enumerate(offsets):
        neighbor = padded[1+dy:1+dy+h, 1+dx:1+dx+w]
        lbp |= ((neighbor>=center).astype(np.uint8) << bit)
    def count_t(code):
        bits = [(code>>i)&1 for i in range(8)]
        return sum(bits[i]!=bits[(i+1)%8] for i in range(8))
    uniform = set(c for c in range(256) if count_t(c)<=2)
    mask = skin_mask if (skin_mask is not None and skin_mask.any()) else np.ones((h,w),bool)
    ml = lbp[mask]
    if len(ml)==0: return 0.5
    return float(np.isin(ml, list(uniform)).sum()) / len(ml)

def glcm_energy(gray, skin_mask=None):
    q = (gray//16).astype(np.uint8)
    if skin_mask is not None and skin_mask.any():
        rows,cols = np.where(skin_mask)
        pairs = [(int(q[r,c]),int(q[r,c+1])) for r,c in zip(rows,cols) if c+1<SIZE]
    else:
        pairs = [(int(q[y,x]),int(q[y,x+1])) for y in range(SIZE) for x in range(SIZE-1)]
    if not pairs: return 0.05
    glcm = np.zeros((16,16),float)
    for a,b in pairs: glcm[a,b]+=1
    t = glcm.sum()
    if t>0: glcm/=t
    return float(np.sum(glcm**2))

def skin_blob_shape(skin_mask):
    if not skin_mask.any(): return 1.0, 0.0
    rows = np.any(skin_mask, axis=1); cols = np.any(skin_mask, axis=0)
    rmin,rmax = int(np.where(rows)[0][0]), int(np.where(rows)[0][-1])
    cmin,cmax = int(np.where(cols)[0][0]), int(np.where(cols)[0][-1])
    h,w = rmax-rmin+1, cmax-cmin+1
    return h/max(w,1), float(np.sum(skin_mask))/max(h*w,1)

def shannon_entropy_skin(gray, skin_mask):
    if not skin_mask.any(): return 4.0
    sp = gray[skin_mask]
    hist,_ = np.histogram(sp, bins=32, range=(0,256))
    hist = hist/max(hist.sum(),1); hist = hist[hist>0]
    return float(-np.sum(hist*np.log2(hist)))

def dct_low_freq_ratio(gray, skin_mask):
    if not HAS_CV2 or not skin_mask.any(): return 0.5
    block = 8; ratios = []
    for r in range(0, SIZE-block, block):
        for c in range(0, SIZE-block, block):
            pm = skin_mask[r:r+block, c:c+block]
            if pm.sum() < block*block*0.6: continue
            patch = gray[r:r+block, c:c+block].astype(np.float32)
            d = cv2.dct(patch)
            total = float(np.sum(d**2))
            if total < 1e-6: continue
            ratios.append(float(np.sum(d[:4,:4]**2)) / total)
    return float(np.mean(ratios)) if ratios else 0.5

def detect_faces(rgb):
    if not HAS_CV2: return {'found': False, 'count': 0}
    try:
        gray_big = cv2.cvtColor(
            np.array(Image.fromarray(rgb).resize((224,224))), cv2.COLOR_RGB2GRAY
        )
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        if cascade.empty(): return {'found': False, 'count': 0}
        faces = cascade.detectMultiScale(gray_big, scaleFactor=1.1, minNeighbors=4, minSize=(20,20))
        count = len(faces) if len(faces)>0 else 0
        return {'found': count>0, 'count': count}
    except Exception:
        return {'found': False, 'count': 0}

def gabor_texture_variance(gray, skin_mask):
    if not HAS_CV2 or not skin_mask.any(): return 0.0
    orientations = [0, np.pi/4, np.pi/2, 3*np.pi/4]
    wavelengths  = [4, 8, 12]
    responses = []
    gf = gray.astype(np.float32)/255.0
    for theta in orientations:
        rw = []
        for lam in wavelengths:
            try:
                kern = cv2.getGaborKernel((11,11), lam/(2*np.pi), theta, lam, 0.5, 0, cv2.CV_32F)
                filt = cv2.filter2D(gf, cv2.CV_32F, kern)
                sr = filt[skin_mask]
                if len(sr)>0: rw.append(float(np.mean(np.abs(sr))))
            except Exception:
                rw.append(0.0)
        responses.append(np.mean(rw) if rw else 0.0)
    return float(np.var(responses))

def local_variance_in_skin(gray, skin_mask):
    if not skin_mask.any(): return 1.0
    gf = gray.astype(np.float32)
    if HAS_SCIPY:
        mean_f  = uniform_filter(gf, size=7)
        mean_sq = uniform_filter(gf**2, size=7)
        lv = np.maximum(mean_sq - mean_f**2, 0)
        sv = lv[skin_mask]
    else:
        sv = (gray[skin_mask].astype(float) - gray[skin_mask].mean())**2
    return min(1.0, float(np.mean(sv))/16384.0) if len(sv)>0 else 1.0

def analyze(image_path):
    rgb       = load_image(image_path)
    gray      = to_gray(rgb)
    skin_mask = ycbcr_skin_mask(rgb)
    skin_ratio = float(np.sum(skin_mask))/(SIZE*SIZE)

    lbp_unif   = lbp_uniformity(gray, skin_mask if skin_mask.any() else None)
    lbp_s      = max(0.0,(lbp_unif-0.55)/0.40) if skin_ratio>0.15 else 0.0

    glcm_e     = glcm_energy(gray, skin_mask if skin_mask.any() else None)
    glcm_s     = min(1.0,max(0.0,(glcm_e-0.04)/0.10)) if skin_ratio>0.15 else 0.0

    elong, fill = skin_blob_shape(skin_mask)
    blob_s = 0.0
    if skin_ratio>0.20:
        if elong>1.8 and fill>0.35: blob_s = 1.0
        elif elong>1.4 and fill>0.45: blob_s = 0.6

    entropy    = shannon_entropy_skin(gray, skin_mask)
    ent_s = 0.0
    if skin_ratio>0.20:
        if entropy<2.8: ent_s = 1.0
        elif entropy<3.5: ent_s = (3.5-entropy)/0.7

    dct_ratio  = dct_low_freq_ratio(gray, skin_mask)
    dct_s = 0.0
    if skin_ratio>0.15:
        if dct_ratio>0.78: dct_s = 1.0
        elif dct_ratio>0.68: dct_s = (dct_ratio-0.68)/0.10

    face_info  = detect_faces(rgb)
    face_pen   = (-0.8*min(face_info['count'],2)) if face_info['found'] else (0.5 if skin_ratio>0.30 else 0.0)

    gabor_var  = gabor_texture_variance(gray, skin_mask)
    gabor_s = 0.0
    if skin_ratio>0.15:
        if gabor_var<0.0005: gabor_s = 1.0
        elif gabor_var<0.002: gabor_s = (0.002-gabor_var)/0.0015
        elif gabor_var>0.003: gabor_s = -0.5

    lv_norm    = local_variance_in_skin(gray, skin_mask)
    lv_s = 0.0
    if skin_ratio>0.15:
        if lv_norm<0.015: lv_s = 1.0
        elif lv_norm<0.040: lv_s = (0.040-lv_norm)/0.025

    contribution = round(min(3.5, max(0.0,
        lbp_s*0.70 + glcm_s*0.45 + blob_s*0.70 + ent_s*0.45 +
        dct_s*0.40 + face_pen*1.00 + gabor_s*0.35 + lv_s*0.30
    )), 3)

    signals = []
    if lbp_s     > 0.35: signals.append(f"lbp_smooth({lbp_unif:.2f})")
    if glcm_s    > 0.35: signals.append(f"glcm_uniform({glcm_e:.4f})")
    if blob_s    > 0.35: signals.append(f"blob_v({elong:.1f}x fill={fill:.2f})")
    if ent_s     > 0.35: signals.append(f"low_entropy({entropy:.2f})")
    if dct_s     > 0.35: signals.append(f"dct_lowfreq({dct_ratio:.2f})")
    if face_info['found']:       signals.append(f"face_found(-)")
    elif face_pen > 0:           signals.append(f"no_face_skin(+)")
    if abs(gabor_s) > 0.25:     signals.append(f"gabor({'low' if gabor_s>0 else 'high'}_var)")
    if lv_s      > 0.35:        signals.append(f"smooth_local_var({lv_norm:.3f})")

    return {
        "skin_ratio": round(skin_ratio,3),
        "lbp_uniformity": round(float(lbp_unif),3),
        "glcm_energy": round(float(glcm_e),5),
        "blob_elongation": round(float(elong),2),
        "blob_fill": round(float(fill),2),
        "skin_entropy": round(float(entropy),3),
        "dct_low_freq_ratio": round(float(dct_ratio),3),
        "face_detected": face_info['found'],
        "face_count": face_info['count'],
        "gabor_variance": round(float(gabor_var),5),
        "local_var_normalized": round(float(lv_norm),4),
        "suspect_score_contribution": contribution,
        "signals": signals,
        "has_cv2": HAS_CV2,
        "has_scipy": HAS_SCIPY,
        "error": None
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error":"No image path","suspect_score_contribution":0.0,"signals":[]}))
        sys.exit(1)
    try:
        print(json.dumps(analyze(sys.argv[1])))
    except Exception as e:
        print(json.dumps({"error":str(e),"suspect_score_contribution":0.0,"signals":[]}))
        sys.exit(1)
