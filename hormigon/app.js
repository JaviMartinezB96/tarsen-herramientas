// Interfaz de /hormigon/: cuestionario → resultado con las respuestas editables (recalcula al cambiar).
// Cálculo en calculo.js; datos normativos en data/*.json.
import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";
import { dosificacion, recubrimiento, designacion } from "./calculo.js";
import { montarAsistente } from "./asistente.js";

iniciarPagina();
const [D, R, C, T] = await Promise.all(
  ["dosificacion", "recubrimientos", "clases", "tipificacion"].map((n) => cargarJSON(`data/${n}.json`)));
const $ = (s) => document.querySelector(s);

// Valores por defecto (se cambian con las respuestas o en el resultado)
const INICIAL = { tipo: "armado", corrosion: "X0", xf: "", xa: "", xm: "", cemento: "OTROS", vida: "50", margen: "otros",
  diam: "12", tm: "20", terreno: "no", aridoDificil: "no", fck: "", consistencia: "F" };
let est = { ...INICIAL };

const clases = (e) => [e.corrosion, e.xf, e.xa, e.xm].filter(Boolean);
const conArmadura = (e) => e.tipo !== "masa";

/** Cálculo completo para un estado. Arts. 33, 43 y 44 del Código Estructural. */
function calcular(e) {
  const cl = clases(e), dos = dosificacion(D, cl, e.tipo);
  const des = designacion(T, { tipo: e.tipo, clases: cl, fckDur: dos.fck, fckElegida: Number(e.fck) || 0,
    consistencia: e.consistencia, tm: Number(e.tm) });
  const rec = conArmadura(e) ? recubrimiento(R, { ...e, fck: des.R, vida: Number(e.vida), diam: Number(e.diam),
    arido: Number(e.tm), aridoDificil: e.aridoDificil === "si", terreno: e.terreno === "si" }) : null;
  return { cl, dos, des, rec };
}

// Cementos ordenados por recubrimiento mínimo por durabilidad (tablas 44.2.1.1.a/b, 44.3 y 44.4).
// Tabla 28: en pretensado solo los cementos permitidos.
function cementos(e) {
  const lista = R.cementos.lista.filter((c) => e.tipo !== "pretensado" || c.pretensado).map((c) => {
    const { rec } = calcular({ ...e, cemento: c.id });
    const dur = rec.partes.filter((p) => p.ref.startsWith("Tabla"));
    const v = rec.bloqueo ? Infinity : Math.max(0, ...dur.map((p) => p.valor));
    const sinValor = rec.bloqueo && (/proyecto/.test(rec.bloqueo.texto) ? "a fijar por el proyectista" : "excesivo");
    return { c, v, sinValor };
  }).sort((a, b) => a.v - b.v);
  const min = lista[0].v;
  return lista.map(({ c, v, sinValor }) => ({
    valor: c.id, texto: c.nombre, cdur: v, sinValor,
    etiqueta: [v === min && v !== Infinity ? "Menor recubrimiento" : "", c.habitual ? "Habitual" : ""].filter(Boolean).join(" · "),
    detalle: `${c.desc} ${sinValor ? `Recubrimiento ${sinValor} (sin valor en las tablas).` : `Recubrimiento mínimo por durabilidad: ${v} mm.`}`,
  }));
}

