// Interfaz de /cuantias/: cuestionario → resultado + respuestas editables (recalcula al cambiar).
// Cálculo en calculo.js; datos normativos en data/cuantias.json y shared/data/hormigon.json.
import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";
import { montarAsistente } from "../shared/asistente.js";
import { calcular, proponer } from "./calculo.js";

iniciarPagina();
const [N0, MAT] = await Promise.all([cargarJSON("data/cuantias.json"), cargarJSON("../shared/data/hormigon.json")]);
const N = { ...N0, hormigon: MAT.hormigon, acero: MAT.acero };
const $ = (s) => document.querySelector(s);

const INICIAL = { elemento: "viga", conFck: "si", b: 30, h: 50, NEd: 1000, solicitacion: "compuesta", e: 30,
  trabajo: "compresion", reduccion: "no", fck: "25", acero: "B500S" };
let est = { ...INICIAL };

const OPCIONES = {
  elementos: () => [
    { valor: "viga", texto: "Viga", detalle: "Sección rectangular a flexión.", fija: { conFck: "si" } },
    { valor: "losa", texto: "Losa", detalle: "Por metro de ancho, en la dirección principal.", fija: { conFck: "si" } },
    { valor: "pilar", texto: "Pilar", detalle: "Sección rectangular con el lado mayor no superior a 4 veces el menor.", fija: { conFck: "no" } },
    { valor: "muro", texto: "Muro", detalle: "Por metro de muro. Incluye muros de sótano y de contención.", fija: { conFck: "no" } },
  ],
  solicitaciones: () => [
    { valor: "compuesta", texto: "Compresión compuesta (con flexión)", detalle: "El caso general: pilares con momentos. Mínimo en cada una de las dos caras principales.", etiqueta: "Habitual" },
    { valor: "simple", texto: "Compresión simple, armado simétrico", detalle: "Axil centrado sin momentos apreciables. Mínimo total de la sección." },
  ],
  trabajos: () => [
    { valor: "compresion", texto: "Muro de carga (principalmente compresión)", detalle: "Recibe forjados o cargas verticales sin empuje lateral importante.", fija: { conFck: "no" } },
    { valor: "flexocompresion", texto: "Compresión con flexión", detalle: "Muro de carga con momentos: una cara queda traccionada.", fija: { conFck: "no" } },
    { valor: "flexion", texto: "Principalmente flexión (empuje de tierras o agua)", detalle: "Muros de contención y de sótano: se aplican las reglas de las losas.", fija: { conFck: "si" } },
  ],
  reducciones: () => [
    { valor: "no", texto: "No", detalle: "Se usa la cuantía horizontal completa.", etiqueta: "Del lado de la seguridad" },
    { valor: "si", texto: "Sí", detalle: "Si el fuste mide más de 2,5 m y al menos la mitad de la altura del muro, o si hay juntas verticales de contracción a menos de 7,5 m." },
  ],
  fck: () => N.hormigon.fck.map((f) => ({ valor: String(f), texto: `HA-${f} · fck ${f} N/mm²`, etiqueta: f === 25 ? "Habitual" : "" })),
  aceros: () => N.acero.tipos.map((a) => ({ valor: a.id, texto: `${a.texto} · fyk ${a.fyk} N/mm²`,
    detalle: a.id.endsWith("SD") ? "Ductilidad especial (obligatorio con acción sísmica)." : "", etiqueta: a.id === "B500S" ? "Habitual" : "" })),
};

const asistente = montarAsistente($("#asistente"), N, {
  inicial: INICIAL, prefijoRef: "",
  opcionesDe: (nombre) => OPCIONES[nombre](),
  alTerminar: (e) => { est = { ...INICIAL, ...e }; mostrarResultado(); },
});
asistente.reiniciar();

