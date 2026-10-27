// Cuestionario común: una pregunta por pantalla.
// - Preguntas de opciones: al pulsar una respuesta pasa sola a la siguiente.
// - Preguntas numéricas (tipo "numero"): campo con unidad y botón «Siguiente» (o tecla Intro).
// Formato de cada pregunta (JSON de la herramienta):
//   { id, campo, pregunta, opciones:[{valor,texto,detalle,etiqueta,fija}] | dinamica, solo_si, nota, ref }
//   { id, campo, tipo:"numero", pregunta, min, max, paso, unidad, nota, ref }   (valor por defecto: estado inicial)

const cumple = (cond, est) => !cond || Object.entries(cond).every(([k, vals]) => vals.includes(est[k]));
const num = (v) => Number(String(v).replace(",", "."));

/** @param cont  contenedor
 *  @param C     objeto con C.asistente (lista de preguntas)
 *  @param o     { inicial, opcionesDe(nombre, est), alTerminar(est), prefijoRef = "Código Estructural, ", extra(p) → html } */
export function montarAsistente(cont, C, { inicial, opcionesDe = () => [], alTerminar, prefijoRef = "Código Estructural, ", extra = () => "" }) {
  let resp = {}, i = 0;
  const opciones = (p, est) => (p.dinamica ? opcionesDe(p.dinamica, est) : p.opciones);

  // Recorre las preguntas en orden: aplica cada respuesta y descarta las que no proceden.
  function calcular() {
    const est = { ...inicial }, lista = [];
    for (const p of C.asistente) {
      if (!cumple(p.solo_si, est)) continue;
      lista.push(p);
      if (p.tipo === "numero") { if (resp[p.id] != null) est[p.campo] = resp[p.id]; continue; }
      const op = opciones(p, est).find((o) => o.valor === resp[p.id]);
      if (op) { if (p.campo) est[p.campo] = op.valor; Object.assign(est, op.fija || {}); }
    }
    return { est, lista };
  }

  const campoNumero = (p, est) => `
    <form class="numero" data-numero="${p.id}" onsubmit="return false">
      <label class="campo"><span>${p.unidad}</span>
        <input type="number" inputmode="decimal" name="${p.id}" min="${p.min}" max="${p.max}" step="${p.paso}"
          value="${resp[p.id] ?? est[p.campo]}" required></label>
      <p class="nota alerta" data-error hidden>Introduce un valor entre ${String(p.min).replace(".", ",")} y ${String(p.max).replace(".", ",")}.</p>
      <div class="botonera"><button class="btn btn-primario" type="submit">Siguiente</button></div>
    </form>`;

  const campoOpciones = (p, est) => `
    <div class="opciones-radio" role="radiogroup">${opciones(p, est).map((o) => `
      <label class="radio"><input type="radio" name="${p.id}" value="${o.valor}" ${resp[p.id] === o.valor ? "checked" : ""}>
        <span><span class="radio-texto">${o.texto}${o.etiqueta ? ` <em class="etiqueta">${o.etiqueta}</em>` : ""}</span>
        ${o.detalle ? `<small>${o.detalle}</small>` : ""}</span></label>`).join("")}
    </div>`;

  function pintar() {
    const { est, lista } = calcular();
    const p = lista[i];
    cont.innerHTML = `
      <div class="progreso"><span style="width:${Math.round((i / lista.length) * 100)}%"></span></div>
      <p class="label">Pregunta ${i + 1} de ${lista.length}</p>
      <h2 class="pregunta">${p.pregunta}</h2>
      ${p.tipo === "numero" ? campoNumero(p, est) : campoOpciones(p, est)}
      ${p.nota ? `<p class="nota">${p.nota}</p>` : ""}
      ${extra(p)}
      ${p.ref ? `<p class="ref">${prefijoRef}${p.ref}</p>` : ""}
      ${i > 0 ? `<div class="botonera"><button class="btn" type="button" data-atras>Atrás</button></div>` : ""}`;
    cont.querySelector("input[type=number]")?.focus();
  }

  function siguiente() {
    const { est, lista } = calcular();
    if (i >= lista.length - 1) return alTerminar(est);
    i++;
    pintar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // «click» y no «change»: así también avanza al volver atrás y repetir la misma respuesta.
  cont.addEventListener("click", (e) => {
    if (e.target.closest("[data-atras]")) { i = Math.max(0, i - 1); return pintar(); }
    if (!e.target.matches('input[type="radio"]')) return;
    resp[e.target.name] = e.target.value;
    setTimeout(siguiente, 180);              // breve pausa para ver la opción marcada
  });

  cont.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-numero]");
    if (!f) return;
    const inp = f.elements[f.dataset.numero], v = num(inp.value);
    const ok = inp.value !== "" && v >= num(inp.min) && v <= num(inp.max);
    f.querySelector("[data-error]").hidden = ok;
    if (!ok) return;
    resp[f.dataset.numero] = v;
    siguiente();
  });

  return { reiniciar() { resp = {}; i = 0; pintar(); } };
}
