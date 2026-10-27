// Asistente de preguntas (una por paso) que asigna las clases de exposición.
// Preguntas y criterios en data/clases.json, transcritos de la tabla 27.1.a y art. 27.1 del Código Estructural.

/** Estado de clases a partir de las respuestas, recorriendo los pasos en orden. */
export function clasesDesdeRespuestas(pasos, resp) {
  const est = { tipo: "", corrosion: "", xf: "", xa: "", xm: "" };
  for (const p of activos(pasos, resp)) {
    const op = p.opciones.find((o) => o.valor === resp[p.id]);
    if (!op) continue;
    if (p.campo) est[p.campo] = op.valor;
    Object.assign(est, op.fija || {});
  }
  return est;
}

/** Pasos visibles según las respuestas anteriores (condición "solo_si"). */
function activos(pasos, resp) {
  const est = {}, lista = [];
  for (const p of pasos) {
    const ok = !p.solo_si || Object.entries(p.solo_si).every(([k, vals]) => vals.includes(est[k]));
    if (!ok) continue;
    lista.push(p);
    const op = p.opciones.find((o) => o.valor === resp[p.id]);
    if (op) { if (p.campo) est[p.campo] = op.valor; Object.assign(est, op.fija || {}); }
  }
  return lista;
}

const tabla = (t) => `<details class="nota"><summary>Ver tabla 27.1.b (umbrales de agresividad)</summary>
  <div style="overflow-x:auto"><table class="tabla"><thead><tr>${t.columnas.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>
  <tr><th colspan="4">Agua</th></tr>${t.agua.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
  <tr><th colspan="4">Suelo</th></tr>${t.suelo.map((f) => `<tr>${f.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}
  </tbody></table></div><p>${t.nota} <span class="ref">Código Estructural, tabla 27.1.b</span></p></details>`;

/** Monta el asistente en `cont`, una pregunta por pantalla.
 *  `alTerminar(estado)` recibe las clases al pulsar «Continuar» en la última pregunta;
 *  `alVolver()` se llama al pulsar «Atrás» en la primera. Devuelve { reiniciar }. */
export function montarAsistente(cont, C, { alTerminar, alVolver }) {
  let resp = {}, i = 0;
  function pintar() {
    const pasos = activos(C.asistente, resp);
    i = Math.min(i, pasos.length - 1);
    const p = pasos[i], ultimo = i === pasos.length - 1, respondido = p.id in resp;
    cont.innerHTML = `
      <p class="label">Pregunta ${i + 1} de ${pasos.length}</p>
      <h2 class="pregunta">${p.pregunta}</h2>
      <div class="opciones-radio" role="radiogroup">${p.opciones.map((o) => `
        <label class="radio"><input type="radio" name="${p.id}" value="${o.valor}" ${resp[p.id] === o.valor ? "checked" : ""}><span>${o.texto}</span></label>`).join("")}
      </div>
      ${p.nota ? `<p class="nota">${p.nota}</p>` : ""}
      ${p.tabla ? tabla(C[p.tabla]) : ""}
      <p class="ref">Código Estructural, ${p.ref}</p>
      <div class="botonera">
        <button class="btn" type="button" data-paso="-1">Atrás</button>
        <button class="btn btn-primario" type="button" data-paso="1" ${respondido ? "" : "disabled"}>${ultimo ? "Continuar" : "Siguiente"}</button>
      </div>`;
  }
  cont.addEventListener("change", (e) => {
    if (e.target.type !== "radio") return;
    resp[e.target.name] = e.target.value;
    pintar();
  });
  cont.addEventListener("click", (e) => {
    const d = Number(e.target.closest("[data-paso]")?.dataset.paso);
    if (!d) return;
    const total = activos(C.asistente, resp).length;
    if (d < 0 && i === 0) return alVolver();
    if (d > 0 && i === total - 1) return alTerminar(clasesDesdeRespuestas(C.asistente, resp));
    i += d;
    pintar();
  });
  return { reiniciar() { resp = {}; i = 0; pintar(); } };
}
