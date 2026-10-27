// TARSEN Herramientas — piezas comunes: cabecera, aviso legal, CTA pequeño, pie y utilidades.
// Uso: <div data-ui="cabecera"></div> <div data-ui="aviso"></div> <div data-ui="cta"></div> <div data-ui="pie"></div>
//      import { iniciarPagina, fmt, cargarJSON } from "../shared/ui.js";

// URLs de la web de TARSEN (contacto confirmado por el propietario, 27-10-2026).
export const CONFIG = {
  contacto: "https://tarsen.es/#contacto",
  web: "https://tarsen.es/",
};

const LOGO_INV = new URL("./brand/TARSEN-COLOR-INV-Horizontal.svg", import.meta.url).href;

/** Número con coma decimal (es-ES). dec = nº de decimales fijos. */
export const fmt = (n, dec = 0) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString("es-ES", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export async function cargarJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se ha podido cargar ${url}`);
  return r.json();
}

const html = (s) => { const t = document.createElement("template"); t.innerHTML = s.trim(); return t.content; };

const PIEZAS = {
  cabecera: () => `
    <header class="cabecera"><div class="contenedor">
      <a class="logo" href="${CONFIG.web}" aria-label="TARSEN, ir a la web"><img src="${LOGO_INV}" alt="TARSEN"></a>
      <a class="btn" href="${CONFIG.contacto}">Contacto</a>
    </div></header>`,
  aviso: () => `
    <p class="aviso-legal">Herramienta de predimensionado y consulta. Los resultados son orientativos, citan la norma
    de la que salen y no sustituyen al proyecto de un técnico competente. Todo se calcula en tu navegador.</p>`,
  cta: () => `
    <div class="cta-mini">
      <p>¿Necesitas el cálculo completo de tu estructura?</p>
      <a class="btn btn-primario" href="${CONFIG.contacto}">Pide presupuesto a TARSEN</a>
    </div>`,
  pie: () => `
    <footer class="pie"><div class="contenedor">
      <a href="${CONFIG.web}">tarsen.es</a><span>© ${new Date().getFullYear()} TARSEN Estructuras</span>
    </div></footer>`,
};

/** Rellena los huecos data-ui de la página. */
export function iniciarPagina() {
  document.querySelectorAll("[data-ui]").forEach((el) => {
    const f = PIEZAS[el.dataset.ui];
    if (f) el.replaceWith(html(f()));
  });
}
