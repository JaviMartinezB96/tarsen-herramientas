// Croquis SVG del perfil longitudinal: losa inclinada, peldaños, apoyos y armado (a escala real).
// Longitudinales como líneas; transversales como puntos (barras cortadas), por dentro de las longitudinales.
import { fmt } from "../shared/ui.js";
import { nBarras } from "./calculo.js";

export function croquis(e, r) {
  const W = 640, M = 40, Lpx = W - 2 * M;
  const esc = Lpx / e.L;                                       // px por metro
  const tan = e.contrahuella / e.huella, cos = Math.cos(Math.atan(tan));
  const sube = e.L * tan * esc, Hs = sube + 170;
  const x0 = M, y0 = Hs - 70, x1 = M + Lpx, y1 = y0 - sube;    // cara inferior de la losa en los apoyos
  const t = (r.h / 1000 / cos) * esc;                          // espesor vertical de la losa
  const v = (mm) => (mm / 1000 / cos) * esc;                   // distancia perpendicular → vertical en px
  const offI = v(e.rec + r.diam / 2), offS = t - v(e.rec + r.superior.diam / 2);
  const y = (x, base) => base - (x - x0) * tan;                // recta inclinada

  // Peldaños sobre la cara superior de la losa
  const n = Math.max(1, Math.round((e.L * 100) / e.huella)), hu = Lpx / n, ch = sube / n;
  let p = `M${x0},${y0 - t}`;
  for (let i = 0; i < n; i++) p += ` V${y0 - t - (i + 1) * ch} H${x0 + (i + 1) * hu}`;

  const linea = (d) => `<line x1="${x0 + 4}" y1="${y(x0 + 4, y0 - d)}" x2="${x1 - 4}" y2="${y(x1 - 4, y0 - d)}"/>`;
  const puntos = (a, d) => {                                   // barras transversales cada s, a lo largo de la losa
    const k = nBarras(r.lInc, a.s, e.rec), dx = (Lpx - 8) / Math.max(k - 1, 1);
    return Array.from({ length: k }, (_, i) => { const x = x0 + 4 + i * dx; return `<circle cx="${x}" cy="${y(x, y0 - d)}" r="2.2"/>`; }).join("");
  };
  const apoyo = (x, yy) => `<path d="M${x},${yy} l-10,16 h20 Z"/>`;
  const sep = Math.max(v(5), 4);                               // transversal por dentro de la longitudinal

  return `<svg viewBox="0 0 ${W} ${Hs}" role="img" aria-label="Croquis del tramo de escalera con su armado" class="croquis">
    <style>.croquis{width:100%;height:auto;font:500 19px var(--sans)}</style>
    <path d="${p} Z" fill="${e.peldanos === "hormigon" ? "var(--bg-3)" : "none"}" stroke="var(--ink-3)" stroke-dasharray="${e.peldanos === "hormigon" ? "0" : "4 3"}"/>
    <path d="M${x0},${y0} L${x1},${y1} L${x1},${y1 - t} L${x0},${y0 - t} Z" fill="var(--bg-2)" stroke="var(--pale)" stroke-width="1.5"/>
    <g stroke="var(--sage)" stroke-width="2.5" stroke-linecap="round">${linea(offI)}</g>
    <g stroke="var(--ink-2)" stroke-width="2" stroke-linecap="round">${linea(offS)}</g>
    <g fill="var(--sage)">${puntos(r.reparto, offI + sep)}</g>
    <g fill="var(--ink-2)">${puntos(r.repartoSup, offS - sep)}</g>
    <g fill="var(--ink-3)">${apoyo(x0, y0)}${apoyo(x1, y1)}</g>
    <g fill="var(--ink-2)">
      <text x="${x0 + 30}" y="${y0 + 26}">h = ${fmt(r.h / 10)} cm</text>
      <text x="${(x0 + x1) / 2}" y="${y0 + 52}" text-anchor="middle">L = ${fmt(e.L, 2)} m (horizontal)</text>
    </g>
  </svg>`;
}
