"""Digitaliza las zonas de clima invernal de la figura E.2 del CTE DB SE-AE (Anejo E).

Entrada : docs/normativa/DBSE-AE-figura-E2.jpg (imagen original extraída del PDF, pág. SE-AE 42, con pdfimages).
Salida  : web/nieve/data/zonas_e2.json (GeoJSON, lon/lat WGS84) y un informe de ajuste por pantalla.

Método:
 1. Georreferencia: la figura está en UTM huso 30 (meridiano 3° W vertical). Se detectan los cruces de la
    retícula de 1° (paralelos y meridianos) en el mar y en el territorio extranjero y se ajusta una
    afinidad UTM → píxel por mínimos cuadrados. Comprobado: ~70 cruces, error medio < 1 px (≈ 1,5 km).
 2. Segmentación: territorio español = píxeles que no son mar (blanco), ni país extranjero (beige), ni
    retícula. Las líneas oscuras (límites de zona, costa, rótulos) separan regiones; cada zona se toma
    desde una semilla en su interior. Baleares completa en zona 5 (rotulada así en la figura).
 3. Los huecos (rótulos, puntos de ciudades y las propias líneas) se asignan a la zona más cercana.
 4. Contornos → polígonos simplificados (0,75 px) → UTM → lon/lat.
 Canarias (zona 7, recuadro) y Ceuta y Melilla (zona 6, rótulo junto a ellas) se tratan en la app por
 reglas, no por polígono. Uso: python3 docs/scripts/nieve_zonas_e2.py  (numpy, scipy, opencv, Pillow)
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

RAIZ = Path(__file__).resolve().parents[2]
IMG = RAIZ / "docs/normativa/DBSE-AE-figura-E2.jpg"
SALIDA = RAIZ / "web/nieve/data/zonas_e2.json"

# ---------- Transversa de Mercator (Snyder 1987, ecs. 8-9 a 8-11 y 8-12 a 8-25), GRS80, huso 30 ----------
A_, F_ = 6378137.0, 1 / 298.257222101
E2 = F_ * (2 - F_); EP2 = E2 / (1 - E2); K0 = 0.9996; LON0 = -3.0


def _m(phi):
    return A_ * ((1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256) * phi
                 - (3 * E2 / 8 + 3 * E2**2 / 32 + 45 * E2**3 / 1024) * np.sin(2 * phi)
                 + (15 * E2**2 / 256 + 45 * E2**3 / 1024) * np.sin(4 * phi) - (35 * E2**3 / 3072) * np.sin(6 * phi))


def utm(lon, lat):
    phi = np.radians(lat); lam = np.radians(np.asarray(lon, float) - LON0)
    n = A_ / np.sqrt(1 - E2 * np.sin(phi)**2); t = np.tan(phi)**2; c = EP2 * np.cos(phi)**2; a = lam * np.cos(phi)
    x = K0 * n * (a + (1 - t + c) * a**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * EP2) * a**5 / 120) + 500000
    y = K0 * (_m(phi) + n * np.tan(phi) * (a**2 / 2 + (5 - t + 9 * c + 4 * c**2) * a**4 / 24
                                          + (61 - 58 * t + t**2 + 600 * c - 330 * EP2) * a**6 / 720))
    return x, y


def utm_inv(x, y):
    m = y / K0; mu = m / (A_ * (1 - E2 / 4 - 3 * E2**2 / 64 - 5 * E2**3 / 256))
    e1 = (1 - np.sqrt(1 - E2)) / (1 + np.sqrt(1 - E2))
    p1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * np.sin(2 * mu) + (21 * e1**2 / 16 - 55 * e1**4 / 32) * np.sin(4 * mu)
          + (151 * e1**3 / 96) * np.sin(6 * mu) + (1097 * e1**4 / 512) * np.sin(8 * mu))
    c1 = EP2 * np.cos(p1)**2; t1 = np.tan(p1)**2; n1 = A_ / np.sqrt(1 - E2 * np.sin(p1)**2)
    r1 = A_ * (1 - E2) / (1 - E2 * np.sin(p1)**2)**1.5; d = (x - 500000) / (n1 * K0)
    lat = p1 - (n1 * np.tan(p1) / r1) * (d**2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * EP2) * d**4 / 24
                                        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * EP2 - 3 * c1**2) * d**6 / 720)
    lon = (d - (1 + 2 * t1 + c1) * d**3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * EP2 + 24 * t1**2) * d**5 / 120) / np.cos(p1)
    return LON0 + np.degrees(lon), np.degrees(lat)


# ---------- Imagen y máscaras ----------
im = np.asarray(Image.open(IMG).convert("RGB")).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(2), im.min(2)
H, W = mx.shape
mar = mn > 238
extranjero = (abs(r - g) < 8) & (r - b > 12) & (r - b < 42) & (r > 195)       # beige de Portugal, Francia y África
reticula = (mx - mn < 22) & (mx < 225) & (mx > 110)
oscuro = mx < 120                                                              # límites de zona, costa y rótulos
marco = np.zeros_like(mar)
marco[:, :72] = marco[:, 1192:] = marco[:40, :] = marco[748:, :] = True
marco[585:, :474] = True                                                       # recuadro de Canarias


def fuera(x, y):
    return x > 1188 or (x < 474 and y > 585) or (464 < x < 475) or y < 45


# ---------- 1. Georreferencia: cruces de la retícula ----------
def detectar(cu, cv, R):
    fondo = mar | extranjero
    pts = []
    for lon in range(-13, 6):
        for lat in range(34, 45):
            X, Y = utm(lon, lat)
            u, v = cu @ [X, Y, 1], cv @ [X, Y, 1]
            ui, vi = int(round(u)), int(round(v))
            if fuera(u, v) or not (R < ui < W - R - 1 and R < vi < H - R - 1):
                continue
            if fondo[vi - R:vi + R + 1, ui - R:ui + R + 1].mean() < 0.6:
                continue
            gw = reticula[vi - R:vi + R + 1, ui - R:ui + R + 1]
            cols, rows = gw.sum(0), gw.sum(1)
            if cols.max() < R or rows.max() < R:
                continue

            def cen(h):
                k = h.argmax(); s = slice(max(0, k - 2), k + 3); w = h[s]
                return (np.arange(len(h))[s] * w).sum() / w.sum()
            pts.append((lon, lat, ui - R + cen(cols), vi - R + cen(rows)))
    return np.array(pts)


def ajustar(G):
    X, Y = utm(G[:, 0], G[:, 1]); A = np.c_[X, Y, np.ones_like(X)]
    cu = np.linalg.lstsq(A, G[:, 2], rcond=None)[0]; cv = np.linalg.lstsq(A, G[:, 3], rcond=None)[0]
    return cu, cv, np.c_[A @ cu - G[:, 2], A @ cv - G[:, 3]]


# Arranque con 4 cruces leídos a mano en recortes ampliados: (1° E, 39° N), (4° E, 41° N), (4° W, 35° N), (0°, 36° N)
G = np.array([(1, 39, 963, 425), (4, 41, 1136, 270), (-4, 35, 648, 718), (0, 36, 908, 643)], float)
cu, cv, _ = ajustar(G)
for R in (16, 8, 8):
    G = detectar(cu, cv, R)
    cu, cv, res = ajustar(G)
    ok = np.abs(res).max(1) < 2.5                                               # descarta cruces dudosos
    G = G[ok]; cu, cv, res = ajustar(G)
print(f"Georreferencia: {len(G)} cruces, error medio {np.sqrt((res**2).mean()):.2f} px, máximo {np.abs(res).max():.2f} px")
M = np.array([[cu[0], cu[1]], [cv[0], cv[1]]]); Minv = np.linalg.inv(M)
print(f"Escala: {1 / np.sqrt(abs(np.linalg.det(M))):.0f} m/px")


def px_a_lonlat(px):
    XY = (Minv @ (px - np.array([cu[2], cv[2]])).T).T
    return utm_inv(XY[:, 0], XY[:, 1])


# ---------- 2. Segmentación ----------
tierra = ~mar & ~extranjero & ~reticula & ~marco
libre = tierra & ~ndi.binary_dilation(oscuro, iterations=1)
lab, _ = ndi.label(libre)
SEMILLAS = {1: (560, 190), 2: (900, 230), 3: (650, 250), 4: (600, 420), 5: (800, 400), 6: (650, 560)}
zona = np.zeros((H, W), np.uint8)
for z, (x, y) in SEMILLAS.items():
    assert lab[y, x], f"semilla de la zona {z} sobre una línea"
    zona[lab == lab[y, x]] = z
# Baleares (zona 5 en la figura): toda la tierra al este de 0° y entre 38,5° y 40,3° N aprox.
bal = np.zeros_like(tierra); bal[330:470, 960:1192] = True
lb, nb = ndi.label(tierra & bal & ~ndi.binary_dilation(reticula, iterations=1))
tam = ndi.sum(np.ones_like(lb), lb, range(1, nb + 1))
islas = np.isin(lb, 1 + np.flatnonzero(tam >= 25))                             # descarta rótulos y retícula
zona[ndi.binary_dilation(islas, iterations=2) & ~mar & bal] = 5                 # recupera la línea de costa

# ---------- 3. Rellenar rótulos y líneas con la zona más cercana ----------
espana = ndi.binary_fill_holes(ndi.binary_closing(zona > 0, iterations=3)) | (zona > 0)
_, (iy, ix) = ndi.distance_transform_edt(zona == 0, return_indices=True)
zona = np.where(espana, zona[iy, ix], 0).astype(np.uint8)

# ---------- 4. Polígonos ----------
feats = []
for z in range(1, 7):
    m = (zona == z).astype(np.uint8)
    cnts, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    polys = []
    for i, c in enumerate(cnts):
        if hier[0][i][3] != -1 or cv2.contourArea(c) < 4:                     # solo exteriores, sin migas
            continue
        c = cv2.approxPolyDP(c, 0.75, True).reshape(-1, 2).astype(float) + 0.5  # centro del píxel
        lon, lat = px_a_lonlat(c)
        anillo = [[round(float(a), 4), round(float(b), 4)] for a, b in zip(lon, lat)]
        anillo.append(anillo[0])
        polys.append([anillo])
    feats.append({"type": "Feature", "properties": {"zona": z},
                  "geometry": {"type": "MultiPolygon", "coordinates": polys}})
    print(f"Zona {z}: {len(polys)} polígonos, {sum(len(p[0]) for p in polys)} vértices")

SALIDA.write_text(json.dumps({
    "type": "FeatureCollection",
    "_fuente": "CTE DB SE-AE, Anejo E, figura E.2 'Zonas climáticas de invierno', digitalizada con "
               "docs/scripts/nieve_zonas_e2.py (UTM huso 30, error de georreferencia < 1,5 km; "
               "precisión limitada por el grosor de las líneas de la figura, ~3 km).",
    "features": feats}, separators=(",", ":")))
Image.fromarray((np.array([[0, 0, 0], [230, 80, 80], [80, 200, 80], [80, 80, 230], [220, 200, 60],
                           [200, 80, 200], [60, 200, 200]], np.uint8)[zona] * 0.6 + im * 0.4).astype(np.uint8)
                ).save(RAIZ / "docs/scripts/nieve_zonas_e2_control.png")
print("Escrito", SALIDA.relative_to(RAIZ))
