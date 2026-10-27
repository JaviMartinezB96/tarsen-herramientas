// Interfaz de /hormigon/. Cálculo en calculo.js; datos normativos en data/*.json.
import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";
import { dosificacion, recubrimiento } from "./calculo.js";

iniciarPagina();
const [D, R] = await Promise.all([cargarJSON("data/dosificacion.json"), cargarJSON("data/recubrimientos.json")]);
const $ = (s, r = document) => r.querySelector(s);
const fA = $("#f-amb"), fR = $("#f-rec");

// ---- Rellenar desplegables ----
const opciones = (sel, items, ninguna) => {
  sel.innerHTML = (ninguna ? `<option value="">${ninguna}</option>` : "") +
    items.map((i) => (typeof i === "string" ? `<option>${i}</option>` : `<option value="${i.id}">${i.nombre}</option>`)).join("");
};
for (const f of [fA, fR]) {
  opciones(f.corrosion, D.grupos.corrosion);
  opciones(f.xf, D.grupos.XF, "Sin heladas");
  opciones(f.xa, D.grupos.XA, "Sin ataque químico");
  opciones(f.xm, D.grupos.XM, "Sin erosión");
}
opciones(fR.cemento, R.cementos.lista);
opciones(fR.margen, R.margen.lista);
fR.margen.value = "otros";

const clasesDe = (f) => [f.corrosion.value, f.xf.value, f.xa.value, f.xm.value].filter(Boolean);
const fila = (titulo, valor, ref) =>
  `<div class="res"><span>${titulo}</span><span class="dato">${valor}</span><span class="ref">${ref}</span></div>`;
const nota = (n, alerta) => `<p class="nota${alerta ? " alerta" : ""}">${n.texto} <span class="ref">${n.ref}</span></p>`;

// ---- Pestaña Ambientes ----
function pintarAmbientes() {
  const tipo = fA.tipo.value, clases = clasesDe(fA);
  const r = dosificacion(D, clases, tipo);
  $("#r-amb").innerHTML =
    `<p class="label">Clases de exposición</p><p class="dato">${clases.join(" + ")}</p>` +
    fila("Relación agua/cemento máxima", fmt(r.ac, 2), "Código Estructural, tabla 43.2.1.a") +
    fila("Contenido mínimo de cemento", r.cemento ? `${fmt(r.cemento)} kg/m³` : "—", "Código Estructural, tabla 43.2.1.a") +
    fila("Resistencia mínima fck", r.fck ? `${fmt(r.fck)} N/mm²` : "—", "Código Estructural, tabla 43.2.1.b (cemento 32,5 R)") +
    fila("Designación del hormigón", "Pendiente", "PENDIENTE: formato de tipificación del Código Estructural") +
    `<p class="nota">Con varias clases manda el criterio más exigente de cada parámetro (art. 43.2.1).</p>` +
    (tipo === "masa" && /^X[CSD]/.test(fA.corrosion.value)
      ? nota({ texto: "En hormigón en masa la tabla no fija requisitos para las clases XC, XS y XD.", ref: "Tabla 43.2.1.a" }, true) : "") +
    r.avisos.map((a) => nota(a)).join("");
  $("#pasar").hidden = tipo === "masa";
}

// ---- Pestaña Recubrimientos ----
function pintarRecubrimientos() {
  const v = (n) => fR[n].value, num = (n) => Number(fR[n].value) || 0;
  const e = {
    corrosion: v("corrosion"), xf: v("xf"), xa: v("xa"), xm: v("xm"), tipo: v("tipo"), cemento: v("cemento"),
    fck: num("fck"), vida: num("vida"), margen: v("margen"), diam: num("diam"), arido: num("arido"),
    aridoDificil: fR.aridoDificil.checked, terreno: fR.terreno.checked,
  };
  const r = recubrimiento(R, e);
  const fckMin = dosificacion(D, clasesDe(fR), e.tipo).fck;
  let h = `<p class="label">Clases de exposición</p><p class="dato">${clasesDe(fR).join(" + ")}</p>`;
  if (r.bloqueo) h += nota(r.bloqueo, true);
  else {
    h += fila("Recubrimiento mínimo c<sub>min</sub>", `${fmt(r.cmin)} mm`, `Gobierna: ${r.gobierna.texto} · Código Estructural, ${r.gobierna.ref}`);
    h += fila("Margen Δc<sub>dev</sub>", `${fmt(r.dc)} mm`, "Código Estructural, tabla 43.4.1");
    h += fila("Recubrimiento nominal c<sub>nom</sub>", `${fmt(r.cnom)} mm`, "Código Estructural, art. 43.4.1: c<sub>nom</sub> = c<sub>min</sub> + Δc<sub>dev</sub>");
  }
  h += `<p class="nota">Criterios comprobados: ${r.partes.map((p) => `${p.texto} = ${fmt(p.valor, p.valor % 1 ? 1 : 0)} mm (${p.ref})`).join("; ") || "—"}.</p>`;
  if (fckMin && e.fck < fckMin)
    h += nota({ texto: `La resistencia indicada es menor que la mínima esperada para estas clases (${fmt(fckMin)} N/mm²); prevalece esta última.`, ref: "Art. 43.2.1 y tabla 43.2.1.b" }, true);
  h += (r.notas || []).map((n) => nota(n)).join("");
  h += `<p class="nota">Estos valores de durabilidad exigen cumplir a la vez la dosificación mínima de la pestaña Ambientes (art. 44.2.1.1).</p>`;
  $("#r-rec").innerHTML = h;
}

// ---- Pestañas (la pestaña activa se guarda en la dirección: #ambientes / #recubrimientos) ----
function mostrar(id) {
  for (const p of ["ambientes", "recubrimientos"]) {
    $("#" + p).hidden = p !== id;
    $("#tab-" + p).setAttribute("aria-selected", p === id);
  }
}
$(".pestanas").addEventListener("click", (e) => {
  const id = e.target.getAttribute("aria-controls");
  if (id) { mostrar(id); history.replaceState(null, "", "#" + id); }
});

$("#pasar").addEventListener("click", () => {
  for (const n of ["corrosion", "xf", "xa", "xm", "tipo"]) fR[n].value = fA[n].value;
  const fck = dosificacion(D, clasesDe(fA), fA.tipo.value).fck;
  if (fck && Number(fR.fck.value) < fck) fR.fck.value = fck;
  pintarRecubrimientos();
  mostrar("recubrimientos");
  history.replaceState(null, "", "#recubrimientos");
  window.scrollTo({ top: $(".pestanas").offsetTop, behavior: "smooth" });
});

fA.addEventListener("input", pintarAmbientes);
fR.addEventListener("input", pintarRecubrimientos);
pintarAmbientes();
pintarRecubrimientos();
mostrar(location.hash === "#recubrimientos" ? "recubrimientos" : "ambientes");
