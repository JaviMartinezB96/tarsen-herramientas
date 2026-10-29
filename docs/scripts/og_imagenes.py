"""Genera las imágenes para compartir (Open Graph, 1200 x 630 px) de cada herramienta.

Uso:  python3 docs/scripts/og_imagenes.py      (desde la raíz del repo; necesita Playwright)
Salida: web/shared/og/<clave>.png

Para una herramienta nueva: añadir una línea a HERRAMIENTAS y volver a ejecutar.
Tipografía: Inter (instalada en el sandbox) en lugar de Bricolage Grotesque / DM Sans,
porque Google Fonts no es accesible desde el sandbox. El logotipo es el SVG de marca.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
SALIDA = WEB / "shared" / "og"
LOGO = (WEB / "shared" / "brand" / "TARSEN-COLOR-INV-Horizontal.svg").read_text(encoding="utf-8")

# clave, título, subtítulo, ruta mostrada
HERRAMIENTAS = [
    ("portada", "Herramientas de cálculo estructural", "Gratuitas, según el Código Estructural y el CTE", ""),
    ("hormigon", "Clases de exposición y recubrimientos", "Designación del hormigón y recubrimiento nominal según el Código Estructural", "hormigon/"),
    ("escalera", "Calculadora de escalera de hormigón armado", "Canto y armado de predimensionado según el Código Estructural y el CTE", "escalera/"),
    ("nieve", "Carga de nieve con mapa", "CTE DB SE-AE: zona y altitud automáticas al marcar la parcela", "nieve/"),
    ("visor-ifc", "Visor IFC online gratis", "Varios modelos superpuestos, cortes, caja de sección y propiedades", "visor-ifc/"),
]

PLANTILLA = """<!doctype html><html><head><meta charset="utf-8"><style>
*{{margin:0;box-sizing:border-box}}
body{{width:1200px;height:630px;background:#0f1512;font-family:Inter,sans-serif;color:#eef0e6;
  position:relative;overflow:hidden}}
.reticula{{position:absolute;inset:0;background-image:
  linear-gradient(#e2e8ce0d 1px,transparent 1px),linear-gradient(90deg,#e2e8ce0d 1px,transparent 1px);
  background-size:60px 60px}}
.caja{{position:absolute;inset:72px 80px;display:flex;flex-direction:column}}
.logo svg{{width:260px;height:auto;display:block}}
.etiqueta{{margin-top:auto;align-self:flex-start;border:1px solid #e2e8ce3d;border-radius:999px;
  padding:8px 20px;font-size:22px;color:#acbfa4}}
h1{{margin-top:26px;font-family:"Inter Display",Inter,sans-serif;font-weight:600;font-size:{tam}px;
  line-height:1.05;letter-spacing:-0.02em;color:#e2e8ce;max-width:1000px}}
p{{margin-top:22px;font-size:28px;line-height:1.3;color:#b4bbae;max-width:1040px}}
.url{{margin-top:auto;padding-top:28px;font-size:24px;color:#778072}}
.url b{{color:#acbfa4;font-weight:500}}
</style></head><body><div class="reticula"></div><div class="caja">
<div class="logo">{logo}</div>
<span class="etiqueta">Herramienta gratuita</span>
<h1>{titulo}</h1><p>{sub}</p>
<div class="url">herramientas.tarsen.es/<b>{ruta}</b></div>
</div></body></html>"""


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        nav = p.chromium.launch()
        pag = nav.new_page(viewport={"width": 1200, "height": 630})
        for clave, titulo, sub, ruta in HERRAMIENTAS:
            tam = 72 if len(titulo) <= 32 else 60
            pag.set_content(PLANTILLA.format(logo=LOGO, titulo=titulo, sub=sub, ruta=ruta, tam=tam))
            pag.screenshot(path=str(SALIDA / f"{clave}.png"))
            print("ok", clave)
        nav.close()


if __name__ == "__main__":
    main()
