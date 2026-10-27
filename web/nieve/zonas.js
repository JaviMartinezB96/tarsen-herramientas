// Zona de clima invernal de un punto (CTE DB SE-AE, Anejo E, figura E.2).
// Polígonos en data/zonas_e2.json, digitalizados de la figura con docs/scripts/nieve_zonas_e2.py.

/** Prepara los polígonos: { zona, anillos: [[[lon, lat], …], …] } */
export function prepararZonas(geo) {
  return geo.features.map((f) => ({
    zona: f.properties.zona,
    anillos: f.geometry.coordinates.flatMap((poly) => poly),
  }));
}

// Plano local en km alrededor del punto (suficiente a escala de unos pocos km).
const plano = (lat0, lon0) => {
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180), ky = 110.57;
  return ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky];
};

function dentro(anillo, lon, lat) {                       // rayo horizontal
  let d = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function distSeg([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function distanciaKm(Z, lat, lon) {                       // distancia del punto al borde del polígono de la zona
  const P = plano(lat, lon);
  let min = Infinity;
  for (const a of Z.anillos) {
    let prev = P(a[0]);
    for (let i = 1; i < a.length; i++) { const q = P(a[i]); min = Math.min(min, distSeg([0, 0], prev, q)); prev = q; }
  }
  return min;
}

/** @returns { zona, km?, cerca?: { zona, km }, regla?: "canarias"|"ceuta-melilla"|"cercana" } o { zona: null } */
export function zonaDe(zonas, N, lat, lon, municipio = "") {
  const C = N.criterios, E = N.zonas_especiales;
  if (lat < 30) return { zona: E.canarias, regla: "canarias" };                         // recuadro de Canarias
  if (/^(ceuta|melilla)$/i.test(municipio.trim()) || (lat < 36 && lat > 35 && lon > -5.6 && lon < -2.7))
    return { zona: E.ceuta_melilla, regla: "ceuta-melilla" };

  const dist = zonas.map((Z) => ({ zona: Z.zona, dentro: Z.anillos.some((a) => dentro(a, lon, lat)), km: distanciaKm(Z, lat, lon) }));
  let elegida = dist.find((d) => d.dentro), regla;
  if (!elegida) {                                                                      // costa o islote fuera del dibujo
    elegida = dist.reduce((a, b) => (b.km < a.km ? b : a));
    if (elegida.km > C.distancia_max_km) return { zona: null };
    regla = "cercana";
  }
  // Aviso si otra zona queda cerca (criterio TARSEN: grosor de las líneas de la figura)
  const otra = dist.filter((d) => d.zona !== elegida.zona).reduce((a, b) => (b.km < a.km ? b : a));
  const cerca = otra.km < C.aviso_limite_km ? { zona: otra.zona, km: otra.km } : null;
  return { zona: elegida.zona, regla, cerca, km: regla ? elegida.km : 0 };
}
