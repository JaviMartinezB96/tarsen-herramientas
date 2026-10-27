// Cálculo de la carga de nieve (CTE DB SE-AE, apdo. 3.5 y Anejo E). Sin DOM: se puede probar con Node.
// Datos en data/nieve.json (N).

const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Capital de la tabla 3.8 cuyo nombre coincide con el municipio (o null). */
export function capitalDe(N, municipio) {
  if (!municipio) return null;
  const m = sinTildes(municipio);
  return N.tabla_3_8.capitales.find((c) => c.alias.some((a) => sinTildes(a) === m)) || null;
}

/** sk por la tabla E.2 (Anejo E): interpolación lineal entre filas de altitud (criterio TARSEN). */
export function skTablaE2(N, zona, alt) {
  const T = N.tabla_E2, alts = T.altitudes, vals = T.zonas[String(zona)];
  const h = Math.max(0, alt);                                       // por debajo de 0 m se toma la fila 0
  for (let i = 0; i < alts.length; i++) {
    if (h === alts[i]) return vals[i] == null ? { fuera: true } : { sk: vals[i], filas: [i] };
    if (h < alts[i]) {
      const a = vals[i - 1], b = vals[i];
      if (a == null || b == null) return { fuera: true };
      const t = (h - alts[i - 1]) / (alts[i] - alts[i - 1]);
      return { sk: a + t * (b - a), filas: [i - 1, i] };
    }
  }
  return { fuera: true };                                           // por encima de 2.200 m
}

/** μ del faldón (3.5.3.2). */
export function coefForma(N, angulo, impedimento) {
  const { angulo_mu1: a1, angulo_mu0: a0 } = N.forma;
  if (impedimento) return 1;
  if (angulo <= a1) return 1;
  if (angulo >= a0) return 0;
  return (a0 - angulo) / (a0 - a1);                                 // interpolación lineal 30°–60°
}

/** est: { alt, zona, capital, origen: "3.8"|"E2", angulo, impedimento: "si"|"no", viento, metodo: "general"|"simplificado" } */
export function calcular(N, est) {
  const r = { avisos: [] };
  // sk: tabla 3.8 (capitales, 3.5.2.1) o tabla E.2 (resto, 3.5.2.2)
  const e2 = est.zona && est.alt != null ? skTablaE2(N, est.zona, est.alt) : null;
  r.e2 = e2;
  if (est.capital && est.origen === "3.8") {
    r.sk = est.capital.sk; r.fuenteSk = "3.8";
  } else if (e2 && !e2.fuera) {
    r.sk = e2.sk; r.fuenteSk = "E2";
  } else {
    r.sk = null; r.fuenteSk = e2?.fuera ? "fuera" : "faltan";
  }

  r.mu = coefForma(N, est.angulo, est.impedimento === "si");                      // 3.5.3.2
  r.factor = N.viento.opciones.find((o) => o.id === est.viento).factor;          // 3.5.1.3
  r.simplificadoAplica = est.alt != null && est.alt < N.simplificado.altitud_max; // 3.5.1.1

  if (est.metodo === "simplificado" && r.simplificadoAplica) {
    r.qn = N.simplificado.qn; r.metodo = "simplificado";
  } else {
    r.metodo = "general";
    r.qn = r.sk == null ? null : r.mu * r.sk * r.factor;                         // qn = μ · sk (3.2), ±20 % (3.5.1.3)
  }

  // Carga lineal de hielo en vuelos por encima de 1.000 m: pn = k · μ² · sk (3.5.1.4, ec. 3.3)
  if (r.sk != null && est.alt > N.hielo.altitud_min) r.pn = N.hielo.k * r.mu ** 2 * r.sk;
  return r;
}
