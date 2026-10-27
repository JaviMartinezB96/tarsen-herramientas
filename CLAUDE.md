# TARSEN Herramientas — instrucciones del proyecto

Herramientas web gratuitas para la sección "Herramientas" de la web de TARSEN (estudio de cálculo estructural, España). Objetivo: captar visitas de arquitectos, estudiantes y particulares y generar contactos. Especificación completa: documento "Contexto — Herramientas web TARSEN" (en el proyecto de Claude).

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
- Responsive con prioridad móvil. SEO: `<title>`, `description` y H1 con la palabra clave.
- Sin cookies ni analítica de terceros. Todo en el navegador; los IFC no se suben a ningún servidor.
- Entrega: carpeta estática con rutas relativas, lista para subir al hosting propio de TARSEN.

## Marca

Las herramientas imitan la web actual tarsen.es (su CSS está en `docs/web-tarsen-estilos.css`), que manda sobre el manual de `docs/marca.md` donde difieren. Tema oscuro por defecto: fondo `#0f1512` / `#141c17`, texto `#eef0e6`, `#b4bbae` y `#778072`, titulares en `#e2e8ce`, acento `#acbfa4`, líneas `#e2e8ce1f` / `#e2e8ce3d`. Tipografías Bricolage Grotesque 600 (titulares y cifras) y DM Sans 400/500 (texto). Botones en píldora (radio 999px), el principal relleno `#e2e8ce` con hover `#acbfa4`; campos con radio 6px y tarjetas con radio 10px. Solo tema oscuro. Sin emojis. Logos en `shared/brand/` (INV sobre oscuro).

## Propietario

No programa. Cualquier paso manual (subir al hosting, GitHub): pasos numerados y sin tecnicismos.

## Estado

- [x] 0. Plantilla común `/shared/` (estilos.css, ui.js, plantilla.html). Contacto: https://tarsen.es/#contacto.
- [x] 1. `/hormigon/` (ambientes + recubrimientos). Hecho: dosificación (tablas 43.2.1.a/b, avisos 43.3), recubrimientos (tablas 43.4.1, 44.2.1.1.a/b, 44.3, 44.4, 44.5, terreno 70 mm, Ø y árido). Verificado con 3 casos (XC1 → 16/26 mm; XS1 → 40/45 mm; XC2+XA1 contra terreno → 70/80 mm). Asistente de preguntas con tabla 27.1.a/b (cap. 7). Designación T-R/C/TM/A con art. 33.4, 33.5 y 33.6 (cap. 8). Flujo: cuestionario con avance automático → resultado + respuestas editables. XS1 a < 5 km de la costa aunque esté protegido (criterio TARSEN). Pregunta Ø máximo de obra y Ø de cercos/estribos: cmin se mide al estribo y la armadura principal exige (Ø − Øe) y (k·TM − Øe) [Inferencia sobre arts. 43.4.1 y 44.2.1.1 a)]; caso XC1, CEM I, Ø12, estribo Ø8, TM20 → 15/25 mm al estribo y 33 mm a la principal.
- [ ] 2. `/escalera/`
- [ ] 3. `/nieve/`
- [ ] 4. `/sismo/`
- [ ] 5. `/visor-ifc/`

Subido: `docs/normativa/CE-capitulo-9-durabilidad.pdf`; caps. 7 (art. 27) y 8 (art. 33) del CE en el proyecto de Claude. Pendiente de subir a `docs/normativa/`: extractos de CTE DB SE-AE (3.5 y Anejo E), Código Estructural (tipificación del hormigón, flexión, cortante, cuantías, esbeltez) y NCSE-02 (1.2, 2.1, 2.2, figura 2.1 y Anejo 1).
