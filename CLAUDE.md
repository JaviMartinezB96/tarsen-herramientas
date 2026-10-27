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
- CTA final: "¿Necesitas el cálculo completo? Cuéntanos tu proyecto" con enlace a contacto.
- Botón "Imprimir / PDF" (`window.print()`) con hoja de impresión: logo, fecha, entradas, resultados y referencias.
- Responsive con prioridad móvil. SEO: `<title>`, `description` y H1 con la palabra clave.
- Sin cookies ni analítica de terceros. Todo en el navegador; los IFC no se suben a ningún servidor.
- Entrega: carpeta estática con rutas relativas, lista para subir al hosting propio de TARSEN.

## Marca

Fuente de verdad: `docs/marca.md` y `docs/marca-tokens.json`. Resumen: `brand-ink` #262626, `brand-sage` #ACBFA4 (solo relleno, nunca texto sobre blanco), `brand-pale` #E2E8CE. Tema claro por defecto y tema "Sobre oscuro"; el visor IFC siempre oscuro. Red Hat Display 800 para titulares y cifras; Red Hat Text 400/500 para el resto. Aristas vivas, sin degradados ni sombras, sin emojis. Logos en `shared/brand/`.

## Propietario

No programa. Cualquier paso manual (subir al hosting, GitHub): pasos numerados y sin tecnicismos.

## Estado

- [x] 0. Plantilla común `/shared/` (estilos.css, ui.js, plantilla.html). Contacto: https://tarsen.es/#contacto.
- [~] 1. `/hormigon/` (ambientes + recubrimientos). Hecho: dosificación (tablas 43.2.1.a/b, avisos 43.3), recubrimientos (tablas 43.4.1, 44.2.1.1.a/b, 44.3, 44.4, 44.5, terreno 70 mm, Ø y árido). Verificado con 3 casos (XC1 → 16/26 mm; XS1 → 40/45 mm; XC2+XA1 contra terreno → 70/80 mm). Asistente de preguntas con tabla 27.1.a/b (cap. 7). PENDIENTE: formato de designación del hormigón (falta el artículo de tipificación).
- [ ] 2. `/escalera/`
- [ ] 3. `/nieve/`
- [ ] 4. `/sismo/`
- [ ] 5. `/visor-ifc/`

Subido: `docs/normativa/CE-capitulo-9-durabilidad.pdf`; cap. 7 del CE (art. 27) en el proyecto de Claude. Pendiente de subir a `docs/normativa/`: extractos de CTE DB SE-AE (3.5 y Anejo E), Código Estructural (tipificación del hormigón, flexión, cortante, cuantías, esbeltez) y NCSE-02 (1.2, 2.1, 2.2, figura 2.1 y Anejo 1).
