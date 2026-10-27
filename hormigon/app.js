// Interfaz de /hormigon/: inicio → (preguntas | datos a mano) → datos del hormigón → resultados.
// Cálculo en calculo.js; datos normativos en data/*.json.
import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";
import { dosificacion, recubrimiento, designacion } from "./calculo.js";
import { montarAsistente } from "./asistente.js";

iniciarPagina();
const [D, R, C, T] = await Promise.all(
  ["dosificacion", "recubrimientos", "clases", "tipificacion"].map((n) => cargarJSON(`data/${n}.json`)));
const $ = (s) => document.querySelector(s);
const f = $("#f");
let modo = "manual"; // "preguntas" | "manual"

// ---- Navegación entre pasos ----
function ir(id) {
  document.querySelectorAll(".paso").forEach((s) => (s.hidden = s.id !== id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---- Desplegables ----
const opciones = (sel, items, ninguna) => {
  sel.innerHTML = (ninguna ? `<option value="">${ninguna}</option>` : "") + items.map((i) => typeof i === "string"
    ? `<option value="${i}">${i} · ${C.clases[i]}</option>` : `<option value="${i.id}">${i.nombre}</option>`).join("");
};
opciones(f.corrosion, D.grupos.corrosion);
opciones(f.xf, D.grupos.XF, "Sin heladas");
opciones(f.xa, D.grupos.XA, "Sin ataque químico");
opciones(f.xm, D.grupos.XM, "Sin erosión");
opciones(f.consistencia, T.consistencias.lista);
opciones(f.margen, R.margen.lista);
f.margen.value = "otros";

function actualizarFormulario() {
  const tipo = f.tipo.value;
  // fck: «automática» = mínima por durabilidad (tabla 43.2.1.b) y art. 33.4; serie del art. 33.6
  const actual = f.fck.value;
  const serie = T.serie_R.valores.filter((v) => v >= T.fck_minimo[tipo]);
  f.fck.innerHTML = `<option value="">Automática (la mínima exigida)</option>` + serie.map((v) => `<option value="${v}">${v} N/mm²</option>`).join("");
  if (serie.includes(Number(actual))) f.fck.value = actual;
  // Cementos utilizables (tabla 28: en pretensado solo algunos)
  const lista = R.cementos.lista.filter((c) => tipo !== "pretensado" || c.pretensado);
  const cem = f.cemento.value;
  opciones(f.cemento, lista);
  if (lista.some((c) => c.id === cem)) f.cemento.value = cem;
  // En masa no hay armaduras: sin recubrimiento
  $("#check-rec").hidden = tipo === "masa";
  $("#bloque-rec").hidden = tipo === "masa" || !f.conRec.checked;
}
f.addEventListener("change", actualizarFormulario);
actualizarFormulario();

const clases = () => [f.corrosion.value, f.xf.value, f.xa.value, f.xm.value].filter(Boolean);

// ---- Camino A: preguntas ----
const asistente = montarAsistente($("#asistente"), C, {
  alVolver: () => ir("p-inicio"),
  alTerminar: (est) => {
    f.tipo.value = est.tipo || "armado";
    for (const k of ["xf", "xa", "xm"]) f[k].value = est[k] || "";
    f.corrosion.value = est.corrosion || "X0";
    actualizarFormulario();
    mostrarDatos("preguntas");
  },
});

function mostrarDatos(m) {
  modo = m;
  $("#bloque-clases").hidden = m === "preguntas";
  $("#bloque-resumen").hidden = m !== "preguntas";
  $("#resumen-clases").textContent = clases().join(" + ");
  ir("p-datos");
}

document.querySelectorAll("[data-ir]").forEach((b) => b.addEventListener("click", () => {
  if (b.dataset.ir === "preguntas") { asistente.reiniciar(); ir("p-preguntas"); }
  else mostrarDatos("manual");
}));
$("#datos-atras").addEventListener("click", () => ir(modo === "preguntas" ? "p-preguntas" : "p-inicio"));
$("#res-cambiar").addEventListener("click", () => ir("p-datos"));
$("#res-reiniciar").addEventListener("click", () => { f.reset(); f.margen.value = "otros"; actualizarFormulario(); ir("p-inicio"); });

// ---- Resultados ----
const fila = (titulo, valor, ref) =>
  `<div class="res"><span>${titulo}</span><span class="dato">${valor}</span><span class="ref">${ref}</span></div>`;
const nota = (n, alerta) => `<p class="nota${alerta ? " alerta" : ""}">${n.texto} <span class="ref">${n.ref}</span></p>`;

f.addEventListener("submit", (e) => {
  e.preventDefault();
  const tipo = f.tipo.value, cl = clases();
  const dos = dosificacion(D, cl, tipo);
  const tm = Math.max(1, Number(f.tm.value) || 20);
  const des = designacion(T, { tipo, clases: cl, fckDur: dos.fck, fckElegida: Number(f.fck.value) || 0, consistencia: f.consistencia.value, tm });
  const alertas = [], extra = [...dos.avisos];

  let h = `<p class="label">Designación del hormigón</p>
    <p class="designacion">${des.texto}</p>
    <p class="ref">Código Estructural, art. 33.6 (tipificación T-R/C/TM/A) · Clases: tabla 27.1.a</p>
    <div class="resultados">` +
    fila("Relación agua/cemento máxima", fmt(dos.ac, 2), "Código Estructural, tabla 43.2.1.a") +
    fila("Contenido mínimo de cemento", dos.cemento ? `${fmt(dos.cemento)} kg/m³` : "—", "Código Estructural, tabla 43.2.1.a") +
    fila("Resistencia fck", `${fmt(des.R)} N/mm²`, "Código Estructural, art. 33.4 y tabla 43.2.1.b");

  if (des.subida) alertas.push({ texto: `La resistencia elegida es menor que la mínima para estas clases; se toma ${des.R} N/mm².`, ref: "Art. 43.2.1" });
  const cons = T.consistencias.lista.find((c) => c.id === f.consistencia.value);
  if (cons.nota) alertas.push({ texto: cons.nota, ref: "Art. 33.5" });

  if (tipo !== "masa" && f.conRec.checked) {
    const r = recubrimiento(R, {
      corrosion: f.corrosion.value, xf: f.xf.value, xa: f.xa.value, xm: f.xm.value, tipo, cemento: f.cemento.value,
      fck: des.R, vida: Number(f.vida.value), margen: f.margen.value, diam: Number(f.diam.value) || 0, arido: tm,
      aridoDificil: f.aridoDificil.checked, terreno: f.terreno.checked,
    });
    if (r.bloqueo) alertas.push(r.bloqueo);
    else {
      h += fila("Recubrimiento mínimo c<sub>min</sub>", `${fmt(r.cmin)} mm`, `Gobierna: ${r.gobierna.texto} · Código Estructural, ${r.gobierna.ref}`);
      h += fila("Recubrimiento nominal c<sub>nom</sub>", `${fmt(r.cnom)} mm`, `c<sub>min</sub> + Δc<sub>dev</sub> (${fmt(r.dc)} mm) · Código Estructural, art. 43.4.1 y tabla 43.4.1`);
    }
    extra.push(...(r.notas || []));
    extra.push({ texto: "Criterios comprobados: " + r.partes.map((p) => `${p.texto} = ${fmt(p.valor, p.valor % 1 ? 1 : 0)} mm (${p.ref})`).join("; ") + ".", ref: "Art. 44" });
  }
  h += `</div>` + alertas.map((a) => nota(a, true)).join("");
  extra.unshift({ texto: "Con varias clases manda el criterio más exigente de cada parámetro.", ref: "Art. 43.2.1" });
  h += `<details class="detalles"><summary>Requisitos y comprobaciones (${extra.length})</summary>${extra.map((a) => nota(a)).join("")}</details>`;
  $("#res").innerHTML = h;
  ir("p-resultados");
});
