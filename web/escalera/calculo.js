// Cálculo de la losa de escalera biapoyada (tramo recto, sin mesetas), por metro de ancho.
// Datos normativos en data/escalera.json. Unidades internas: kN, m, mm, N/mm².
// Losa de canto h medido perpendicular a su plano; los peldaños solo pesan, no colaboran.

const PI4 = Math.PI / 4;

/** Coeficientes de las acciones; null si siguen PENDIENTES en el JSON (CTE DB SE, tabla 4.1). */
export function coefAcciones(N) {
  const { gammaG, gammaQ } = N.acciones;
  return typeof gammaG === "number" && typeof gammaQ === "number" ? { gammaG, gammaQ } : null;
}

/** Cargas por m² en proyección horizontal. */
export function cargas(N, e, h) {
  const cos = Math.cos(Math.atan(e.contrahuella / e.huella));
  const uso = N.sobrecargas.lista.find((u) => u.id === e.uso);
  const inc = N.sobrecargas.incremento_escaleras;
  const peld = N.pesos.peldanos.find((p) => p.id === e.peldanos);
  const gLosa = N.pesos.losa.valor * (h / 1000) / cos;                 // Tabla C.1: 25 kN/m³ · h / cos α
  const gPeld = peld.valor * (e.contrahuella / 100) / 2;               // Tabla C.1: γ · c / 2 (prisma triangular)
  const g = gLosa + gPeld + e.solado;
  const q = uso.qk + (inc.categorias.includes(uso.cat) ? inc.valor : 0); // Tabla 3.1 + apdo. 3.1.1.3
  return { cos, gLosa, gPeld, g, q, qk: uso.qk, inc: q - uso.qk, peld };
}

/** As (mm²/m) para un momento Md (kN·m/m): bloque rectangular λ = 0,8, η = 1 (A19, 3.1.7(3), fck ≤ 50). */
function flexion(Md, d, fcd, fyd) {
  const mu = (Md * 1e6) / (1000 * d * d * fcd);
  if (1 - 2 * mu < 0) return { mu, As: Infinity };
  const w = 1 - Math.sqrt(1 - 2 * mu);                                 // equilibrio del bloque rectangular
  return { mu, As: (w * 1000 * d * fcd) / fyd };
}

/** Mayor separación (múltiplo de sPaso) que da As ≥ Anec con barras Ø, menor que los límites de 9.3.1.1(3). */
function separacion(A, Anec, diam, h) {
  const lim = Math.min(A.sMaxAbs, A.sMaxSobreH * h);                   // A19 9.3.1.1(3): s < 300 mm y s < 3h
  const sLim = Math.ceil(lim / A.sPaso) * A.sPaso - A.sPaso;           // estrictamente menor
  const s = Math.min(Math.floor((PI4 * diam * diam * 1000) / Anec / A.sPaso) * A.sPaso, sLim);
  return s >= A.sMin ? { diam, s, As: (PI4 * diam * diam * 1000) / s } : null;
}

