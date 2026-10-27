# TARSEN Herramientas — instrucciones del proyecto

Herramientas web gratuitas para la sección "Herramientas" de la web de TARSEN (estudio de cálculo estructural, España). Objetivo: captar visitas de arquitectos, estudiantes y particulares y generar contactos. Especificación completa: documento "Contexto — Herramientas web TARSEN" (en el proyecto de Claude).

La web publicable vive en `web/` (es la carpeta que publica Cloudflare Pages). Las rutas de la tabla son relativas a `web/`. Fuera de `web/` solo hay documentación interna (`docs/`, este archivo), que no se publica.

| Carpeta | Herramienta | Normativa |
| --- | --- | --- |
| `/escalera/` | Predimensionador de escalera biapoyada | Código Estructural + CTE DB SE-AE |
| `/nieve/` | Carga de nieve con mapa | CTE DB SE-AE 3.5 y Anejo E |
| `/hormigon/` | Ambientes, tipo de hormigón y recubrimientos (dos pestañas) | Código Estructural cap. 9 (arts. 43 y 44) |
| `/sismo/` | Aceleración sísmica básica con mapa | NCSE-02 (2.1, 2.2, 1.2.3 y Anejo 1) |
| `/visor-ifc/` | Visor IFC sencillo: ver, medir, propiedades, ocultar por categoría | — |
| `/shared/` | Plantilla común, estilos con tokens de marca, ui.js, logos | — |

## Reglas de trabajo (ahorro de tokens)

- Una conversación por herramienta o subtarea. Al cerrarla, actualizar "Estado".
- HTML + CSS + JS vanilla (módulos ES), sin build. Excepción: `/visor-ifc/` (Vite + That Open Engine + web-ifc, versiones exactas fijadas; se publica su `dist/`).
- Reutilizar siempre `/shared/`. Ficheros pequeños (< 300 líneas). No releer el repo entero: solo lo que toca la tarea.
- En cambios, entregar solo el fragmento modificado. Commits pequeños en español sobre `main`.
- Sin npm en el sandbox de Claude: para el visor, verificar con `tsc` global y despliegue de prueba.

## Rigor normativo

- Nunca valores normativos de memoria. Solo de los PDF de `docs/normativa/` o subidos al proyecto. Si falta un dato: `PENDIENTE` en el JSON y preguntar.
- Datos en `<herramienta>/data/*.json`, separados de la lógica. Tablas largas (Anejo 1 NCSE-02) extraídas con script, no a mano.
- Cada fórmula y tabla en el código lleva comentario con artículo/tabla. Cada resultado en pantalla cita su origen.
- Antes de programar una herramienta: resumen de entradas, salidas y 2–3 casos de verificación calculados a mano.

## Comunes a todas las herramientas

- Español de España, tuteo, unidades SI con símbolo, coma decimal en pantalla.
- Aviso: herramienta de predimensionado/consulta; no sustituye al proyecto de un técnico competente.
- Interfaz simple: empieza directamente con preguntas (una por pantalla, avanza al pulsar la respuesta) y termina en el resultado, debajo del cual se muestran las respuestas como desplegables editables que recalculan al momento. Opciones con ayuda (p. ej. cementos ordenados por recubrimiento). Notas y comprobaciones plegadas.
- Cabecera: logo + botón "Contacto". CTA pequeño solo junto a los resultados ("Pide presupuesto a TARSEN"). Sin botón de imprimir, sin selector de tema, sin bloque grande de CTA (decisión del propietario, 27-10-2026).
- Cada herramienta lleva un desplegable «Cómo calcula esta herramienta» (en su `index.html`, antes del aviso): pasos del cálculo con fórmulas, criterios propios y referencia normativa de cada paso. Se actualiza en el mismo commit que cambie el cálculo.
- Responsive con prioridad móvil. SEO: `<title>`, `description` y H1 con la palabra clave.
- Sin cookies ni analítica de terceros. Todo en el navegador; los IFC no se suben a ningún servidor.
- Entrega: carpeta estática `web/` con rutas relativas. Publicación de prueba automática en Cloudflare Pages conectado a GitHub (rama `main`, carpeta de salida `web`); más adelante, dominio propio de TARSEN.

## Marca

Las herramientas imitan la web actual tarsen.es (su CSS está en `docs/web-tarsen-estilos.css`), que manda sobre el manual de `docs/marca.md` donde difieren. Tema oscuro por defecto: fondo `#0f1512` / `#141c17`, texto `#eef0e6`, `#b4bbae` y `#778072`, titulares en `#e2e8ce`, acento `#acbfa4`, líneas `#e2e8ce1f` / `#e2e8ce3d`. Tipografías Bricolage Grotesque 600 (titulares y cifras) y DM Sans 400/500 (texto). Botones en píldora (radio 999px), el principal relleno `#e2e8ce` con hover `#acbfa4`; campos con radio 6px y tarjetas con radio 10px. Solo tema oscuro. Sin emojis. Logos en `shared/brand/` (INV sobre oscuro).

## Propietario

No programa. Cualquier paso manual (subir al hosting, GitHub): pasos numerados y sin tecnicismos.

## Estado

