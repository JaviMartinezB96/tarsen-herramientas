// Visor IFC TARSEN — lectura de IFC en segundo plano (web-ifc), para no bloquear la pestaña.
// Mensajes de entrada:  {cmd:"abrir", id, buffer}  {cmd:"props", id, eid}  {cmd:"cerrar", id}
// Mensajes de salida:   {cmd:"progreso", id, f}  {cmd:"abierto", id, ...}  {cmd:"props", id, eid, datos}  {cmd:"error", id, msg}
import * as WebIFC from "./vendor/web-ifc/web-ifc-api.js";

const api = new WebIFC.IfcAPI();
api.SetWasmPath(new URL("./vendor/web-ifc/", import.meta.url).href, true);
const listo = api.Init(undefined, true); // un solo hilo: no exige cabeceras COOP/COEP en el hosting

const modelos = new Map(); // id visor -> { mid (id web-ifc), unidades }
let origen = null;         // desplazamiento común (m) para todos los modelos: evita coordenadas enormes en float32 y mantiene la superposición

/** Array que crece por bloques (evita conocer el tamaño final de antemano). */
class Crece {
  constructor(Tipo, n = 1 << 16) { this.T = Tipo; this.a = new Tipo(n); this.n = 0; }
  reservar(k) {
    if (this.n + k <= this.a.length) return;
    let m = this.a.length * 2; while (m < this.n + k) m *= 2;
    const b = new this.T(m); b.set(this.a.subarray(0, this.n)); this.a = b;
  }
  final() { return this.a.slice(0, this.n); }
}

function cubo() {
  return { pos: new Crece(Float32Array), nor: new Crece(Float32Array), col: new Crece(Uint8Array), idx: new Crece(Uint32Array),
    eids: [], ini: [], num: [], cajas: [], nv: 0 };
}

/** Añade una geometría colocada al cubo, aplicando su matriz (columna mayor, 4x4) y el origen común. */
function anadir(c, eid, v, ix, m, color) {
  const nv = v.length / 6, [ox, oy, oz] = origen;
  c.pos.reservar(nv * 3); c.nor.reservar(nv * 3); c.col.reservar(nv * 4); c.idx.reservar(ix.length);
  const P = c.pos.a, N = c.nor.a, C = c.col.a, I = c.idx.a;
  let p = c.pos.n, q = c.col.n;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity; // caja del elemento
  const r = Math.round(color.x * 255), g = Math.round(color.y * 255), b = Math.round(color.z * 255), a = Math.round(color.w * 255);
  for (let i = 0; i < nv; i++) {
    const x = v[i * 6], y = v[i * 6 + 1], z = v[i * 6 + 2];
    P[p] = m[0] * x + m[4] * y + m[8] * z + m[12] - ox;
    P[p + 1] = m[1] * x + m[5] * y + m[9] * z + m[13] - oy;
    P[p + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] - oz;
    if (P[p] < x0) x0 = P[p]; if (P[p] > x1) x1 = P[p];
    if (P[p + 1] < y0) y0 = P[p + 1]; if (P[p + 1] > y1) y1 = P[p + 1];
    if (P[p + 2] < z0) z0 = P[p + 2]; if (P[p + 2] > z1) z1 = P[p + 2];
    const nx = v[i * 6 + 3], ny = v[i * 6 + 4], nz = v[i * 6 + 5];
    let ax = m[0] * nx + m[4] * ny + m[8] * nz, ay = m[1] * nx + m[5] * ny + m[9] * nz, az = m[2] * nx + m[6] * ny + m[10] * nz;
    const l = Math.hypot(ax, ay, az) || 1;
    N[p] = ax / l; N[p + 1] = ay / l; N[p + 2] = az / l;
    C[q] = r; C[q + 1] = g; C[q + 2] = b; C[q + 3] = a;
    p += 3; q += 4;
  }
  const base = c.nv, i0 = c.idx.n;
  for (let i = 0; i < ix.length; i++) I[i0 + i] = ix[i] + base;
  c.eids.push(eid); c.ini.push(i0); c.num.push(ix.length); c.cajas.push(x0, y0, z0, x1, y1, z1);
  c.pos.n = p; c.nor.n = p; c.col.n = q; c.idx.n += ix.length; c.nv += nv;
}

const COS_ARISTA = Math.cos(30 * Math.PI / 180); // ángulo mínimo entre caras para dibujar la arista (criterio del visor)

