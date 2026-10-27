// TARSEN Herramientas — piezas comunes: cabecera, aviso legal, CTA, imprimir, tema y utilidades.
// Uso: <div data-ui="cabecera"></div> … <div data-ui="aviso"></div> <div data-ui="cta"></div> <div data-ui="pie"></div>
//      import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";

// URLs de la web de TARSEN (contacto confirmado por el propietario, 27-10-2026).
export const CONFIG = {
  contacto: "https://tarsen.es/#contacto",
  web: "https://tarsen.es/",
  herramientas: "../",
};

const ruta = (f) => new URL(f, import.meta.url).href;
const LOGO = ruta("./brand/TARSEN-COLOR-Horizontal.svg");
const LOGO_INV = ruta("./brand/TARSEN-COLOR-INV-Horizontal.svg");

/** Número con coma decimal (es-ES). dec = nº de decimales fijos. */
export const fmt = (n, dec = 0) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export async function cargarJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se ha podido cargar ${url}`);
  return r.json();
}

// ---- Tema claro / sobre oscuro (preferencia guardada solo en este navegador) ----
function leerTema() { try { return localStorage.getItem("tarsen-tema"); } catch { return null; } }
function guardarTema(t) { try { localStorage.setItem("tarsen-tema", t); } catch { /* sin almacenamiento */ } }
function aplicarTema(t) { document.documentElement.dataset.theme = t === "dark" ? "dark" : "light"; }
aplicarTema(leerTema());

const html = (s) => { const t = document.createElement("template"); t.innerHTML = s.trim(); return t.content; };

const PIEZAS = {
  cabecera: () => `
    <header class="cabecera"><div class="contenedor">
      <a class="logo" href="${CONFIG.web}" aria-label="TARSEN, ir a la web">
        <img class="col" src="${LOGO}" alt="TARSEN"><img class="inv" src="${LOGO_INV}" alt="TARSEN">
      </a>
      <nav class="acciones">
        <a class="btn solo-ancho" href="${CONFIG.herramientas}">Herramientas</a>
        <button class="btn" type="button" data-accion="tema" aria-label="Cambiar entre tema claro y oscuro">Tema</button>
        <button class="btn btn-primario" type="button" data-accion="imprimir">Imprimir / PDF</button>
      </nav>
    </div></header>
    <div class="solo-impresion contenedor"><div class="cab-impresion">
      <img src="${LOGO}" alt="TARSEN"><span class="label">${document.title} · ${new Date().toLocaleDateString("es-ES")}</span>
    </div></div>`,
  aviso: () => `
    <p class="aviso-legal"><strong>Herramienta de predimensionado y consulta.</strong> Los resultados son orientativos,
    se basan en la normativa citada en cada uno y no sustituyen al proyecto ni al cálculo de un técnico competente.
    Todo se calcula en tu navegador: no se envía ni se guarda ningún dato.</p>`,
  cta: () => `
    <aside class="cta"><div class="contenedor">
      <h2>¿Necesitas el cálculo completo?</h2>
      <p>Cuéntanos tu proyecto. Con el básico nos basta para darte plazo y precio cerrado.</p>
      <a class="btn" href="${CONFIG.contacto}">Pide presupuesto a TARSEN</a>
    </div></aside>`,
  pie: () => `
    <footer class="pie"><div class="contenedor">© ${new Date().getFullYear()} TARSEN · Cálculo estructural</div></footer>`,
};

/** Rellena los huecos data-ui y conecta los botones comunes. */
export function iniciarPagina() {
  document.querySelectorAll("[data-ui]").forEach((el) => {
    const f = PIEZAS[el.dataset.ui];
    if (f) el.replaceWith(html(f()));
  });
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-accion]")?.dataset.accion;
    if (a === "imprimir") window.print();
    if (a === "tema") {
      const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      aplicarTema(t); guardarTema(t);
    }
  });
}
