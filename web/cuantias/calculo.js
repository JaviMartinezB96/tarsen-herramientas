// Cuantías mínimas y máximas de armadura (Código Estructural, Anejo 19, cap. 9).
// Datos normativos en data/cuantias.json y shared/data/hormigon.json.
// Unidades internas: mm, mm², N/mm², N. Entradas: b, h, e en cm; NEd en kN. Salidas en mm² (o mm²/m).

const AREA = (d) => (Math.PI * d * d) / 4;

/** fctm (tabla A19.3.1, fck ≤ 50) y fctm,fl (3.23) para un canto h (mm). */
export function traccion(fck, h) {
  const fctm = 0.3 * fck ** (2 / 3);                                  // tabla A19.3.1: 0,30·fck^(2/3)
  const fctmfl = Math.max((1.6 - h / 1000) * fctm, fctm);             // A19 (3.23)
  return { fctm, fctmfl };
}

/** As,min a flexión de una sección rectangular b×h (mm): W/z · fctm,fl/fyd (9.1), W = b·h²/6, z = 0,8h. */
export function asMinFlexion(b, h, fck, fyd, zSobreH) {
  const t = traccion(fck, h);
  const W = (b * h * h) / 6, z = zSobreH * h;
  return { ...t, W, z, As: (W / z) * (t.fctmfl / fyd) };              // A19 9.2.1.1(1), (9.1)
}

/** @param N  datos (cuantias.json + hormigon/acero)  @param e estado de respuestas */
export function calcular(N, e) {
  const fyk = N.acero.tipos.find((a) => a.id === e.acero).fyk;
  const fyd = fyk / N.acero.gammaS;                                    // tabla A19.2.1 (γs = 1,15)
  const fck = Number(e.fck);
  const r = { elemento: e.elemento, fyk, fyd };

  if (e.elemento === "viga") {
    const V = N.viga, b = e.b * 10, h = e.h * 10, Ac = b * h;
    return { ...r, b, h, Ac, min: asMinFlexion(b, h, fck, fyd, V.zSobreH),
      asMax: V.asMax * Ac };                                           // A19 9.2.1.1(3): 0,04·Ac
  }

  if (e.elemento === "losa") {
    const L = N.losa, b = 1000, h = e.h * 10, Ac = b * h;
    const min = asMinFlexion(b, h, fck, fyd, N.viga.zSobreH);          // A19 9.3.1.1(1) → 9.2.1.1(1)
    return { ...r, b, h, Ac, min,
      asMax: N.viga.asMax * Ac,                                        // A19 9.3.1.1(1) → 9.2.1.1(3)
      reparto: L.reparto * min.As,                                     // A19 9.3.1.1(2): ≥ 20 % de la principal
      sMax: Math.min(L.sMax, L.sMaxSobreH * h) };                      // A19 9.3.1.1(3): s < 300 mm y < 3h
  }

  if (e.elemento === "pilar") {
    const P = N.pilar, b = Math.min(e.b, e.h) * 10, h = Math.max(e.b, e.h) * 10, Ac = b * h;
    const NEd = e.NEd * 1000;
    const fycd = Math.min(fyd, P.fycdMax);                             // fig. A19.9.11: fyc,d = fyd ≯ 400 N/mm²
    const porCara = (P.kCara * NEd) / fycd;                            // fig. A19.9.11: A's1,min = A's2,min = 0,05·NEd/fyc,d
    const simple = (P.kSimple * NEd) / fyd;                            // A19 (9.12): 0,10·NEd/fyd
    const barras = P.nBarrasMin * AREA(P.diamMin);                     // 9.5.2(1) y (4): 4 barras de esquina Ø12
    const asMin = e.solicitacion === "simple" ? simple : 2 * porCara;
    return { ...r, b, h, Ac, NEd, fycd, porCara, simple, asMin, barras,
      manda: barras > asMin ? "barras" : "axil",
      esMuro: h > P.relacionMax * b,                                   // 9.5.1(1): h ≤ 4b
      asMax: P.asMax * Ac, asMaxSolape: P.asMaxSolape * Ac };          // 9.5.2(3): 0,04·Ac y 0,08·Ac en solapes
  }

  // Muro, por metro de longitud
  const M = N.muro, t = e.e * 10, Ac = 1000 * t;
  const hEf = 1000 * Math.min(t, M.eEficazMax);                        // 9.6.3(1): espesor eficaz ≤ 50 cm (2 × 25 cm)
  const kH = e.reduccion === "si" ? M.hMinReducida : M.hMin[fyk];      // 9.6.3(1): 0,004 / 0,0032 / 0,002 ·Ac
  const horiz = kH * hEf;
  const base = { ...r, t, Ac, kH, hEf, horiz,
    sMaxV: Math.min(M.sMaxV, M.sMaxVSobreE * t),                       // 9.6.2(3): ≤ 400 mm y 3·espesor
    sMaxH: M.sMaxH,                                                    // 9.6.3(2): ≤ 400 mm
    vMax: M.vMax * Ac,                                                 // 9.6.2(1): 0,04·Ac
    cercos: M.cercosSi * Ac };                                         // 9.6.4(1): cercos si vertical total > 0,02·Ac
  if (e.trabajo === "flexion") {
    // 9.6.1(1): flexión fuera de su plano → reglas de losa (9.3.1.1 → 9.2.1.1), vertical como dirección principal
    return { ...base, flexion: asMinFlexion(1000, t, fck, fyd, N.viga.zSobreH) };
  }
  const vert = M.vMin * Ac;                                            // 9.6.2(1): 0,002·Ac
  const traccionada = e.trabajo === "flexocompresion" ? M.vTraccionada * vert : vert / 2; // 60 % / mitad (9.6.2(1) y (2))
  return { ...base, vert, traccionada, otra: vert - traccionada };
}