/** Aristas vivas de una geometría (bordes libres y pliegues > 30°), ya transformadas, en L (pares de puntos). */
function aristas(v, ix, m, L) {
  const nv = v.length / 6, id = new Int32Array(nv), clave = new Map();
  let u = 0;
  for (let i = 0; i < nv; i++) { // vértices coincidentes (las caras planas no comparten vértice)
    const k = Math.round(v[i * 6] * 1e4) + "," + Math.round(v[i * 6 + 1] * 1e4) + "," + Math.round(v[i * 6 + 2] * 1e4);
    let j = clave.get(k);
    if (j === undefined) { j = u++; clave.set(k, j); }
    id[i] = j;
  }
  const lado = new Map(); // arista (a·u + b) -> [nx, ny, nz, vértice a, vértice b, ¿pliegue?]
  for (let t = 0; t < ix.length; t += 3) {
    const a = ix[t] * 6, b = ix[t + 1] * 6, c = ix[t + 2] * 6;
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2];
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) continue;
    nx /= l; ny /= l; nz /= l;
    for (const [p, q] of [[ix[t], ix[t + 1]], [ix[t + 1], ix[t + 2]], [ix[t + 2], ix[t]]]) {
      const i1 = id[p], i2 = id[q];
      if (i1 === i2) continue;
      const k = i1 < i2 ? i1 * u + i2 : i2 * u + i1;
      const e = lado.get(k);
      if (!e) lado.set(k, [nx, ny, nz, p, q, true]);
      else e[5] = e[0] * nx + e[1] * ny + e[2] * nz < COS_ARISTA; // dos caras: solo si forman pliegue
    }
  }
  const [ox, oy, oz] = origen;
  for (const e of lado.values()) {
    if (!e[5]) continue;
    L.reservar(6);
    for (const p of [e[3], e[4]]) {
      const x = v[p * 6], y = v[p * 6 + 1], z = v[p * 6 + 2], A = L.a, n = L.n;
      A[n] = m[0] * x + m[4] * y + m[8] * z + m[12] - ox;
      A[n + 1] = m[1] * x + m[5] * y + m[9] * z + m[13] - oy;
      A[n + 2] = m[2] * x + m[6] * y + m[10] * z + m[14] - oz;
      L.n += 3;
    }
  }
}

function empaquetar(c) {
  return { pos: c.pos.final(), nor: c.nor.final(), col: c.col.final(), idx: c.idx.final(),
    eids: Uint32Array.from(c.eids), ini: Uint32Array.from(c.ini), num: Uint32Array.from(c.num), cajas: Float32Array.from(c.cajas) };
}

async function abrir(id, buffer) {
  await listo;
  const mid = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: false });
  if (mid < 0) throw new Error("No se ha podido leer el archivo. ¿Es un IFC válido?");
  const opaco = cubo(), transp = cubo(), lin = new Crece(Float32Array);
  let ultimo = 0;
  api.StreamAllMeshes(mid, (malla, i, total) => {
    const n = malla.geometries.size();
    for (let k = 0; k < n; k++) {
      const pg = malla.geometries.get(k);
      const m = pg.flatTransformation;
      if (!origen) origen = [Math.round(m[12]), Math.round(m[13]), Math.round(m[14])];
      const geo = api.GetGeometry(mid, pg.geometryExpressID);
      const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
      const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
      if (ix.length) {
        anadir(pg.color.w < 0.99 ? transp : opaco, malla.expressID, v, ix, m, pg.color);
        if (pg.color.w >= 0.99) aristas(v, ix, m, lin); // sin aristas en vidrios
      }
      geo.delete();
    }
    if (total && i - ultimo > total / 50) { ultimo = i; postMessage({ cmd: "progreso", id, f: i / total }); }
  });
  modelos.set(id, { mid, unidades: leerUnidades(mid) });
  const o = empaquetar(opaco), t = empaquetar(transp);
  const aris = lin.final();
  const lista = [aris.buffer, ...[o, t].flatMap((x) => [x.pos.buffer, x.nor.buffer, x.col.buffer, x.idx.buffer, x.eids.buffer, x.ini.buffer, x.num.buffer, x.cajas.buffer])];
  postMessage({ cmd: "abierto", id, esquema: api.GetModelSchema(mid), opaco: o, transp: t, aristas: aris }, lista);
}

// ---------- Propiedades ----------

const val = (x) => (x && typeof x === "object" && "value" in x ? x.value : x);

