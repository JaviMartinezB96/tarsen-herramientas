// Visor IFC TARSEN — interfaz: abrir archivos, lista de modelos, barra de herramientas, cortes y propiedades.
import { iniciarPagina, fmt } from "../shared/ui.js";
import { Escena, PALETA } from "./escena.js";
import { Secciones } from "./secciones.js";

iniciarPagina();
const $ = (s) => document.querySelector(s);
const visor = $("#visor"), lienzo = $("#lienzo"), entrada = $("#archivo");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const escena = new Escena(lienzo);
const secc = new Secciones(escena, pintarSecciones);
let motor = null; // el lector (web-ifc, ~7 MB) solo se descarga al abrir el primer archivo
function lector() {
  if (!motor) { motor = new Worker(new URL("./motor.worker.js", import.meta.url), { type: "module" }); motor.onmessage = alMensaje; motor.onerror = alError; }
  return motor;
}
const modelos = new Map(); // id -> { nombre, color, visible, transparente, estado, error }
let n = 0, porModelo = false, colorElegido = false, modoCara = false;

// ---------- Abrir archivos ----------

$("#visor").addEventListener("click", (e) => { if (e.target.closest('[data-accion="abrir"]')) entrada.click(); });
entrada.addEventListener("change", () => { abrir([...entrada.files]); entrada.value = ""; });
visor.addEventListener("dragover", (e) => { e.preventDefault(); visor.classList.add("soltar"); });
visor.addEventListener("dragleave", (e) => { if (!visor.contains(e.relatedTarget)) visor.classList.remove("soltar"); });
visor.addEventListener("drop", (e) => { e.preventDefault(); visor.classList.remove("soltar"); abrir([...e.dataTransfer.files]); });

async function abrir(archivos) {
  for (const f of archivos.filter((f) => /\.ifc$/i.test(f.name))) {
    const id = ++n;
    modelos.set(id, { nombre: f.name.replace(/\.ifc$/i, ""), color: PALETA[(id - 1) % PALETA.length], visible: true, transparente: false, estado: "Leyendo…" });
    pintarModelos();
    const buffer = await f.arrayBuffer();
    lector().postMessage({ cmd: "abrir", id, buffer }, [buffer]);
  }
}

function alMensaje({ data: d }) {
  const m = modelos.get(d.id);
  if (d.cmd === "progreso" && m) { m.estado = `Cargando… ${fmt(d.f * 100)} %`; pintarModelos(); }
  else if (d.cmd === "abierto" && m) {
    const primero = escena.modelos.size === 0;
    const em = escena.anadirModelo(d.id, d, m.color);
    m.estado = d.esquema; delete m.error;
    // Con dos o más modelos se pasa a color por modelo, salvo que se haya elegido otra cosa
    if (modelos.size > 1 && !colorElegido) porModelo = true;
    em.porModelo = porModelo; escena.aplicarAspecto(em);
    if (primero) { escena.vista("3d"); scrollTo({ top: 0 }); } else escena.encuadrar();
    if (matchMedia("(max-width: 699px)").matches) plegarModelos(true); // en móvil, el panel plegado deja ver el modelo
    pintarModelos();
  } else if (d.cmd === "props") pintarProps(d);
  else if (d.cmd === "error") {
    if (d.eid != null) return pintarProps({ ...d, datos: null });
    if (m) { m.error = d.msg; m.estado = ""; pintarModelos(); }
  }
}
function alError(e) { console.error(e); for (const m of modelos.values()) if (m.estado?.startsWith("Le") || m.estado?.startsWith("Ca")) { m.error = "No se ha podido iniciar el lector de IFC."; m.estado = ""; } pintarModelos(); }

// ---------- Lista de modelos ----------

const ICONO_TRANSP = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/></svg>';

function pintarModelos() {
  const hay = modelos.size > 0;
  $("#modelos-titulo").textContent = `Modelos (${modelos.size})`;
  $("#vacio").hidden = hay;
  $("#p-modelos").hidden = !hay; $("#barra").hidden = escena.modelos.size === 0;
  document.body.classList.toggle("con-modelo", hay); // sin título: el visor sube bajo la cabecera
  $("#lista-modelos").innerHTML = [...modelos].map(([id, m]) => `
    <li class="modelo" data-id="${id}">
      <input type="checkbox" data-m="ver" ${m.visible ? "checked" : ""} aria-label="Mostrar ${esc(m.nombre)}">
      <input type="color" data-m="color" value="${m.color}" aria-label="Color de ${esc(m.nombre)}">
      <span class="modelo-nombre" title="${esc(m.nombre)}">${esc(m.nombre)}
        ${m.error ? `<small class="error">${esc(m.error)}</small>` : m.estado ? `<small>${esc(m.estado)}</small>` : ""}</span>
      <button class="icono" type="button" data-m="transp" aria-pressed="${m.transparente}" title="Transparente">${ICONO_TRANSP}</button>
      <button class="icono" type="button" data-m="quitar" title="Quitar modelo" aria-label="Quitar ${esc(m.nombre)}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6"/></svg></button>
    </li>`).join("");
  document.querySelectorAll("[data-color]").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.color === "modelo") === porModelo)));
}

