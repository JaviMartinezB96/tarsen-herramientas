// Croquis SVG del perfil longitudinal: losa inclinada, peldaños, apoyos y armado (a escala real).
import { fmt } from "../shared/ui.js";

export function croquis(e, r) {
  const W = 640, M = 40, Lpx = W - 2 * M;
  const esc = Lpx / e.L;                                       // px por metro
  const tan = e.contrahuella / e.huella, cos = Math.cos(Math.atan(tan));
  const sube = e.L * tan * esc, Hs = sube + 150;
  const x0 = M, y0 = Hs - 50, x1 = M + Lpx, y1 = y0 - sube;    // cara inferior de la losa en los apoyos
  const t = (r.h / 1000 / cos) * esc;                          // espesor vertical de la losa
  const off = ((e.rec + r.diam / 2) / 1000 / cos) * esc;       // eje de la armadura inferior
  const y = (x, base) => base - (x - x0) * tan;                // recta inclinada

  // Peldaños sobre la cara superior de la losa
  const n = Math.max(1, Math.round((e.L * 100) / e.huella)), hu = Lpx / n, ch = sube / n;
  let p = `M${x0},${y0 - t}`;
  for (let i = 0; i < n; i++) p += ` V${y0 - t - (i + 1) * ch} H${x0 + (i + 1) * hu}`;
  const peld = `${p} Z`;                                      // cierra por la cara superior de la losa

  const lSup = 0.2 * Lpx;                                      // 9.3.1.2(2): 0,2 L desde el apoyo
  const linea = (xa, xb, d) => `<line x1="${xa}" y1="${y(xa, y0 - d)}" x2="${xb}" y2="${y(xb, y0 - d)}"/>`;
  const apoyo = (x, yy) => `<path d="M${x},${yy} l-10,16 h20 Z"/>`;

  return `<svg viewBox="0 0 ${W} ${Hs}" role="img" aria-label="Croquis del tramo de escalera" class="croquis">
    <style>.croquis{width:100%;height:auto;font:500 19px var(--sans)}</style>
    <path d="${peld}" fill="${e.peldanos === "hormigon" ? "var(--bg-3)" : "none"}" stroke="var(--ink-3)" stroke-dasharray="${e.peldanos === "hormigon" ? "0" : "4 3"}"/>
    <path d="M${x0},${y0} L${x1},${y1} L${x1},${y1 - t} L${x0},${y0 - t} Z" fill="var(--bg-2)" stroke="var(--pale)" stroke-width="1.5"/>
    <g stroke="var(--sage)" stroke-width="2.5" stroke-linecap="round">${linea(x0 + 4, x1 - 4, off)}</g>
    <g stroke="var(--ink-2)" stroke-width="2" stroke-linecap="round">${linea(x0 + 4, x0 + lSup, t - off)}${linea(x1 - lSup, x1 - 4, t - off)}</g>
    <g fill="var(--ink-3)">${apoyo(x0, y0)}${apoyo(x1, y1)}</g>
    <g fill="var(--ink-2)">
      <text x="${(x0 + x1) / 2}" y="${Hs - 8}" text-anchor="middle">L = ${fmt(e.L, 2)} m (horizontal)</text>
      <text x="${x0 + Lpx * 0.55}" y="${y(x0 + Lpx * 0.55, y0) + 30}" fill="var(--sage)">Ø${r.diam} c/${r.arm.s / 10} cm</text>
      <text x="${x0 + 6}" y="${y0 - t - 0.2 * sube - 14}">Ø${r.superior.diam} c/${r.superior.s / 10}</text>
      <text x="${x1 - 6}" y="${y1 - t - 40}" text-anchor="end">Ø${r.superior.diam} c/${r.superior.s / 10}</text>
      <text x="${x0 + 30}" y="${y0 + 26}">h = ${fmt(r.h / 10)} cm</text>
    </g>
  </svg>`;
}
