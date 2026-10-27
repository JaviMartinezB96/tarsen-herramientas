TARSEN es un estudio de cálculo estructural. La marca transmite precisión y tranquilidad: estructura limpia, mucho aire, dos verdes suaves sobre una tinta casi negra. Todo lo que se diseñe debe parecer calculado, no decorado.

## Contenido y tono

- Habla de **tú** al cliente (arquitecto, promotor, constructor) y en **primera persona del plural** para el estudio: "Estudiamos tu caso", "Te enviamos un modelo previo".
- Frases cortas, directas y cercanas. Sin tecnicismos gratuitos ni formalismos. Sin emojis.
- Promete tranquilidad y ausencia de sorpresas, no potencia de cálculo. Ejemplos reales de la web:
  - Titular: "Quédate tranquilo, está todo calculado."
  - Subtítulo: "Estudiamos tu caso, optimizamos la solución a medida y no nos despegamos del proyecto hasta ver la obra terminada."
  - Contacto: "Con el proyecto básico nos basta para darte plazo y precio cerrado."
  - Entregables: "No te mandamos la salida del programa. Todo maquetado y ordenado ya con tu cajetín para que no tengas que tocar nada antes de visar."
- Mayúsculas solo al inicio de frase. El nombre de marca siempre como **TARSEN**, en mayúsculas.
- Botones en imperativo y concretos: "Cuéntanos tu proyecto", "Ver proyectos".

## Color

- La paleta oficial son tres colores: `brand-ink` (#262626), `brand-sage` (#ACBFA4) y `brand-pale` (#E2E8CE). No añadas otros tonos de marca.
- Fondo de página en `surface`; texto en `text`; secundario en `text-muted`.
- Usa `brand-sage` y `accent` solo como **relleno** (barras, subrayados, bloques, hover). Nunca como color de texto sobre blanco: no llega a contraste legible. Sobre `brand-sage` el texto va en `brand-ink`.
- `brand-pale` / `surface-soft` para bandas y tarjetas destacadas sobre fondo blanco.
- El tema **Sobre oscuro** reproduce la versión invertida del logo: fondo `brand-ink`, texto `brand-pale`, acento `brand-sage`.
- `surface-inverse` + `text-on-inverse` para el CTA principal y bandas de cierre.
- Para imprenta usa los HEX. Los valores CMYK/RGB que aparecen en el manual 2024 son restos de plantilla (corresponden a un naranja) y no deben usarse; pide la conversión a CMYK desde el HEX.

## Tipografía

- Dos familias, ambas de Google Fonts:
  - **Red Hat Display Extrabold** (`display`): titulares, datos y palabras clave. Es la tipografía del logotipo.
  - **Red Hat Text Regular** (`text`): descripciones y textos extensos.
- Cárgalas con `https://fonts.googleapis.com/css2?family=Red+Hat+Display:wght@800&family=Red+Hat+Text:wght@400;500&display=swap`.
- Titulares con `display`, `h1`, `h2`, `h3`; cifras destacadas con `data`; texto corrido con `body`; notas con `body-sm`; metadatos y cajetines con `label`.
- No mezcles otras familias. No uses Display en párrafos largos ni Text en titulares.

## Espaciado, forma y composición

- Mucho aire: separa secciones con `space-6` y bloques con `space-5`; padding de tarjeta `space-4`.
- Aristas vivas por defecto (`radius-0`), como el isotipo. Redondeo mínimo (`radius-sm`, `radius-md`) solo en controles y tarjetas.
- Composiciones ortogonales y modulares, alineadas a retícula (como una planta de estructura). Sin degradados, sin sombras marcadas, sin ilustraciones decorativas.
- Separadores en `border`, de 1px.

## Logotipo

- Variantes en el grupo **Logos**: Horizontal, Vertical, Square (cuadrada) e Isologo (solo símbolo), cada una en Color, Color invertido (INV) y Blanco y negro (BW).
- Sobre fondo claro (`surface` blanco o `brand-pale`): versión **COLOR**.
- Sobre fondo oscuro (`brand-ink` o fotografía oscura): versión **COLOR-INV**.
- Una sola tinta (sellos, fax, grabados, documentos B/N): versión **BW**.
- Horizontal es la versión por defecto (cabeceras web, cajetines, firmas). Vertical y Square para redes y piezas cuadradas. Isologo para favicon, avatar y marcas de agua.
- Respeta un margen libre alrededor del logo de al menos la altura de la barra verde del isotipo. No lo deformes, no cambies sus colores, no le añadas sombras ni lo coloques sobre `brand-sage`.

## Iconografía

- El manual no define un set de iconos. Si se necesitan, usa iconos lineales de trazo fino y aristas rectas en `text` o `brand-ink`, nunca emoji.