/** Decodifica cadenas STEP (ISO 10303-21): \X2\00F3\X0\ → ó, \X\F3 → ó, \S\s → ó. */
function texto(s) {
  s = val(s);
  if (typeof s !== "string") return s;
  if (!s.includes("\\")) return s;
  return s
    .replace(/\\X2\\([0-9A-F]+)\\X0\\/gi, (_, h) => String.fromCodePoint(...h.match(/.{4}/g).map((c) => parseInt(c, 16))))
    .replace(/\\X\\([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\S\\(.)/g, (_, c) => String.fromCharCode(c.charCodeAt(0) + 128));
}

const PREFIJO = { EXA: "E", PETA: "P", TERA: "T", GIGA: "G", MEGA: "M", KILO: "k", HECTO: "h", DECA: "da", DECI: "d", CENTI: "c", MILLI: "m", MICRO: "µ", NANO: "n" };
const BASE = { METRE: "m", SQUARE_METRE: "m²", CUBIC_METRE: "m³", GRAM: "g", SECOND: "s", NEWTON: "N", PASCAL: "Pa", RADIAN: "rad", DEGREE_CELSIUS: "°C", KELVIN: "K", JOULE: "J", WATT: "W", VOLT: "V", AMPERE: "A", HERTZ: "Hz", LUMEN: "lm", LUX: "lx" };

/** Unidades del proyecto (IfcUnitAssignment) por tipo: LENGTHUNIT → "mm", etc. */
function leerUnidades(mid) {
  const u = {};
  try {
    const ids = api.GetLineIDsWithType(mid, WebIFC.IFCUNITASSIGNMENT);
    for (let i = 0; i < ids.size(); i++) {
      const ua = api.GetLine(mid, ids.get(i), true);
      for (const un of ua.Units || []) {
        const tipo = val(un.UnitType);
        if (!tipo) continue;
        if (un.Name && BASE[val(un.Name)] && !un.ConversionFactor) {
          const pre = PREFIJO[val(un.Prefix)] || "", b = BASE[val(un.Name)];
          u[tipo] = b.endsWith("²") || b.endsWith("³") ? pre + b : pre + b; // mm, m², kN…
        } else if (un.Name) u[tipo] = texto(un.Name);
      }
    }
  } catch { /* sin unidades: se muestran los números sin símbolo */ }
  return u;
}

// Tipo de cantidad → (atributo con el valor, tipo de unidad IFC)
const CANTIDAD = {
  IFCQUANTITYLENGTH: ["LengthValue", "LENGTHUNIT"], IFCQUANTITYAREA: ["AreaValue", "AREAUNIT"],
  IFCQUANTITYVOLUME: ["VolumeValue", "VOLUMEUNIT"], IFCQUANTITYWEIGHT: ["WeightValue", "MASSUNIT"],
  IFCQUANTITYCOUNT: ["CountValue", null], IFCQUANTITYTIME: ["TimeValue", "TIMEUNIT"],
};
// Tipo de valor IFC → tipo de unidad, para las propiedades simples
const MEDIDA = { IFCLENGTHMEASURE: "LENGTHUNIT", IFCPOSITIVELENGTHMEASURE: "LENGTHUNIT", IFCAREAMEASURE: "AREAUNIT", IFCVOLUMEMEASURE: "VOLUMEUNIT", IFCMASSMEASURE: "MASSUNIT", IFCPLANEANGLEMEASURE: "PLANEANGLEUNIT", IFCPOSITIVEPLANEANGLEMEASURE: "PLANEANGLEUNIT" };

function valorProp(p, uni) {
  const nombre = (x) => api.GetNameFromTypeCode(x.type) || "";
  const tipo = nombre(p).toUpperCase();
  if (CANTIDAD[tipo]) {
    const [at, tu] = CANTIDAD[tipo];
    return { v: val(p[at]), u: tu ? uni[tu] || "" : "" };
  }
  if (tipo === "IFCPROPERTYSINGLEVALUE") {
    const nv = p.NominalValue;
    if (nv == null) return { v: "" };
    const t = (nv.name || "").toUpperCase(); // p. ej. IFCLENGTHMEASURE
    let v = texto(nv);
    if (v === "T" || v === true) v = "Sí"; else if (v === "F" || v === false) v = "No";
    return { v, u: MEDIDA[t] ? uni[MEDIDA[t]] || "" : "" };
  }
  if (tipo === "IFCPROPERTYENUMERATEDVALUE") return { v: (p.EnumerationValues || []).map(texto).join(", ") };
  if (tipo === "IFCPROPERTYLISTVALUE") return { v: (p.ListValues || []).map(texto).join(", ") };
  if (tipo === "IFCPROPERTYBOUNDEDVALUE") return { v: [texto(p.LowerBoundValue), texto(p.UpperBoundValue)].filter((x) => x != null).join(" – ") };
  return { v: texto(p.NominalValue) ?? "" };
}

function conjunto(ps, uni) {
  const filas = [];
  for (const p of ps.HasProperties || ps.Quantities || []) {
    if (!p || !p.Name) continue;
    filas.push({ n: texto(p.Name), ...valorProp(p, uni) });
  }
  return { nombre: texto(ps.Name) || "(sin nombre)", filas };
}

/** Nombres de IfcMaterial asociados (IfcRelAssociatesMaterial) al elemento o a su tipo, recorriendo capas, perfiles y constituyentes. */
function materiales(mid, ids) {
  const nombres = new Set(), vistos = new Set();
  const recoger = (ref) => {
    const id = typeof ref === "number" ? ref : val(ref);
    if (typeof id !== "number" || vistos.has(id)) return;
    vistos.add(id);
    const m = api.GetLine(mid, id, false);
    const t = api.GetNameFromTypeCode(m.type).toUpperCase();
    if (t === "IFCMATERIAL") return void nombres.add(texto(m.Name));
    for (const k of ["ForLayerSet", "MaterialLayers", "Material", "Materials", "MaterialProfiles", "MaterialConstituents", "ForProfileSet"])
      [].concat(m[k] || []).forEach(recoger);
  };
  for (const id of ids) {
    try {
      const el = api.GetLine(mid, id, false, true);
      for (const r of [].concat(el.HasAssociations || [])) {
        const rel = api.GetLine(mid, val(r), false);
        if (api.GetNameFromTypeCode(rel.type).toUpperCase() === "IFCRELASSOCIATESMATERIAL") recoger(rel.RelatingMaterial);
      }
    } catch { /* sin asociaciones */ }
  }
  return [...nombres].filter(Boolean);
}

async function propiedades(id, eid) {
  const { mid, unidades } = modelos.get(id);
  const el = api.GetLine(mid, eid, false, true);
  const clase = api.GetNameFromTypeCode(api.GetLineType(mid, eid));
  const general = [
    ["Clase IFC", clase], ["Nombre", texto(el.Name)], ["Descripción", texto(el.Description)],
    ["Tipo de objeto", texto(el.ObjectType)], ["Marca (Tag)", texto(el.Tag)], ["GlobalId", texto(el.GlobalId)],
  ];
  // Nivel: IfcRelContainedInSpatialStructure (atributo inverso ContainedInStructure)
  try {
    const rel = [].concat(el.ContainedInStructure || [])[0];
    if (rel) {
      const r = api.GetLine(mid, val(rel), false);
      const est = api.GetLine(mid, val(r.RelatingStructure), false);
      general.push(["Nivel / contenedor", texto(est.Name) || api.GetNameFromTypeCode(est.type)]);
    }
  } catch { /* sin contenedor espacial */ }
  const grupos = [], tipos = [];
  try {
    for (const t of (await api.properties.getTypeProperties(mid, eid, true)) || []) {
      tipos.push(t);
      general.push(["Tipo", texto(t.Name) + " (" + api.GetNameFromTypeCode(t.type) + ")"]);
    }
  } catch { /* sin tipo */ }
  const mats = materiales(mid, [eid, ...tipos.map((t) => t.expressID)]);
  if (mats.length) general.push(["Material", mats.join(", ")]);
  try { // 4.º argumento false: con true, web-ifc 0.0.78 falla si el tipo no tiene psets
    for (const ps of (await api.properties.getPropertySets(mid, eid, true, false)) || []) grupos.push(conjunto(ps, unidades));
  } catch { /* sin psets */ }
  for (const t of tipos) for (const ps of [].concat(t.HasPropertySets || [])) {
    if (ps && typeof ps === "object" && (ps.HasProperties || ps.Quantities)) {
      const g = conjunto(ps, unidades); g.nombre += " (tipo)"; grupos.push(g);
    }
  }
  grupos.sort((a, b) => (a.nombre.startsWith("Qto_") || a.nombre.includes("Quant")) - (b.nombre.startsWith("Qto_") || b.nombre.includes("Quant")) || a.nombre.localeCompare(b.nombre));
  return { general: general.filter(([, v]) => v != null && v !== ""), grupos };
}

onmessage = async ({ data: d }) => {
  try {
    if (d.cmd === "abrir") await abrir(d.id, d.buffer);
    else if (d.cmd === "props") postMessage({ cmd: "props", id: d.id, eid: d.eid, datos: await propiedades(d.id, d.eid) });
    else if (d.cmd === "cerrar") {
      const m = modelos.get(d.id);
      if (m) { api.CloseModel(m.mid); modelos.delete(d.id); }
      if (!modelos.size) origen = null;
    }
  } catch (e) {
    postMessage({ cmd: "error", id: d.id, eid: d.eid, msg: e?.message || String(e) });
  }
};
