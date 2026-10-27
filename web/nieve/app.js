// Interfaz de /nieve/: mapa con buscador → chincheta → carga de nieve al momento + datos editables.
// Cálculo en calculo.js, zonas en zonas.js, mapa y servicios externos en mapa.js. Datos en data/.
import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";
import { calcular, capitalDe } from "./calculo.js";
import { prepararZonas, zonaDe } from "./zonas.js";
import { crearMapa, buscar, inverso, altitudIGN, municipioDe, lugarDe } from "./mapa.js";

iniciarPagina();
const [N, GEO] = await Promise.all([cargarJSON("data/nieve.json"), cargarJSON("data/zonas_e2.json")]);
const ZONAS = prepararZonas(GEO);
const $ = (s) => document.querySelector(s);
const f = $("#f");

// Estado. Por defecto: cubierta con poca pendiente, sin impedimento y exposición normal (μ = 1).
const DEF = { angulo: 0, impedimento: "no", viento: "normal", metodo: "general" };
let est = { ...DEF }, turno = 0;

const mapa = crearMapa($("#mapa"), GEO, (lat, lon) => fijarPunto(lat, lon));
$("#ver-zonas").addEventListener("change", (e) => mapa.verZonas(e.target.checked));

// ---- Buscador (al pulsar Intro o «Buscar»; Nominatim no admite autocompletar) ----
$("#buscador").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("#q").value.trim(), lista = $("#encontrados");
  if (q.length < 2) return;
  lista.innerHTML = `<p class="nota">Buscando…</p>`;
  try {
    const res = await buscar(q);
    if (!res.length) { lista.innerHTML = `<p class="nota">No se ha encontrado «${esc(q)}» en España. Prueba con otro nombre o pulsa en el mapa.</p>`; return; }
    if (res.length === 1) return elegir(res[0]);
    lista.innerHTML = `<div class="opciones-radio">${res.map((r, i) => `
      <button type="button" class="radio resultado" data-i="${i}"><span><span class="radio-texto">${esc(r.name || r.display_name.split(",")[0])}</span>
      <small>${esc(r.display_name)}</small></span></button>`).join("")}</div>`;
    lista.onclick = (ev) => { const b = ev.target.closest("[data-i]"); if (b) elegir(res[+b.dataset.i]); };
  } catch { lista.innerHTML = `<p class="nota alerta">El buscador no responde ahora mismo. Pulsa directamente en el mapa.</p>`; }
});
function elegir(r) {
  $("#encontrados").innerHTML = "";
  fijarPunto(+r.lat, +r.lon, r.address, 12);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ---- Punto elegido: zona (local, al momento), municipio (Nominatim) y altitud (IGN) ----
async function fijarPunto(lat, lon, address, zoom) {
  const t = ++turno;
  mapa.ponerChincheta(lat, lon, zoom);
  est = { ...est, lat, lon, alt: null, altFuente: "cargando", lugar: address ? lugarDe(address) : "", capital: null, origen: "E2", fuera: false };
  ponerZona(address ? municipioDe(address) : "");
  if (address) ponerMunicipio(address);
  $("#p-resultados").hidden = false;
  pintarCampos(); pintar();

  const pAlt = altitudIGN(lat, lon).then(
    (h) => { if (t === turno) Object.assign(est, { alt: Math.round(h), altFuente: "ign" }); },
    () => { if (t === turno) Object.assign(est, { alt: null, altFuente: "error" }); });
  const pDir = address ? null : inverso(lat, lon).then(
    (j) => { if (t === turno) { ponerMunicipio(j.address || {}); ponerZona(municipioDe(j.address)); } },
    () => { if (t === turno) est.lugar = `${fmt(lat, 4)}, ${fmt(lon, 4)}`; });
  pAlt.then(() => t === turno && (pintarCampos(), pintar()));
  pDir?.then(() => t === turno && (pintarCampos(), pintar()));
}

function ponerMunicipio(a) {
  est.fuera = a.country_code && a.country_code !== "es";
  est.lugar = lugarDe(a, `${fmt(est.lat, 4)}, ${fmt(est.lon, 4)}`);
  est.capital = capitalDe(N, municipioDe(a));
  est.origen = est.capital ? "3.8" : "E2";                      // por defecto la tabla 3.8 en capitales (3.5.2.1)
}
function ponerZona(municipio) {
  est.zonaInfo = zonaDe(ZONAS, N, est.lat, est.lon, municipio);
  est.zona = est.zonaInfo.zona;
}

// ---- Datos editables (se recalcula al momento) ----
const opt = (v, t, sel) => `<option value="${v}"${String(v) === String(sel) ? " selected" : ""}>${t}</option>`;
function pintarCampos() {
  const zi = est.zonaInfo || {}, c = est.capital;
  f.innerHTML = `
    <label class="campo"><span>Altitud del emplazamiento (m)</span>
      <input type="number" inputmode="numeric" name="alt" min="0" max="3500" step="1" value="${est.alt ?? ""}"
        placeholder="${est.altFuente === "cargando" ? "Obteniendo…" : "Escribe la altitud"}"></label>
    <label class="campo"><span>Zona de clima invernal (figura E.2)</span>
      <select name="zona">${[1, 2, 3, 4, 5, 6, 7].map((z) => opt(z, `Zona ${z}${z === zi.zona ? " · detectada" : ""}`, est.zona)).join("")}</select></label>
    <label class="campo" ${c ? "" : "hidden"}><span>Valor de s<sub>k</sub> en ${c ? esc(c.nombre) : ""}</span>
      <select name="origen">${c ? opt("3.8", `Tabla 3.8 · capital a ${fmt(c.altitud)} m`, est.origen) + opt("E2", "Tabla E.2 · zona y altitud del punto", est.origen) : ""}</select></label>
    <label class="campo"><span>Inclinación del faldón (°)</span>
      <input type="number" inputmode="decimal" name="angulo" min="0" max="90" step="1" value="${est.angulo}"></label>
    <label class="campo"><span>¿Algo impide que la nieve deslice?</span>
      <select name="impedimento">${opt("no", "No: el faldón acaba en alero o limatesa", est.impedimento)}${opt("si", "Sí: peto, canalón alto o retenedores de nieve", est.impedimento)}</select></label>
    <label class="campo"><span>Exposición al viento</span>
      <select name="viento">${N.viento.opciones.map((o) => opt(o.id, o.texto, est.viento)).join("")}</select></label>
    <label class="campo" data-metodo><span>Método</span>
      <select name="metodo">${opt("general", "General: qn = μ · sk", est.metodo)}${opt("simplificado", "Simplificado 1,0 kN/m² (cubierta plana de edificio de pisos)", est.metodo)}</select></label>`;
  visibilidad();
}
function visibilidad() {
  f.querySelector("[data-metodo]").hidden = !(est.alt != null && est.alt < N.simplificado.altitud_max);
}

f.addEventListener("input", (e) => {
  const t = e.target, n = t.name;
  if (t.type === "number") {
    const v = Number(t.value), ok = t.value !== "" && v >= +t.min && v <= +t.max;
    t.setAttribute("aria-invalid", !ok);
    if (!ok) return;
    est[n] = v;
    if (n === "alt") est.altFuente = "usuario";
  } else est[n] = n === "zona" ? Number(t.value) : t.value;
  visibilidad();
  pintar();
});

// ---- Resultado ----
const fila = (titulo, valor, ref) => `<div class="res"><span>${titulo}</span><span class="dato">${valor}</span><span class="ref">${ref}</span></div>`;
const nota = (texto, ref, alerta) => `<p class="nota${alerta ? " alerta" : ""}">${texto}${ref ? ` <span class="ref">${ref}</span>` : ""}</p>`;
const kn = (x, d = 2) => `${fmt(x, d)} kN/m²`;

function pintar() {
  const out = $("#res"), lugar = esc(est.lugar || "Obteniendo municipio…");
  if (est.fuera) { out.innerHTML = nota("Ese punto está fuera de España. Elige un emplazamiento en territorio español.", "", true); return; }
  if (est.zona == null) { out.innerHTML = nota("Ese punto no está en ninguna zona de la figura E.2 (mar o fuera de España). Elige otro punto o indica la zona a mano.", "", true); return; }
  if (est.alt == null) {
    out.innerHTML = est.altFuente === "cargando"
      ? `<p class="label">${lugar}</p><p class="nota">Obteniendo la altitud del terreno…</p>`
      : `<p class="label">${lugar}</p>` + nota("No se ha podido obtener la altitud automáticamente. Escríbela en «Altitud del emplazamiento».", "", true);
    return;
  }
  const r = calcular(N, est), zi = est.zonaInfo || {};
  const altRef = { ign: "MDT del IGN (paso de 25 m; 500 m en Canarias)", usuario: "Introducida por ti" }[est.altFuente] || "";
  const zonaRef = est.zona !== zi.zona ? "Elegida por ti" : {
    canarias: "Canarias: zona 7", "ceuta-melilla": "Ceuta y Melilla: zona 6", cercana: `Zona más próxima (a ${fmt(zi.km, 1)} km)`,
  }[zi.regla] || "Detectada en el mapa";

  let h = `<p class="label">${lugar}</p>`;
  if (r.qn == null) {
    h += `<p class="designacion">Sin valor en la tabla E.2</p>` +
      nota(`A ${fmt(est.alt)} m la zona ${est.zona} no tiene valor tabulado. ${N.tabla_E2.fuera_de_tabla.split(": ")[1]}`, "CTE DB SE-AE, 3.5.2.3", true);
  } else {
    const formula = r.metodo === "simplificado"
      ? "Cubierta plana de edificio de pisos por debajo de 1.000 m · CTE DB SE-AE, 3.5.1.1"
      : `q<sub>n</sub> = μ · s<sub>k</sub>${r.factor !== 1 ? ` · ${fmt(r.factor, 1)}` : ""} = ${fmt(r.mu, 2)} · ${fmt(r.sk, 2)}${r.factor !== 1 ? ` · ${fmt(r.factor, 1)}` : ""} · CTE DB SE-AE, 3.5.1.2, ec. (3.2)${r.factor !== 1 ? " y 3.5.1.3" : ""}`;
    h += `<p class="label">Carga de nieve sobre la cubierta (proyección horizontal)</p>
      <p class="designacion">q<sub>n</sub> = ${kn(r.qn)}</p><p class="ref">${formula}</p>`;
  }
  h += `<div class="resultados">` +
    fila("Altitud", `${fmt(est.alt)} m`, altRef) +
    fila("Zona de clima invernal", `${est.zona}`, `${zonaRef} · Anejo E, figura E.2`) +
    (r.sk != null ? fila("Carga sobre terreno horizontal s<sub>k</sub>", kn(r.sk), refSk(r)) : "") +
    (r.metodo === "general" ? fila("Coeficiente de forma μ", fmt(r.mu, 2), refMu()) : "") +
    (r.metodo === "general" && r.factor !== 1 ? fila("Exposición al viento", `× ${fmt(r.factor, 1)}`, "CTE DB SE-AE, 3.5.1.3") : "") + `</div>`;

  const notas = [];
  if (zi.cerca && est.zona === zi.zona) notas.push([`El punto está a ${fmt(zi.cerca.km, 1)} km de la zona ${zi.cerca.zona}. Los límites de la figura E.2 son aproximados: si dudas, compara las dos zonas.`, "Criterio TARSEN", true]);
  if (est.capital && est.origen === "3.8" && r.e2?.sk != null && Math.abs(est.alt - est.capital.altitud) > 100)
    notas.push([`Tu punto está a ${fmt(est.alt)} m y la tabla 3.8 da el valor de ${esc(est.capital.nombre)} a ${fmt(est.capital.altitud)} m. Con la tabla E.2 y la altitud del punto saldría s<sub>k</sub> = ${kn(r.e2.sk)}. Puedes cambiarlo en «Valor de s<sub>k</sub>».`, "3.5.2.1 y 3.5.2.2", true]);
  if (r.metodo === "general" && r.simplificadoAplica) notas.push(["Si es la cubierta plana de un edificio de pisos, el DB permite tomar directamente 1,0 kN/m². Puedes elegirlo en «Método».", "CTE DB SE-AE, 3.5.1.1"]);
  if (r.pn != null) notas.push([`Por encima de 1.000 m, en los vuelos de la cubierta añade en el borde una carga lineal de hielo p<sub>n</sub> = k · μ² · s<sub>k</sub> = 3 · ${fmt(r.mu, 2)}² · ${fmt(r.sk, 2)} = ${fmt(r.pn, 2)} kN/m.`, "CTE DB SE-AE, 3.5.1.4, ec. (3.3)"]);
  if (est.impedimento === "si" && est.angulo > N.forma.angulo_mu1) notas.push(["Con impedimento al deslizamiento, comprueba también el elemento que retiene la nieve con la masa de nieve que puede deslizar (rozamiento nulo).", "CTE DB SE-AE, 3.5.1.5"]);
  notas.push(["No incluye: faldones que acaban en limahoya, distribuciones asimétricas por viento, acumulaciones junto a cambios de nivel o petos, ni redistribuciones en cubiertas accesibles. Si tu cubierta las tiene, el cálculo es específico.", "CTE DB SE-AE, 3.5 (2), 3.5.3.3, 3.5.3.4 y 3.5.4"]);
  h += notas.filter((n) => n[2]).map(([t, ref]) => nota(t, ref, true)).join("");
  const resto = notas.filter((n) => !n[2]);
  h += `<details class="detalles"><summary>Notas (${resto.length})</summary>${resto.map(([t, ref]) => nota(t, ref)).join("")}</details>`;
  out.innerHTML = h;
}

function refSk(r) {
  if (r.fuenteSk === "3.8") return `Tabla 3.8 · ${esc(est.capital.nombre)} (${fmt(est.capital.altitud)} m)`;
  const A = N.tabla_E2.altitudes, fl = r.e2.filas, v = N.tabla_E2.zonas[est.zona];
  return fl.length === 1 ? `Tabla E.2 · zona ${est.zona}, ${fmt(A[fl[0]])} m`
    : `Tabla E.2 · zona ${est.zona}, interpolado entre ${fmt(A[fl[0]])} m (${fmt(v[fl[0]], 1)}) y ${fmt(A[fl[1]])} m (${fmt(v[fl[1]], 1)})`;
}
function refMu() {
  if (est.impedimento === "si") return "Con impedimento al deslizamiento: μ = 1 · 3.5.3.2";
  return `Faldón a ${fmt(est.angulo)}°: 1 hasta 30°, 0 desde 60°, lineal entre medias · 3.5.3.2`;
}
