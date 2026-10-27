// Interfaz de /escalera/: cuestionario → resultado + respuestas editables (recalcula al cambiar).
// Cálculo en calculo.js; datos normativos en data/escalera.json.
import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";
import { montarAsistente } from "../shared/asistente.js";
import { calcular, nBarras } from "./calculo.js";
import { croquis } from "./croquis.js";

iniciarPagina();
const N = await cargarJSON("data/escalera.json");
const $ = (s) => document.querySelector(s);

const INICIAL = { uso: "A1", L: 3.5, ancho: 1, contrahuella: 17.5, huella: 28, peldanos: "hormigon", solado: 1.5, fck: "25", acero: "B500S", rec: 30 };
let est = { ...INICIAL };

const conFyk = (e) => ({ ...e, fck: Number(e.fck), fyk: N.acero.tipos.find((a) => a.id === e.acero).fyk });
const incr = (u) => (N.sobrecargas.incremento_escaleras.categorias.includes(u.cat) ? N.sobrecargas.incremento_escaleras.valor : 0);

// Opciones de las preguntas (también para los desplegables del resultado)
const OPCIONES = {
  usos: () => N.sobrecargas.lista.map((u) => ({ valor: u.id, texto: u.texto,
    detalle: `Sobrecarga en la escalera: ${fmt(u.qk + incr(u))} kN/m²${incr(u) ? ` (${u.qk} + ${incr(u)})` : ""}.` })),
  peldanos: () => N.pesos.peldanos.map((p) => ({ valor: p.id, texto: p.texto, detalle: p.detalle,
    etiqueta: p.id === "hormigon" ? "Habitual" : "" })),
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
  pintarRespuestas();
  pintarResultado();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#reiniciar").addEventListener("click", () => {
  est = { ...INICIAL };
  asistente.reiniciar();
  $("#p-resultados").hidden = true;
  $("#p-preguntas").hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---- Respuestas editables ----
const pregunta = (id) => N.asistente.find((p) => p.id === id);
function pintarRespuestas() {
  $("#f").innerHTML = N.asistente.map((p) => {
    const titulo = p.tipo === "numero" ? p.unidad : p.pregunta.replace(/^¿|\?$/g, "");
    const control = p.tipo === "numero"
      ? `<input type="number" inputmode="decimal" name="${p.campo}" min="${p.min}" max="${p.max}" step="${p.paso}" value="${est[p.campo]}">`
      : `<select name="${p.campo}">${OPCIONES[p.dinamica]().map((o) => `<option value="${o.valor}">${o.texto}</option>`).join("")}</select>`;
    return `<label class="campo"><span>${titulo}</span>${control}</label>`;
  }).join("");
  for (const p of N.asistente) if (p.tipo !== "numero") $("#f")[p.campo].value = est[p.campo];
}

$("#f").addEventListener("input", (e) => {
  const t = e.target, p = N.asistente.find((q) => q.campo === t.name);
  if (p.tipo === "numero") {
    const v = Number(t.value);
    const ok = t.value !== "" && v >= p.min && v <= p.max;
    t.setAttribute("aria-invalid", !ok);
    if (!ok) return;
    est[t.name] = v;
  } else est[t.name] = t.value;
  pintarResultado();
});

// ---- Resultado ----
const fila = (titulo, valor, ref) =>
  `<div class="res"><span>${titulo}</span><span class="dato">${valor}</span><span class="ref">${ref}</span></div>`;
const nota = (texto, ref, alerta) => `<p class="nota${alerta ? " alerta" : ""}">${texto}${ref ? ` <span class="ref">${ref}</span>` : ""}</p>`;
const cm2 = (mm2) => `${fmt(mm2 / 100, 2)} cm²/m`;
const barra = (a, lMm, rec) => `${nBarras(lMm, a.s, rec)}Ø${a.diam} c/${fmt(a.s / 10)} cm`;
const chip = (ok, texto) => `<span class="chip ${ok ? "ok" : "no"}">${ok ? "Cumple" : "No cumple"} · ${texto}</span>`;

function pintarResultado() {
  const e = conFyk(est), r = calcular(N, e);
  if (r.pendiente) {
    $("#res").innerHTML = nota("Herramienta en revisión: faltan por verificar los coeficientes de seguridad de las acciones.", "CTE DB SE, tabla 4.1", true);
    return;
  }
  if (r.fallo) {
    $("#res").innerHTML = nota(`Con un canto de hasta ${N.canto.max / 10} cm no se cumplen las comprobaciones. La escalera necesita un cálculo específico (zanca, apoyo intermedio o mayor canto).`, "", true);
    return;
  }
  const c = r.c, b = e.ancho * 1000;
  let h = `<p class="label">Canto de la losa</p>
    <p class="designacion">h = ${fmt(r.h / 10)} cm</p>
    <p class="ref">Menor canto que cumple esbeltez y cortante sin cercos · Anejo 19 del Código Estructural, 7.4.2 y 6.2.2 · L/h = ${fmt(e.L * 1000 / r.h, 1)}</p>
    <div class="semaforo">${chip(r.ok.esbeltez, "esbeltez")}${chip(r.ok.cortante, "cortante")}${chip(r.ok.cuantia, "cuantía mínima")}</div>
    ${croquis(e, r)}
    <div class="resultados">` +
    fila("Inferior longitudinal (principal)", barra(r.arm, b, e.rec), `${cm2(r.arm.As)} ≥ ${cm2(r.Asnec)} · A19, 6.1 y 9.2.1.1 · separación 9.3.1.1(3)`) +
    fila("Inferior transversal (reparto)", barra(r.reparto, r.lInc, e.rec), `${cm2(r.reparto.As)} ≥ 20 % de la principal · A19, 9.3.1.1(2)`) +
    fila("Superior longitudinal", barra(r.superior, b, e.rec), `${cm2(r.superior.As)} en toda la losa: 15 % de M<sub>d</sub> y A<sub>s,min</sub> · A19, 9.3.1.2(2) y 9.2.1.1`) +
    fila("Superior transversal", barra(r.repartoSup, r.lInc, e.rec), `${cm2(r.repartoSup.As)} ≥ 20 % de la superior · criterio TARSEN`) +
    fila("Canto útil d", `${fmt(r.d / 10, 1)} cm`, `h − recubrimiento − Ø/2`) +
    fila("Carga de cálculo q<sub>d</sub>", `${fmt(r.qd, 2)} kN/m²`, `${fmt(r.gam.gammaG, 2)}·g + ${fmt(r.gam.gammaQ, 2)}·q en planta · CTE DB SE, tabla 4.1`) +
    fila("Momento de cálculo M<sub>d</sub>", `${fmt(r.Md, 1)} kN·m/m`, "q<sub>d</sub>·L²/8 · biapoyada") + `</div>`;

  const det = [
    [`Peso propio de la losa: ${fmt(c.gLosa, 2)} kN/m² (25 kN/m³ · h / cos α, α = ${fmt(Math.acos(c.cos) * 180 / Math.PI, 1)}°)`, N.pesos.losa.ref],
    [`Peso de los peldaños: ${fmt(c.gPeld, 2)} kN/m² (${c.peld.valor} kN/m³ · contrahuella / 2); no colaboran en la resistencia`, `CTE DB SE-AE, ${c.peld.ref}`],
    [`Solado y revestimiento: ${fmt(e.solado, 2)} kN/m². Total permanente g = ${fmt(c.g, 2)} kN/m²`, "Dato del usuario"],
    [`Sobrecarga de uso q = ${fmt(c.q, 1)} kN/m²${c.inc ? ` (${c.qk} + ${c.inc} por escalera)` : ""}`, "CTE DB SE-AE, tabla 3.1 y 3.1.1.3"],
    [`Flexión: μ = ${fmt(r.mu, 3)}; A<sub>s,req</sub> = ${cm2(r.Asreq)} con f<sub>cd</sub> = ${fmt(r.fcd, 2)} N/mm² y f<sub>yd</sub> = ${fmt(r.fyd, 1)} N/mm²`, "A19, (3.15), tabla A19.2.1 y bloque rectangular 3.1.7(3)"],
    [`Armadura mínima: A<sub>s,min</sub> = W/z · f<sub>ctm,fl</sub>/f<sub>yd</sub> = ${cm2(r.Asmin)} (f<sub>ctm</sub> = ${fmt(r.fctm, 2)}, f<sub>ctm,fl</sub> = ${fmt(r.fctmfl, 2)} N/mm², z = 0,8h)`, "A19, (9.1), (3.23) y tabla A19.3.1"],
    [`Esbeltez: l/d = ${fmt(r.ld, 1)} ≤ ${fmt(r.ldLim, 1)} con la luz inclinada ${fmt(r.lInc / 1000, 2)} m, ρ = ${fmt(r.rho * 100, 3)} %, ρ₀ = ${fmt(r.rho0 * 100, 3)} %, K = 1,0`, "A19, (7.16), (7.17) y tabla A19.7.4"],
    [`Cortante: V<sub>d</sub> = ${fmt(r.Vd, 1)} kN/m ≤ V<sub>Rd,c</sub> = ${fmt(r.VRdc, 1)} kN/m (k = ${fmt(r.k, 2)}, ρ<sub>l</sub> = ${fmt(r.rhoL * 100, 3)} % con la mitad de la armadura en el apoyo) y ≤ ${fmt(r.Vmax, 0)} kN/m`, "A19, (6.2.a), (6.2.b), (6.3), (6.5) y 9.3.1.2(1)"],
    [`Nº de barras para un ancho de ${fmt(e.ancho, 2)} m y una longitud inclinada de ${fmt(r.lInc / 1000, 2)} m: (longitud − 2 · recubrimiento) / s, redondeado hacia arriba, más una.`, "Criterio TARSEN"],
    ["Prolonga hasta los apoyos al menos la mitad de la armadura inferior y ánclala; ancla también la superior en los dos apoyos.", "A19, 9.3.1.2"],
    ["Criterios TARSEN: luz inclinada para la esbeltez, cortante sin reducir por cos α, parrilla superior en toda la losa con A<sub>s,min</sub>, canto mínimo 15 cm, separaciones múltiplo de 5 cm y no menores de 10 cm.", ""],
  ];
  h += nota("Predimensionado de un tramo recto biapoyado sin mesetas. No comprueba fisuración, vibraciones, fuego ni el apoyo en los forjados.", "", false) +
    `<details class="detalles"><summary>Cargas y comprobaciones (${det.length})</summary>${det.map(([t, ref]) => nota(t, ref)).join("")}</details>`;
  $("#res").innerHTML = h;
}
