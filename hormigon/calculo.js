// Lógica de cálculo (sin DOM). Datos en ./data/*.json. Referencias: Código Estructural, cap. 9.

/** Requisitos de dosificación para un conjunto de clases. Art. 43.2.1:
 *  "fijando para cada parámetro el criterio más exigente de entre los establecidos para cada clase". */
export function dosificacion(D, clases, tipo) {
  const col = (c) => D.clases.indexOf(c);
  const vals = (tabla) => clases.map((c) => D[tabla][tipo][col(c)]).filter((v) => v != null);
  const ac = vals("ac_max");          // Tabla 43.2.1.a (máx. a/c → manda el menor)
  const cem = vals("cemento_min");    // Tabla 43.2.1.a (mín. cemento → manda el mayor)
  const fck = vals("fck_min");        // Tabla 43.2.1.b (resistencia mínima → manda la mayor)
  const avisos = D.avisos.filter((a) => a.clases.some((c) => clases.includes(c)) && (!a.tipos || a.tipos.includes(tipo)));
  // Tabla 43.3.2: de las exigencias de impermeabilidad, solo se muestra la más estricta.
  const nivMax = Math.max(0, ...avisos.filter((a) => a.grupo === "impermeabilidad").map((a) => a.nivel));
  const unicos = new Map();
  avisos.filter((a) => a.grupo !== "impermeabilidad" || a.nivel === nivMax).forEach((a) => unicos.set(a.texto, a));
  return {
    ac: ac.length ? Math.min(...ac) : null,
    cemento: cem.length ? Math.max(...cem) : null,
    fck: fck.length ? Math.max(...fck) : null,
    avisos: [...unicos.values()],
  };
}

const banda = (fck) => (fck >= 40 ? "f40" : fck >= 25 ? "f25" : null); // Bandas de las tablas 44.2.1.1.a, 44.3
const iVida = (v) => (v === 100 ? 1 : 0);

/** Recubrimientos. Devuelve { partes:[{valor, texto, ref}], cmin, cnom, notas, bloqueo } */
export function recubrimiento(R, e) {
  // e = { corrosion, xf, xa, xm, tipo, cemento, fck, vida, margen, diam, arido, aridoDificil, terreno }
  const cem = R.cementos.lista.find((c) => c.id === e.cemento);
  const partes = [], notas = [];
  let bloqueo = null;
  const add = (valor, texto, ref) => {
    if (valor === "*") bloqueo ??= { texto: `${texto}: la norma considera el recubrimiento excesivo y recomienda un estudio específico.`, ref };
    else if (valor === "proyectista") bloqueo ??= { texto: `${texto}: el recubrimiento mínimo lo fija el autor del proyecto según la agresión química concreta.`, ref };
    else if (valor != null) partes.push({ valor, texto, ref });
  };
  const b = banda(e.fck);
  const necesitaBanda = /^(X0|XC)/.test(e.corrosion) || e.xf;
  if (necesitaBanda && !b) bloqueo = { texto: "Las tablas de recubrimiento solo cubren fck ≥ 25 N/mm².", ref: "Tablas 44.2.1.1.a y 44.3" };

  // Corrosión de armaduras — art. 44.2.1.1
  if (b && /^(X0|XC)/.test(e.corrosion)) {
    const fila = R.carbonatacion[e.corrosion];                       // Tabla 44.2.1.1.a
    const g = e.corrosion === "X0" ? "cualquiera" : cem.a;
    add(fila[g][b][iVida(e.vida)], `cmin,dur por ${e.corrosion}`, "Tabla 44.2.1.1.a");
  } else if (/^(XS|XD)/.test(e.corrosion)) {
    const T = R.cloruros;                                            // Tabla 44.2.1.1.b
    const g = cem[`b_${e.tipo}`];
    const k = T.columnas.indexOf(e.corrosion.startsWith("XD") ? "XD" : e.corrosion);
    add(T[e.tipo][g][String(e.vida)][k], `cmin,dur por ${e.corrosion}`, "Tabla 44.2.1.1.b");
  }
  // Hielo-deshielo — art. 44.3, tabla 44.3
  if (e.xf && b) {
    const t = ["XF1", "XF3"].includes(e.xf) ? "xf13" : "xf24";
    add(R.heladas[t][cem[t]][b][iVida(e.vida)], `cmin,dur por ${e.xf}`, "Tabla 44.3");
  }
  // Ataque químico — art. 44.4, tabla 44.4
  if (e.xa) {
    const fila = R.quimico[e.xa];
    add(typeof fila === "string" ? fila : fila[cem.xa1][iVida(e.vida)], `cmin,dur por ${e.xa}`, "Tabla 44.4");
  }
  // Adherencia y árido — art. 44.2.1.1 a)
  if (e.diam > 0) add(e.diam, "Diámetro de la barra", "Art. 44.2.1.1 a)");
  if (e.arido > 0) {
    const k = e.aridoDificil ? R.adherencia.k_arido_dificil : R.adherencia.k_arido;
    add(Math.round(k * e.arido * 10) / 10, `${String(k).replace(".", ",")} × tamaño máximo del árido`, "Art. 44.2.1.1 a)");
  }
  if (bloqueo) return { partes, bloqueo, notas };

  // [Inferencia] Cada criterio de los arts. 44.2 a 44.4 es una comprobación independiente: manda el mayor.
  let cmin = Math.max(0, ...partes.map((p) => p.valor));
  let gobierna = partes.find((p) => p.valor === cmin);
  // Erosión — art. 44.5, tabla 44.5: sobre-espesor sumado al resto de criterios
  const sobre = e.xm ? R.erosion[e.xm] : 0;
  if (sobre) { cmin += sobre; notas.push({ texto: `Incluye +${sobre} mm de sobre-espesor por ${e.xm}.`, ref: "Tabla 44.5" }); }
  // Hormigonado contra el terreno — art. 44.2.1.1
  if (e.terreno && cmin < R.terreno.cmin) {
    cmin = R.terreno.cmin;
    gobierna = { texto: "Hormigonado contra el terreno sin hormigón de limpieza", ref: "Art. 44.2.1.1" };
  }
  const dc = R.margen.lista.find((m) => m.id === e.margen).valor;   // Tabla 43.4.1
  const cnom = cmin + dc;                                            // Art. 43.4.1: cnom = cmin + Δcdev
  // Art. 44.2.1.1: la malla de reparto no rige en piezas hormigonadas contra el terreno.
  if (cnom > R.malla_reparto.umbral && !e.terreno)
    notas.push({ texto: "Recubrimiento superior a 50 mm: valora disponer una malla de reparto (Ø ≤ 12 mm, en mitad del recubrimiento).", ref: "Art. 44.2.1.1" });
  if (/^(XS|XD)/.test(e.corrosion))
    notas.push({ texto: "Con armaduras inoxidables, galvanizadas, inhibidores o protección catódica el proyecto puede reducir estos valores.", ref: "Art. 43.3.1.4 a 43.3.1.7" });
  return { partes, cmin, cnom, dc, gobierna, notas, bloqueo: null };
}
