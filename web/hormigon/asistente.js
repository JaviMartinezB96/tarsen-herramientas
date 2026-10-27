// Cuestionario de una pregunta por pantalla; al elegir una respuesta pasa solo a la siguiente.
// Preguntas en data/clases.json (tabla 27.1.a, art. 27.1 y art. 44); las opciones dinámicas las da la app.

const cumple = (cond, est) => !cond || Object.entries(cond).every(([k, vals]) => vals.includes(est[k]));

const tabla = (t) => `<details class="nota"><summary>Ver tabla 27.1.b (umbrales de agresividad)</summary>
  <div style="overflow-x:auto"><table class="tabla"><thead><tr>${t.columnas.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
  <tr><th colspan="4">Agua</th></tr>${t.agua.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
  <tr><th colspan="4">Suelo</th></tr>${t.suelo.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
  </tbody></table></div><p>${t.nota} <span class="ref">Código Estructural, tabla 27.1.b</span></p></details>`;

/** @param cont  contenedor
 *  @param C     data/clases.json
 *  @param o     { inicial: estado por defecto, opcionesDe(nombre, est), alTerminar(est) } */
export function montarAsistente(cont, C, { inicial, opcionesDe, alTerminar }) {
  let resp = {}, i = 0;
  const opciones = (p, est) => (p.dinamica ? opcionesDe(p.dinamica, est) : p.opciones);

  // Recorre las preguntas en orden: aplica cada respuesta y descarta las que no proceden.
  function calcular() {
    const est = { ...inicial }, lista = [];
    for (const p of C.asistente) {
      if (!cumple(p.solo_si, est)) continue;
      lista.push(p);
      const op = opciones(p, est).find((o) => o.valor === resp[p.id]);
      if (op) { if (p.campo) est[p.campo] = op.valor; Object.assign(est, op.fija || {}); }
    }
    return { est, lista };
  }

  function pintar() {
    const { est, lista } = calcular();
    const p = lista[i];
    cont.innerHTML = `
      <div class="progreso"><span style="width:${Math.round((i / lista.length) * 100)}%"></span></div>
      <p class="label">Pregunta ${i + 1} de ${lista.length}</p>
      <h2 class="pregunta">${p.pregunta}</h2>
      <div class="opciones-radio" role="radiogroup">${opciones(p, est).map((o) => `
        <label class="radio"><input type="radio" name="${p.id}" value="${o.valor}" ${resp[p.id] === o.valor ? "checked" : ""}>
          <span><span class="radio-texto">${o.texto}${o.etiqueta ? ` <em class="etiqueta">${o.etiqueta}</em>` : ""}</span>
          ${o.detalle ? `<small>${o.detalle}</small>` : ""}</span></label>`).join("")}
      </div>
      ${p.nota ? `<p class="nota">${p.nota}</p>` : ""}
      ${p.tabla ? tabla(C[p.tabla]) : ""}
      <p class="ref">Código Estructural, ${p.ref}</p>
      ${i > 0 ? `<div class="botonera"><button class="btn" type="button" data-atras>Atrás</button></div>` : ""}`;
  }

  // «click» y no «change»: así también avanza al volver atrás y repetir la misma respuesta.
  cont.addEventListener("click", (e) => {
    if (e.target.closest("[data-atras]")) { i = Math.max(0, i - 1); return pintar(); }
    if (!e.target.matches('input[type="radio"]')) return;
    resp[e.target.name] = e.target.value;
    setTimeout(() => {                       // breve pausa para ver la opción marcada
      const { est, lista } = calcular();
      if (i >= lista.length - 1) return alTerminar(est);
      i++;
      pintar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 180);
  });

  return { reiniciar() { resp = {}; i = 0; pintar(); } };
}