// ---- Cuestionario ----
const asistente = montarAsistente($("#asistente"), C, {
  inicial: INICIAL,
  opcionesDe: (nombre, e) => (nombre === "cementos" ? cementos(e) : []),
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
const op = (v, t) => `<option value="${v}">${t}</option>`;
const conClase = (lista, ninguna) => (ninguna ? op("", ninguna) : "") + lista.map((c) => op(c, `${c} · ${C.clases[c]}`)).join("");
const de = (id) => C.asistente.find((p) => p.id === id).opciones;

function campos(e) {
  const rec = conArmadura(e);
  return [
    ["tipo", "Tipo de hormigón", op("armado", "Armado") + op("pretensado", "Pretensado") + op("masa", "En masa")],
    rec && ["corrosion", "Corrosión de armaduras", conClase(D.grupos.corrosion)],
    ["xf", "Heladas", conClase(D.grupos.XF, "Sin heladas")],
    ["xa", "Ataque químico", conClase(D.grupos.XA, "Sin ataque químico")],
    ["xm", "Erosión", conClase(D.grupos.XM, "Sin erosión")],
    rec && ["cemento", "Tipo de cemento", cementos(e).map((c) =>
      op(c.valor, `${c.texto} · ${c.sinValor || `${c.cdur} mm`}${c.etiqueta ? ` (${c.etiqueta.toLowerCase()})` : ""}`)).join("")],
    rec && ["vida", "Vida útil", de("vida").map((o) => op(o.valor, o.texto)).join("")],
    rec && ["margen", "Control de ejecución", R.margen.lista.map((m) => op(m.id, `${m.nombre} · Δc ${m.valor} mm`)).join("")],
    rec && ["diam", "Diámetro de la barra principal", de("diam").map((o) => op(o.valor, o.texto)).join("")],
    ["tm", "Tamaño máximo del árido", de("tm").map((o) => op(o.valor, o.texto)).join("")],
    rec && ["terreno", "Hormigonado contra el terreno", op("no", "No (encofrado u hormigón de limpieza)") + op("si", "Sí, sin hormigón de limpieza")],
    rec && ["aridoDificil", "Paso del hormigón entre armaduras",
      op("no", "Normal: recubrimiento ≥ 0,8 × árido") + op("si", "Difícil: armaduras muy juntas o pegadas al encofrado (≥ 1,25 × árido)")],
    ["fck", "Resistencia fck", op("", "Automática (la mínima exigida)") +
      T.serie_R.valores.filter((v) => v >= T.fck_minimo[e.tipo]).map((v) => op(v, `${v} N/mm²`)).join("")],
    ["consistencia", "Consistencia", T.consistencias.lista.map((c) => op(c.id, c.nombre)).join("")],
  ].filter(Boolean);
}

function pintarRespuestas() {
  if (est.tipo === "masa") est.corrosion = "X0";                                   // Tabla 27.1.a: en masa, X0
  if (est.tipo === "pretensado" && !R.cementos.lista.find((c) => c.id === est.cemento)?.pretensado) est.cemento = "CEMI"; // Tabla 28
  if (Number(est.fck) && Number(est.fck) < T.fck_minimo[est.tipo]) est.fck = "";   // Art. 33.4
  $("#f").innerHTML = campos(est).map(([k, t, html]) =>
    `<label class="campo"><span>${t}</span><select name="${k}">${html}</select></label>`).join("");
  for (const [k] of campos(est)) $("#f")[k].value = est[k];
}

$("#f").addEventListener("change", (e) => {
  est[e.target.name] = e.target.value;
  pintarRespuestas();          // las opciones de cemento y fck dependen del resto
  pintarResultado();
});

// ---- Resultado ----
const fila = (titulo, valor, ref) =>
  `<div class="res"><span>${titulo}</span><span class="dato">${valor}</span><span class="ref">${ref}</span></div>`;
const nota = (n, alerta) => `<p class="nota${alerta ? " alerta" : ""}">${n.texto} <span class="ref">${n.ref}</span></p>`;

function pintarResultado() {
  const { dos, des, rec } = calcular(est);
  const alertas = [], extra = [{ texto: "Con varias clases manda el criterio más exigente de cada parámetro.", ref: "Art. 43.2.1" }, ...dos.avisos];

  let h = `<p class="label">Designación del hormigón</p>
    <p class="designacion">${des.texto}</p>
    <p class="ref">Código Estructural, art. 33.6 (tipificación T-R/C/TM/A) · Clases: tabla 27.1.a</p>
    <div class="resultados">`;
  if (rec && !rec.bloqueo) {
    h += fila("Recubrimiento nominal c<sub>nom</sub>", `${fmt(rec.cnom)} mm`, `c<sub>min</sub> + Δc<sub>dev</sub> · Código Estructural, art. 43.4.1`);
    h += fila("Recubrimiento mínimo c<sub>min</sub>", `${fmt(rec.cmin)} mm`, `Gobierna: ${rec.gobierna.texto} · Código Estructural, ${rec.gobierna.ref}`);
    h += fila("Margen Δc<sub>dev</sub>", `${fmt(rec.dc)} mm`, "Código Estructural, tabla 43.4.1");
  }
  h += fila("Relación agua/cemento máxima", fmt(dos.ac, 2), "Código Estructural, tabla 43.2.1.a") +
    fila("Contenido mínimo de cemento", dos.cemento ? `${fmt(dos.cemento)} kg/m³` : "—", "Código Estructural, tabla 43.2.1.a") +
    fila("Resistencia fck", `${fmt(des.R)} N/mm²`, "Código Estructural, art. 33.4 y tabla 43.2.1.b") + `</div>`;

  if (rec?.bloqueo) alertas.push(rec.bloqueo);
  if (des.subida) alertas.push({ texto: `La resistencia elegida es menor que la mínima para estas clases; se toma ${des.R} N/mm².`, ref: "Art. 43.2.1" });
  const cons = T.consistencias.lista.find((c) => c.id === est.consistencia);
  if (cons.nota) alertas.push({ texto: cons.nota, ref: "Art. 33.5" });
  if (rec) {
    extra.push(...(rec.notas || []));
    extra.push({ texto: "Criterios comprobados: " + rec.partes.map((p) => `${p.texto} = ${fmt(p.valor, p.valor % 1 ? 1 : 0)} mm (${p.ref})`).join("; ") + ".", ref: "Art. 44" });
  }
  h += alertas.map((a) => nota(a, true)).join("") +
    `<details class="detalles"><summary>Requisitos y comprobaciones (${extra.length})</summary>${extra.map((a) => nota(a)).join("")}</details>`;
  $("#res").innerHTML = h;
}