- [x] 0. Plantilla común `/shared/` (estilos.css, ui.js, plantilla.html). Contacto: https://tarsen.es/#contacto.
- [x] 1. `/hormigon/` (ambientes + recubrimientos). Hecho: dosificación (tablas 43.2.1.a/b, avisos 43.3), recubrimientos (tablas 43.4.1, 44.2.1.1.a/b, 44.3, 44.4, 44.5, terreno 70 mm, Ø y árido). Verificado con 3 casos (XC1 → 16/26 mm; XS1 → 40/45 mm; XC2+XA1 contra terreno → 70/80 mm). Asistente de preguntas con tabla 27.1.a/b (cap. 7). Designación T-R/C/TM/A con art. 33.4, 33.5 y 33.6 (cap. 8). Flujo: cuestionario con avance automático → resultado + respuestas editables. XS1 a < 5 km de la costa aunque esté protegido (criterio TARSEN). Pregunta Ø máximo de obra y Ø de cercos/estribos: cmin se mide al estribo y la armadura principal exige (Ø − Øe) y (k·TM − Øe) [Inferencia sobre arts. 43.4.1 y 44.2.1.1 a)]; caso XC1, CEM I, Ø12, estribo Ø8, TM20 → 15/25 mm al estribo y 33 mm a la principal.
- [x] 2. `/escalera/` — enlazada en la portada. Normativa: Anejo 19 (A19.2.1, 3.1.6, 3.1.7, 3.23, 6.2.2, 7.4.2, 9.2.1.1, 9.3.1), cap. 8 tabla 34.2.a, DB SE tabla 4.1 (γG 1,35, γQ 1,50), DB SE-AE (tabla 3.1, 3.1.1.3, tabla C.1). Menor h (desde 15 cm, cada 1 cm) que cumple esbeltez (luz inclinada) y cortante sin cercos (ρl con la mitad de As, 9.3.1.2). Peldaños hormigonados (24 kN/m³) o de fábrica (15 kN/m³ aprox., criterio TARSEN); nunca colaboran. Parrilla superior en toda la losa: longitudinal para max(15 % Md, As,min) y transversal del 20 % de la superior (criterio TARSEN). Pregunta el ancho del tramo y da nº de barras «nØd c/s»: n = techo((longitud − 2·rec)/s) + 1 (ancho para longitudinales, longitud inclinada para transversales). Croquis con transversales como puntos. Verificado: A1, 17,5/28, peldaños de hormigón, solado 1,5, HA-25, B 500 S, rec. 30 mm → L = 3/4/5 m: h 16/20/25 cm, Ø10 c/20, Ø10 c/15, Ø12 c/15; L = 4 m, ancho 1 m → inferior 8Ø10 c/15 + 20Ø8 c/25, superior 6Ø10 c/20 + 20Ø8 c/25; L = 4 m con fábrica → h 20 cm, qd 16,26 kN/m². Cuestionario común en `shared/asistente.js` (admite preguntas numéricas).
- [x] 3. `/nieve/` — mapa Leaflet (teselas OSM oscurecidas por CSS), buscador Nominatim (1 petición/s, sin autocompletar), altitud del MDT del IGN (API-Coverages: 25 m Península/Baleares, 500 m Canarias; editable; si falla, se pide a mano). Zona automática: figura E.2 digitalizada por script `docs/scripts/nieve_zonas_e2.py` (UTM huso 30, 70 cruces de retícula, error 0,18 px ≈ 0,3 km) → `nieve/data/zonas_e2.json`; Canarias zona 7 y Ceuta/Melilla zona 6 por regla; fuera del dibujo, zona más cercana a < 20 km; aviso a < 5 km de otra zona (criterio TARSEN); zona editable. Contraste: en las 52 capitales la zona detectada reproduce la tabla 3.8 con la E.2 (±0,08 kN/m², redondeo). sk: tabla 3.8 en capitales (opción de usar E.2 con la altitud del punto; decisión del propietario) o E.2 interpolada linealmente (criterio TARSEN, anotado). μ 3.5.3.2, ±20 % viento 3.5.1.3, simplificado 1,0 kN/m² como opción bajo 1.000 m (3.5.1.1), hielo pn 3.5.1.4. Flujo propio: el mapa es la pregunta; al poner la chincheta sale el resultado con datos editables. Verificado: Murcia 3.8 → 0,20; zona 2, 1.100 m, 45° → sk 1,75, qn 0,88, pn 1,31 kN/m; zona 4, 650 m, impedimento, expuesta → 0,66; zona 1, 1.700 m → sin valor (3.5.2.3); Jaca (zona 2, 820 m) → 1,14 kN/m². PENDIENTE: comprobar en producción que la API del IGN responde desde el navegador (CORS).
- [ ] 4. `/sismo/`
- [ ] 5. `/visor-ifc/`

Subido: `docs/normativa/CE-capitulo-9-durabilidad.pdf`; caps. 7 (art. 27) y 8 (art. 33) del CE en el proyecto de Claude. Subido también `docs/normativa/CTE-DB-SE-AE.pdf` y la figura E.2 extraída. Pendiente de subir a `docs/normativa/`: Código Estructural (tipificación del hormigón, flexión, cortante, cuantías, esbeltez) y NCSE-02 (1.2, 2.1, 2.2, figura 2.1 y Anejo 1).