function mostrarResultado() {
  $("#p-preguntas").hidden = true;
  $("#p-resultados").hidden = false;
  $(".entradilla").hidden = true;
  pintarRespuestas();
  pintarResultado();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#reiniciar").addEventListener("click", () => {
  est = { ...INICIAL };
  asistente.reiniciar();
  $("#p-resultados").hidden = true;
  $("#p-preguntas").hidden = false;
  $(".entradilla").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---- Respuestas editables: solo las preguntas que proceden para el elemento elegido ----
const cumple = (cond, e) => !cond || Object.entries(cond).every(([k, v]) => v.includes(e[k]));
function aplicarFija() {
  for (const p of N.asistente) {
    if (p.tipo === "numero" || !cumple(p.solo_si, est)) continue;
    const op = OPCIONES[p.dinamica]().find((o) => o.valor === est[p.campo]);
    Object.assign(est, op?.fija || {});
  }
}
function pintarRespuestas() {
  aplicarFija();
  $("#f").innerHTML = N.asistente.filter((p) => cumple(p.solo_si, est)).map((p) => {
    const titulo = p.tipo === "numero" ? p.unidad : p.pregunta.replace(/^¿|\?$/g, "");
    const control = p.tipo === "numero"
      ? `<input type="number" inputmode="decimal" name="${p.campo}" min="${p.min}" max="${p.max}" step="${p.paso}" value="${est[p.campo]}" data-id="${p.id}">`
      : `<select name="${p.campo}" data-id="${p.id}">${OPCIONES[p.dinamica]().map((o) => `<option value="${o.valor}"${o.valor === est[p.campo] ? " selected" : ""}>${o.texto}</option>`).join("")}</select>`;
    return `<label class="campo"><span>${titulo}</span>${control}</label>`;
  }).join("");
}

$("#f").addEventListener("input", (e) => {
  const t = e.target, p = N.asistente.find((q) => q.id === t.dataset.id);
  if (p.tipo === "numero") {
    const v = Number(t.value);
    const ok = t.value !== "" && v >= p.min && v <= p.max;
    t.setAttribute("aria-invalid", !ok);
    if (!ok) return;
    est[p.campo] = v;
  } else {
    est[p.campo] = t.value;
    pintarRespuestas();                    // cambiar elemento o trabajo cambia las preguntas visibles
  }
  pintarResultado();
});

// ---- Resultado ----
const fila = (titulo, valor, ref) =>
  `<div class="res"><span>${titulo}</span><span class="dato">${valor}</span><span class="ref">${ref}</span></div>`;
const nota = (texto, ref, alerta) => `<p class="nota${alerta ? " alerta" : ""}">${texto}${ref ? ` <span class="ref">${ref}</span>` : ""}</p>`;
const cm2 = (mm2, m) => `${fmt(mm2 / 100, 2)} cm²${m ? "/m" : ""}`;
const pct = (As, Ac) => `${fmt((As / Ac) * 100, 3)} %`;
// Nivel 1: cifras grandes con su referencia corta debajo (como en /hormigon/)
const cifras = (lista) => lista.map(([l, v, ref], i) =>
  `<p class="label"${i ? ' style="margin-top:28px"' : ""}>${l}</p><p class="designacion">${v}</p><p class="ref">${ref}</p>`).join("");
const detalle = (det) => `<details class="detalles"><summary>Cálculo y criterios (${det.length})</summary>${det.map(([t, ref]) => nota(t, ref)).join("")}</details>`;
const lineaFlexion = (m) => [`A<sub>s,min</sub> = W/z · f<sub>ctm,fl</sub>/f<sub>yd</sub> con W = b·h²/6 = ${fmt(m.W / 1e6, 2)}·10⁶ mm³, z = 0,8h = ${fmt(m.z)} mm, f<sub>ctm</sub> = ${fmt(m.fctm, 2)} N/mm² y f<sub>ctm,fl</sub> = max[(1,6 − h/1000)·f<sub>ctm</sub>; f<sub>ctm</sub>] = ${fmt(m.fctmfl, 2)} N/mm²`, "A19, (9.1), (3.23) y tabla A19.3.1"];

// Propuesta de armado (criterio TARSEN): textos
const tMalla = (o) => (o ? `Ø${o.diam} c/${fmt(o.s / 10)} cm` : "—");
const tBarras = (o) => `${o.n}Ø${o.diam}`;
const otras = (ops, prop, t, m) => ops.filter((o) => o !== prop).map((o) => `${t(o)} (${cm2(o.As, m)})`).join(" · ");
const CRITERIO = ["Propuesta de armado (criterio TARSEN, no normativo): en mallas, el menor Ø que permite separar al menos 15 cm, con separaciones múltiplo de 5 cm y dentro del límite de la norma; en barras sueltas, el menor número de barras y, con el mismo número, el menor Ø. Comprueba que caben con el recubrimiento y la separación libre entre barras.", "Criterio TARSEN"];

const PINTAR = {
  viga: (r, p) => {
    const t = p.traccion;
    return cifras([["Armado mínimo propuesto (cara traccionada)", tBarras(t.prop), `${cm2(t.prop.As)} ≥ ${cm2(r.min.As)} · A19, 9.2.1.1(1)`]]) +
    `<div class="resultados">` +
    fila("Armadura mínima de tracción", cm2(r.min.As), `ρ = ${pct(r.min.As, r.Ac)} · A19, 9.2.1.1(1)`) +
    fila("Armadura máxima (tracción o compresión)", cm2(r.asMax), "0,04·A<sub>c</sub> · A19, 9.2.1.1(3)") + `</div>` +
    detalle([
      lineaFlexion(r.min), [`f<sub>yd</sub> = f<sub>yk</sub>/1,15 = ${fmt(r.fyd, 1)} N/mm²`, "A19, tabla A19.2.1"],
      [`Otras opciones: ${otras(t.ops, t.prop, tBarras)}`, "Criterio TARSEN"], CRITERIO,
      ["La máxima se aplica fuera de las zonas de solape, por separado a la armadura de tracción y a la de compresión.", "A19, 9.2.1.1(3)"],
      ["Una sección con menos armadura que la mínima se considera sin armar.", "A19, 9.2.1.1(2)"],
      ["Sección rectangular. No incluye la alternativa de 1,2 veces la armadura de cálculo para elementos secundarios.", "A19, 9.2.1.1(1)"],
    ]);
  },
  losa: (r, p) => cifras([
      ["Armado principal mínimo propuesto", tMalla(p.principal.prop), `${cm2(p.principal.prop?.As ?? NaN, 1)} ≥ ${cm2(r.min.As, 1)} · A19, 9.3.1.1(1)`],
      ["Armado de reparto propuesto", tMalla(p.reparto.prop), `Perpendicular a la principal · ≥ 20 % · A19, 9.3.1.1(2)`]]) +
    `<div class="resultados">` +
    fila("Armadura mínima principal", cm2(r.min.As, 1), `ρ = ${pct(r.min.As, r.Ac)} · A19, 9.3.1.1(1)`) +
    fila("Reparto mínimo (20 % de la principal)", cm2(p.repNec, 1), "A19, 9.3.1.1(2)") +
    fila("Máxima", cm2(r.asMax, 1), "0,04·A<sub>c</sub> · A19, 9.2.1.1(3)") +
    fila("Separación entre barras", `< ${fmt(r.sMax / 10)} cm`, "300 mm y 3h · A19, 9.3.1.1(3)") + `</div>` +
    detalle([
      lineaFlexion(r.min), [`f<sub>yd</sub> = f<sub>yk</sub>/1,15 = ${fmt(r.fyd, 1)} N/mm²; por metro de ancho (b = 1.000 mm)`, "A19, tabla A19.2.1"],
      ["Armadura de reparto: en las losas que trabajan en una sola dirección (unidireccionales, apoyadas en dos bordes opuestos) se coloca perpendicular a la principal, con al menos el 20 % de la principal que dispongas. Reparte las cargas y controla la retracción. En losas que trabajan en dos direcciones, cada dirección se arma con su cálculo y su mínima.", "A19, 9.3.1.1(2)"],
      [`Otras opciones principales: ${otras(p.principal.ops, p.principal.prop, tMalla, 1)}`, "Criterio TARSEN"],
      [`Otras opciones de reparto: ${otras(p.reparto.ops, p.reparto.prop, tMalla, 1)}`, "Criterio TARSEN"], CRITERIO,
      ["Cerca de los apoyos no hace falta reparto bajo las barras superiores si no hay flexión transversal.", "A19, 9.3.1.1(2)"],
      ["No incluye la alternativa de 1,2 veces la armadura de cálculo para losas con riesgo de rotura frágil pequeño.", "A19, nota de 9.3.1.1(1)"],
    ]),
  pilar: (r, p) => {
    const simple = est.solicitacion === "simple";
    const o = simple ? p.total : p.cara;
    const prop = simple ? `${tBarras(o.prop)}` : `${2 * o.prop.n}Ø${o.prop.diam}`;
    const refProp = simple ? `${cm2(o.prop.As)} ≥ ${cm2(r.simple)} · A19, (9.12)`
                           : `${tBarras(o.prop)} en cada cara: ${cm2(o.prop.As)} ≥ ${cm2(r.porCara)} · A19, fig. A19.9.11`;
    return (r.esMuro ? nota(`El lado mayor supera 4 veces el menor: según la norma se trata como muro, no como pilar.`, "A19, 9.5.1(1)", true) : "") +
    cifras([["Armado mínimo propuesto", prop, refProp]]) +
    `<div class="resultados">` +
    (simple ? fila("Mínima total (compresión simple)", cm2(r.simple), "0,10·N<sub>Ed</sub>/f<sub>yd</sub> · A19, (9.12)")
            : fila("Mínima en cada cara", cm2(r.porCara), "0,05·N<sub>Ed</sub>/f<sub>yc,d</sub> · A19, fig. A19.9.11")) +
    fila("Mínimo de barras", `4Ø12 · ${cm2(r.barras)}`, "Una por esquina, Ø ≥ 12 · A19, 9.5.2(1) y (4)") +
    fila("Máxima fuera de solapes", cm2(r.asMax), `0,04·A<sub>c</sub> · A19, 9.5.2(3)`) +
    fila("Máxima en solapes", cm2(r.asMaxSolape), `0,08·A<sub>c</sub> · A19, 9.5.2(3)`) + `</div>` +
    detalle([
      [`Sección ${fmt(r.b / 10)} × ${fmt(r.h / 10)} cm, A<sub>c</sub> = ${fmt(r.Ac / 100)} cm², N<sub>Ed</sub> = ${fmt(r.NEd / 1000)} kN`, ""],
      simple ? [`A<sub>s,min</sub> = 0,10·N<sub>Ed</sub>/f<sub>yd</sub> con f<sub>yd</sub> = ${fmt(r.fyd, 1)} N/mm²`, "A19, (9.12)"]
             : [`A'<sub>s1,min</sub> = A'<sub>s2,min</sub> = 0,05·N<sub>Ed</sub>/f<sub>yc,d</sub> con f<sub>yc,d</sub> = f<sub>yd</sub> ≯ 400 N/mm² → ${fmt(r.fycd, 1)} N/mm². Total en las dos caras: ${cm2(2 * r.porCara)}`, "A19, 9.5.2(2) y figura A19.9.11"],
      [`Otras opciones${simple ? "" : " (por cara)"}: ${otras(o.ops, o.prop, tBarras)}`, "Criterio TARSEN"], CRITERIO,
      [`Para comparar: el otro caso daría ${simple ? `${cm2(r.porCara)} por cara` : `${cm2(r.simple)} en total (compresión simple simétrica)`}.`, "A19, 9.5.2(2)"],
      ["Diámetro mínimo de las barras longitudinales: 12 mm. El texto dice «superior a 12 mm»; se admite Ø12, como en la versión original del Eurocódigo 2 [Inferencia].", "A19, 9.5.2(1)"],
      ["Barras a menos de 150 mm de otra sujeta por cercos; cercos de Ø ≥ 6 mm y ≥ Ø máx./4.", "A19, 9.5.3(1) y (6)"],
    ]);
  },
  muro: (r, p) => {
    const flex = est.trabajo === "flexion";
    const fV = flex ? r.flexion.As : r.vert;
    const vertProp = flex ? `${tMalla(p.traccionada.prop)} en la cara traccionada`
      : p.traccionada.prop?.diam === p.otra.prop?.diam && p.traccionada.prop?.s === p.otra.prop?.s
        ? `${tMalla(p.traccionada.prop)} en cada cara`
        : `${tMalla(p.traccionada.prop)} (traccionada) · ${tMalla(p.otra.prop)} (otra)`;
    const res = cifras([
        ["Vertical mínima propuesta", vertProp, flex ? `≥ ${cm2(fV, 1)} · reglas de losa · A19, 9.6.1` : `Total ≥ ${cm2(fV, 1)} · A19, 9.6.2`],
        ["Horizontal mínima propuesta", `${tMalla(p.hor.prop)} en cada cara`, `${cm2(2 * (p.hor.prop?.As ?? NaN), 1)} ≥ ${cm2(r.horiz, 1)} · A19, 9.6.3(1)`]]) +
      `<div class="resultados">` +
      (flex ? fila("Vertical mínima (cara traccionada)", cm2(fV, 1), "Reglas de losa · A19, 9.6.1 y 9.2.1.1")
            : fila("Vertical mínima: traccionada / otra", `${cm2(r.traccionada, 1)} / ${cm2(r.otra, 1)}`,
                est.trabajo === "flexocompresion" ? "60 % en la traccionada · A19, 9.6.2(1)" : "Mitad en cada cara · A19, 9.6.2(2)")) +
      fila("Horizontal mínima en cada cara", cm2(r.horiz / 2, 1), `${fmt(r.kH * 100, 2)} %·A<sub>c</sub> en dos caras · A19, 9.6.3(1)`) +
      fila("Vertical máxima", cm2(r.vMax, 1), "0,04·A<sub>c</sub> · A19, 9.6.2(1)") +
      fila("Separación máxima vertical", `${fmt(r.sMaxV / 10)} cm`, "400 mm y 3·espesor · A19, 9.6.2(3)") +
      fila("Separación máxima horizontal", `${fmt(r.sMaxH / 10)} cm`, "A19, 9.6.3(2)") + `</div>`;
    return res + detalle([
      [`Espesor ${fmt(r.t / 10)} cm, A<sub>c</sub> = ${fmt(r.Ac / 100)} cm²/m${r.t > 500 ? `; para la horizontal se cuenta un espesor eficaz de 50 cm (dos franjas de 25 cm, una por cara)` : ""}`, "A19, 9.6.3(1)"],
      flex ? lineaFlexion(r.flexion) : [`Vertical: 0,002·A<sub>c</sub>${est.trabajo === "flexocompresion" ? ", con el 60 % en la cara traccionada" : ", con la mitad en cada cara"}`, "A19, 9.6.2(1) y (2)"],
      flex ? ["Muro con flexión fuera de su plano: la vertical sigue las reglas de losa (en la otra cara, la que pida el cálculo). La horizontal se mantiene según 9.6.3, más exigente que el reparto del 20 % de las losas [Inferencia, criterio TARSEN].", "A19, 9.6.1(1), 9.3.1.1 y 9.6.3"] : null,
      [`Horizontal: ${r.kH === 0.002 ? "0,002·A<sub>c</sub> (reducida)" : `${fmt(r.kH, 4)}·A<sub>c</sub> para f<sub>yk</sub> = ${r.fyk} N/mm²`}, repartida en las dos caras; la mitad en cada cara si el muro queda visto por ambas.`, "A19, 9.6.3(1)"],
      [`Otras opciones verticales${flex ? "" : " (cara traccionada)"}: ${otras(p.traccionada.ops, p.traccionada.prop, tMalla, 1)}`, "Criterio TARSEN"],
      [`Otras opciones horizontales (por cara): ${otras(p.hor.ops, p.hor.prop, tMalla, 1)}`, "Criterio TARSEN"], CRITERIO,
      [`Si la vertical de las dos caras supera ${cm2(r.cercos, 1)} (0,02·A<sub>c</sub>), hay que disponer cercos como en pilares.`, "A19, 9.6.4(1)"],
      ["Muro con longitud de al menos 4 veces el espesor.", "A19, 9.6.1(1)"],
    ].filter(Boolean));
  },
};

function pintarResultado() {
  const r = calcular(N, est);
  $("#res").innerHTML = PINTAR[r.elemento](r, proponer(N, est, r));
}
