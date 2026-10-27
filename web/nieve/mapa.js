// Mapa (Leaflet + teselas de OpenStreetMap), buscador (Nominatim) y altitud del terreno (MDT del IGN).
// Leaflet se carga como script global en index.html (window.L).
const L = window.L;

// ---- Nominatim (OpenStreetMap): máximo 1 petición por segundo y sin autocompletar (política de uso de la OSMF) ----
const NOMINATIM = "https://nominatim.openstreetmap.org";
let ultima = 0;
async function nominatim(ruta, params) {
  const espera = ultima + 1100 - Date.now();
  if (espera > 0) await new Promise((r) => setTimeout(r, espera));
  ultima = Date.now();
  const q = new URLSearchParams({ format: "jsonv2", addressdetails: 1, "accept-language": "es", ...params });
  const r = await fetch(`${NOMINATIM}/${ruta}?${q}`);
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  return r.json();
}
export const buscar = (texto) => nominatim("search", { q: texto, countrycodes: "es", limit: 6 });
export const inverso = (lat, lon) => nominatim("reverse", { lat, lon, zoom: 10 });

export const municipioDe = (a = {}) => a.city || a.town || a.village || a.municipality || a.hamlet || "";
export function lugarDe(a = {}, alternativo = "") {
  const m = municipioDe(a), p = a.province || a.state || "";
  return m ? (p && p !== m ? `${m} (${p})` : m) : alternativo;
}

// ---- Altitud: API-Coverages del IGN (Sistema Cartográfico Nacional), datos CC BY 4.0 ----
// Península y Baleares: MDT de 25 m (EPSG:4258). Canarias: MDT de 500 m (EPSG:4326); allí la zona 7 da
// sk = 0,2 kN/m² hasta 1.800 m (tabla E.2), así que la precisión de la altitud apenas influye.
// El recorte se pide con subset=Lat(a:b),Long(c:d) (el servidor no admite bbox: devuelve error 500).
// La respuesta (CoverageJSON) trae celdas null; se promedian las que tienen valor.
// Comprobado el 27-10-2026: Jaca 819 m, Madrid (Sol) 649 m, Palma 20 m, La Laguna 549 m.
const IGN = "https://api-coverages.idee.es/collections";
const MDT25 = "EL.ElevationGridCoverage_4258_25_PB", MDT500 = "EL.ElevationGridCoverage_4326_500";

async function pedirMDT(col, lat, lon, d) {
  const url = `${IGN}/${col}/coverage?f=json&subset=Lat(${lat - d}:${lat + d}),Long(${lon - d}:${lon + d})`;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`IGN ${r.status}`);
    const rango = Object.values((await r.json()).ranges || {})[0];
    const v = (rango?.values || []).filter((x) => typeof x === "number" && x > -100 && x < 4000);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  } finally { clearTimeout(t); }
}

export async function altitudIGN(lat, lon) {
  if (lat < 30) {                                             // Canarias: solo MDT de 500 m
    const h = await pedirMDT(MDT500, lat, lon, 0.003) ?? await pedirMDT(MDT500, lat, lon, 0.008);
    if (h == null) throw new Error("Sin datos de altitud");
    return h;
  }
  // Península y Baleares: MDT de 25 m (ventana de ~2 celdas; si sale vacía, más amplia) y, si falla, el de 500 m
  let h = null;
  try { h = await pedirMDT(MDT25, lat, lon, 0.0003) ?? await pedirMDT(MDT25, lat, lon, 0.001); } catch { /* sigue */ }
  if (h == null) h = await pedirMDT(MDT500, lat, lon, 0.003);
  if (h == null) throw new Error("Sin datos de altitud");
  return h;
}

// ---- Mapa ----
const COLORES = { 1: "#7fb3d5", 2: "#acbfa4", 3: "#c9a96e", 4: "#d9c27a", 5: "#b39ddb", 6: "#e0927a", 7: "#80cbc4" };
const PIN = L.divIcon({
  className: "pin", iconSize: [28, 40], iconAnchor: [14, 40],
  html: `<svg viewBox="0 0 28 40" width="28" height="40" aria-hidden="true"><path d="M14 1C7 1 1 6.6 1 13.7 1 23 14 39 14 39s13-16 13-25.3C27 6.6 21 1 14 1z" fill="#e2e8ce" stroke="#0f1512" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#0f1512"/></svg>`,
});

/** @returns { ponerChincheta(lat, lon, zoom?), verZonas(bool) } */
export function crearMapa(el, geoZonas, alClic) {
  const mapa = L.map(el, { zoomControl: true, scrollWheelZoom: false }).fitBounds([[36, -9.3], [43.8, 4.3]]);
  mapa.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, className: "teselas",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Búsqueda: Nominatim · Altitud: MDT © <a href="https://www.ign.es">IGN</a>',
  }).addTo(mapa);
  mapa.on("focus", () => mapa.scrollWheelZoom.enable());               // la rueda no secuestra el scroll de la página

  // Zonas de clima invernal (figura E.2 del CTE DB SE-AE, digitalizada)
  const capa = L.geoJSON(geoZonas, {
    interactive: false,
    style: (f) => ({ color: COLORES[f.properties.zona], weight: 1.5, opacity: 0.9, fillOpacity: 0.12 }),
  }).addTo(mapa);
  const rotulos = L.layerGroup(geoZonas.features.map((f) => {
    const mayor = f.geometry.coordinates.reduce((a, b) => (b[0].length > a[0].length ? b : a));
    const c = L.polygon(mayor[0].map(([lo, la]) => [la, lo])).getBounds().getCenter();
    return L.marker(c, { interactive: false, icon: L.divIcon({ className: "rotulo-zona", html: `Zona ${f.properties.zona}`, iconSize: [64, 18] }) });
  })).addTo(mapa);

  let marca = null;
  mapa.on("click", (e) => alClic(e.latlng.lat, e.latlng.lng));
  return {
    ponerChincheta(lat, lon, zoom) {
      if (!marca) marca = L.marker([lat, lon], { icon: PIN, keyboard: false }).addTo(mapa);
      else marca.setLatLng([lat, lon]);
      if (zoom) mapa.setView([lat, lon], zoom);
      else if (!mapa.getBounds().contains([lat, lon])) mapa.panTo([lat, lon]);
    },
    verZonas(si) { [capa, rotulos].forEach((l) => (si ? l.addTo(mapa) : l.remove())); },
  };
}