$("#lista-modelos").addEventListener("input", (e) => {
  const li = e.target.closest(".modelo"), id = +li.dataset.id, m = modelos.get(id), em = escena.modelos.get(id);
  if (e.target.dataset.m === "ver") { m.visible = e.target.checked; escena.verModelo(id, m.visible); }
  if (e.target.dataset.m === "color") {
    m.color = e.target.value;
    if (!porModelo) { porModelo = colorElegido = true; aplicarColores(); pintarModelos(); }
    else if (em) { em.color = m.color; escena.aplicarAspecto(em); }
  }
});
$("#lista-modelos").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-m]");
  if (!b) return;
  const id = +b.closest(".modelo").dataset.id, m = modelos.get(id), em = escena.modelos.get(id);
  if (b.dataset.m === "transp") { m.transparente = !m.transparente; if (em) { em.transparente = m.transparente; escena.aplicarAspecto(em); } }
  if (b.dataset.m === "quitar") {
    escena.quitarModelo(id); modelos.delete(id); motor?.postMessage({ cmd: "cerrar", id });
    if (!escena.modelos.size) secc.reiniciar();
    cerrarProps();
  }
  pintarModelos();
});
document.querySelectorAll("[data-color]").forEach((b) => b.addEventListener("click", () => {
  porModelo = b.dataset.color === "modelo"; colorElegido = true; aplicarColores(); pintarModelos();
}));
function plegarModelos(si) {
  $("#p-modelos").classList.toggle("plegado", si);
  $('[data-accion="plegar"]').setAttribute("aria-expanded", String(!si));
}
function aplicarColores() {
  for (const [id, em] of escena.modelos) { em.porModelo = porModelo; em.color = modelos.get(id).color; escena.aplicarAspecto(em); }
}

// ---------- Barra de herramientas ----------

let menuAbierto = null;
function abrirMenu(id) { // id del menú o null para cerrar
  document.querySelectorAll(".menu-lista").forEach((m) => (m.hidden = m.id !== id));
  document.querySelectorAll("[data-menu]").forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.menu === id)));
  menuAbierto = id;
  if (!id) return;
  const menu = $("#" + id), r = $(`[data-menu="${id}"]`).getBoundingClientRect(), v = visor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left - v.left, v.width - menu.offsetWidth - 8)) + "px"; // encima del botón, dentro del visor
  menu.style.top = r.top - v.top - menu.offsetHeight - 8 + "px";
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".menu-lista, [data-menu]")) abrirMenu(null);
  const a = e.target.closest("[data-accion]")?.dataset.accion;
  if (!a) return;
  if (a === "encuadrar") escena.encuadrar(cajaVista());
  else if (a === "menu") { const id = e.target.closest("[data-menu]").dataset.menu; abrirMenu(menuAbierto === id ? null : id); }
  else if (a === "caja") secc.caja ? secc.quitarCaja() : secc.activarCaja();
  else if (a === "caja-sel") { const b = escena.cajaSeleccion(); if (b) { secc.activarCaja(b); escena.encuadrar(b); } }
  else if (a === "encuadrar-sel") { const b = escena.cajaSeleccion(); if (b) escena.encuadrar(b); }
  else if (a === "deseleccionar") cerrarProps();
  else if (a === "plegar") plegarModelos(!$("#p-modelos").classList.contains("plegado"));
  else if (a === "cancelar") modoToque(false);
  else if (a === "reiniciar") {
    secc.reiniciar(); cerrarProps(); modoToque(false);
    for (const [id, m] of modelos) { m.visible = true; escena.verModelo(id, true); }
    pintarModelos(); escena.vista("3d");
  }
});
$("#menu-vista").addEventListener("click", (e) => {
  const t = e.target.closest("[data-vista]")?.dataset.vista;
  if (t) { abrirMenu(null); escena.vista(t, cajaVista()); }
});
$("#menu-corte").addEventListener("click", (e) => {
  const t = e.target.closest("[data-corte]")?.dataset.corte;
  if (!t) return;
  abrirMenu(null);
  if (t === "cara") modoToque(true); else secc.nuevoCorte(t);
});
/** Lo visible: los modelos encendidos, limitados a la caja de sección si está activa. */
function cajaVista() {
  const b = escena.caja();
  if (secc.caja) b.intersect({ min: secc.caja.min, max: secc.caja.max }); // Box3.intersect solo lee min y max
  return b;
}
function modoToque(si) { modoCara = si; $("#toque").hidden = !si; lienzo.style.cursor = si ? "crosshair" : ""; }