/** Comprobaciones de un canto h y un Ø principal. */
function comprobar(N, e, c, h, diam, gam) {
  const H = N.hormigon, A = N.armado, fck = e.fck;
  const fcd = (H.alphaCC * fck) / H.gammaC;                            // A19 (3.15)
  const fyd = e.fyk / N.acero.gammaS;                                  // tabla A19.2.1
  const d = h - e.rec - diam / 2;
  const qd = gam.gammaG * c.g + gam.gammaQ * c.q;                      // CTE DB SE, tabla 4.1 (1,35 y 1,50)
  const Md = (qd * e.L ** 2) / 8;                                      // biapoyada, proyección horizontal
  const Vd = (qd * e.L) / 2;                                           // reacción en apoyo, sin reducir por cos α
  const { mu, As: Asreq } = flexion(Md, d, fcd, fyd);
  const fctm = 0.3 * fck ** (2 / 3);                                   // tabla A19.3.1 (fck ≤ 50)
  const fctmfl = Math.max((1.6 - h / 1000) * fctm, fctm);              // A19 (3.23)
  const Asmin = ((1000 * h * h) / 6 / (A.zSobreH * h)) * (fctmfl / fyd); // A19 (9.1): W/z · fctm,fl/fyd, z = 0,8h
  const Asnec = Math.max(Asreq, Asmin);
  const arm = Number.isFinite(Asnec) ? separacion(A, Asnec, diam, h) : null;
  if (!arm) return null;

  // Esbeltez: A19 (7.16.a/b) con ρ' = 0, K de tabla A19.7.4 y factor (7.17) con As,prov = As,req (conservador)
  const E = N.esbeltez, rho = Asreq / (1000 * d), rho0 = 1e-3 * Math.sqrt(fck), sf = Math.sqrt(fck);
  const base = rho <= rho0
    ? 11 + 1.5 * sf * (rho0 / rho) + 3.2 * sf * (rho0 / rho - 1) ** 1.5   // (7.16.a)
    : 11 + 1.5 * sf * (rho0 / rho);                                     // (7.16.b), ρ' = 0
  const ldLim = E.K * base * (E.sigmaRef / e.fyk);                      // (7.17)
  const lInc = (e.L / c.cos) * 1000;                                    // luz inclinada (criterio TARSEN)
  const ld = lInc / d;

  // Cortante sin armadura transversal: A19 (6.2.a), (6.2.b), (6.3); ρl con la mitad de la armadura (9.3.1.2(1))
  const C = N.cortante, k = Math.min(1 + Math.sqrt(200 / d), C.kMax);
  const rhoL = Math.min((A.fraccionAlApoyo * arm.As) / (1000 * d), C.rhoMax);
  const vRdc = Math.max((C.CRdc / H.gammaC) * k * (100 * rhoL * fck) ** (1 / 3), C.vmin * k ** 1.5 * sf);
  const VRdc = (vRdc * 1000 * d) / 1000;                               // kN/m
  const nu = 0.6 * (1 - fck / 250);                                    // (6.6)
  const Vmax = (0.5 * 1000 * d * nu * fcd) / 1000;                     // (6.5)

  const AsMax = A.asMaxSobreAc * 1000 * h;                             // A19 9.2.1.1(3)
  const ok = { esbeltez: ld <= ldLim, cortante: Vd <= VRdc && Vd <= Vmax, cuantia: arm.As >= Asnec && arm.As <= AsMax };
  return { h, d, diam, fcd, fyd, qd, Md, Vd, mu, Asreq, Asmin, Asnec, arm, rho, rho0, ldLim, ld, lInc, k, rhoL, VRdc, Vmax, nu, fctm, fctmfl, ok,
    cumple: ok.esbeltez && ok.cortante && ok.cuantia };
}

/** Busca el menor canto que cumple todo y, para él, el armado con menos acero. */
export function calcular(N, e) {
  const gam = coefAcciones(N);
  if (!gam) return { pendiente: true };
  const K = N.canto;
  let ultimo = null;
  for (let h = K.min; h <= K.max; h += K.paso) {
    const c = cargas(N, e, h);
    const ops = N.armado.diamPrincipal.map((diam) => comprobar(N, e, c, h, diam, gam)).filter(Boolean);
    ultimo = ops.at(-1) ? { ...ops.at(-1), c } : ultimo;
    const buenos = ops.filter((o) => o.cumple).sort((a, b) => a.arm.As - b.arm.As);
    if (buenos.length) return { ...buenos[0], c, gam, ...complementos(N, buenos[0]) };
  }
  return { fallo: true, ultimo, gam };
}

/** Nº de barras de separación s en una longitud lMm, descontando el recubrimiento en los extremos (criterio TARSEN). */
export const nBarras = (lMm, s, rec) => Math.ceil((lMm - 2 * rec) / s) + 1;

/** Reparto inferior (9.3.1.1(2)) y parrilla superior en toda la losa (criterio TARSEN). */
function complementos(N, r) {
  const A = N.armado;
  const elegir = (Anec) => A.diamReparto.map((diam) => separacion(A, Anec, diam, r.h)).filter(Boolean).sort((a, b) => a.As - b.As)[0];
  const repNec = A.reparto * r.arm.As;                                 // A19 9.3.1.1(2): ≥ 20 % de la principal
  const MdSup = A.superiorApoyo * r.Md;                                // A19 9.3.1.2(2): 15 % del momento de vano en apoyo extremo
  const supReq = flexion(MdSup, r.d, r.fcd, r.fyd).As;
  const supNec = Math.max(supReq, r.Asmin);                            // As,min también arriba: nota de 9.2.1.2(1) (criterio TARSEN)
  const superior = { Md: MdSup, req: supReq, nec: supNec, ...elegir(supNec) };  // en toda la longitud (criterio TARSEN, 27-10-2026)
  const repSupNec = A.reparto * superior.As;                           // transversal superior: 20 % de la superior (criterio TARSEN)
  return { reparto: { nec: repNec, ...elegir(repNec) }, superior, repartoSup: { nec: repSupNec, ...elegir(repSupNec) } };
}