// ---------- Panel de cortes y caja ----------

function pintarSecciones() {
  const p = $("#p-secciones");
  const filas = secc.cortes.map((c) => `
    <div class="seccion" data-c="${c.id}">
      <span>Corte ${esc(c.nombre.toLowerCase())}</span>
      <button class="btn mini" type="button" data-s="invertir">Invertir</button>
      <button class="icono" type="button" data-s="quitar" aria-label="Quitar corte"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6"/></svg></button>
      <input type="range" min="${c.min}" max="${c.max}" step="${(c.max - c.min) / 500}" value="${c.u}" aria-label="Posición del corte">
    </div>`);
  if (secc.caja) filas.push(`
    <div class="seccion"><span>Caja de sección: arrastra las esferas</span>
      <button class="btn mini" type="button" data-s="caja-todo">Ajustar a todo</button>
      <button class="icono" type="button" data-s="caja-quitar" aria-label="Quitar caja"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6"/></svg></button>
    </div>`);
  p.innerHTML = filas.join(""); p.hidden = !filas.length;
  $('[data-accion="caja"]').setAttribute("aria-pressed", String(!!secc.caja));
}
const corteDe = (el) => secc.cortes.find((c) => c.id === +el.closest("[data-c]")?.dataset.c);
$("#p-secciones").addEventListener("input", (e) => { const c = corteDe(e.target); if (c) secc.mover(c, +e.target.value); });
$("#p-secciones").addEventListener("click", (e) => {
  const s = e.target.closest("[data-s]")?.dataset.s;
  if (s === "invertir") secc.invertir(corteDe(e.target));
  else if (s === "quitar") secc.quitar(corteDe(e.target));
  else if (s === "caja-todo") secc.activarCaja();
  else if (s === "caja-quitar") secc.quitarCaja();
});

// ---------- Selección y propiedades ----------

let abajo = null;
lienzo.addEventListener("pointerdown", (e) => { abajo = { x: e.clientX, y: e.clientY, t: performance.now() }; });
lienzo.addEventListener("pointerup", (e) => {
  if (!abajo) return;
  const corto = Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) < 6 && performance.now() - abajo.t < 500;
  abajo = null;
  if (!corto || e.button > 0) return;
  const t = escena.tocar(e.clientX, e.clientY);
  if (modoCara) { if (t) { secc.nuevoCorte("cara", t); modoToque(false); } return; }
  if (!t) return cerrarProps();
  escena.seleccionar(t);
  $("#p-props").hidden = false;
  $("#props-titulo").textContent = "Propiedades";
  $("#props").innerHTML = '<p class="vacio-props">Leyendo propiedades…</p>';
  lector().postMessage({ cmd: "props", id: t.id, eid: t.eid });
});
lienzo.addEventListener("dblclick", (e) => { const t = escena.tocar(e.clientX, e.clientY); if (t) escena.orbitarEn(t.punto); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { cerrarProps(); modoToque(false); abrirMenu(null); } });

function cerrarProps() { escena.seleccionar(null); $("#p-props").hidden = true; }

const valor = (v, u) => (typeof v === "number" ? fmt(v, Number.isInteger(v) ? 0 : Math.abs(v) >= 100 ? 1 : 3) : esc(v)) + (u ? " " + esc(u) : "");
const tabla = (filas) => `<table><tbody>${filas.join("")}</tbody></table>`;

function pintarProps({ id, eid, datos }) {
  if (!escena.sel || escena.sel.id !== id || escena.sel.eid !== eid) return; // respuesta de una selección anterior
  if (!datos) { $("#props").innerHTML = '<p class="vacio-props">No se han podido leer las propiedades de este elemento.</p>'; return; }
  const g = Object.fromEntries(datos.general);
  $("#props-titulo").textContent = g["Nombre"] || g["Clase IFC"] || "Propiedades";
  const general = datos.general.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`);
  general.push(`<tr><td>Modelo</td><td>${esc(modelos.get(id)?.nombre)}</td></tr>`);
  const grupos = datos.grupos.map((gr) => `
    <details ${datos.grupos.length <= 3 ? "open" : ""}><summary>${esc(gr.nombre)}</summary>
      ${gr.filas.length ? tabla(gr.filas.map((f) => `<tr><td>${esc(f.n)}</td><td>${valor(f.v, f.u)}</td></tr>`)) : '<p class="vacio-props">Sin valores.</p>'}
    </details>`);
  $("#props").innerHTML = `<details open><summary>General</summary>${tabla(general)}</details>${grupos.join("")}` +
    (datos.grupos.length ? "" : '<p class="vacio-props">Este elemento no tiene conjuntos de propiedades (Psets) ni cantidades (Qtos).</p>');
}

pintarModelos();
if (location.hash === "#prueba") window.visor = { escena, secc }; // solo para pruebas automáticas
