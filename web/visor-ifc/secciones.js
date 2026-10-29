// Visor IFC TARSEN — cortes (planos) y caja de sección. Todos son planos de recorte de three.js
// compartidos por los materiales de todos los modelos (escena.planos).
import * as THREE from "three";

const COLOR = 0xe2e8ce;

export class Secciones {
  constructor(escena, alCambiar) {
    this.e = escena; this.alCambiar = alCambiar;
    this.cortes = []; this.n = 0;
    this.caja = null; // { min, max, planos[6], marco, asas[6] }
    // Rectángulo que muestra dónde está el corte mientras se mueve
    this.guia = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: COLOR, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    this.guia.add(new THREE.LineSegments(new THREE.EdgesGeometry(this.guia.geometry), new THREE.LineBasicMaterial({ color: COLOR })));
    this.guia.visible = false; this.guia.renderOrder = 5;
    escena.escena.add(this.guia);
    escena.ctl.addEventListener("change", () => this.escalarAsas());
    this.eventosAsas();
  }

  sincronizar() {
    const p = this.e.planos;
    p.length = 0;
    this.cortes.forEach((c) => p.push(c.plano));
    if (this.caja) p.push(...this.caja.planos);
    this.e.corteActivo.value = p.length ? 1 : 0;
    this.e.pintar(); this.alCambiar?.();
  }

  // ---------- Cortes ----------

  /** tipo: "horizontal" | "vertical" | "cara" (toque = resultado de escena.tocar). */
  nuevoCorte(tipo, toque) {
    const b = this.e.caja(); // núcleo: posición inicial del corte
    if (b.isEmpty()) return null;
    const c = b.getCenter(new THREE.Vector3());
    let eje, signo, u, nombre;
    if (tipo === "horizontal") { eje = new THREE.Vector3(0, 1, 0); signo = -1; u = c.y; nombre = "Horizontal"; }
    else if (tipo === "vertical") {
      // Plano frente a la cámara, ajustado al eje X o Z más próximo; se quita lo que queda delante.
      const d = this.e.ctl.target.clone().sub(this.e.cam.position); d.y = 0;
      eje = Math.abs(d.x) > Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x) || 1, 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z) || 1);
      signo = 1; u = eje.dot(c); nombre = "Vertical";
    } else {
      eje = toque.normal.clone().normalize();
      if (eje.dot(this.e.cam.position.clone().sub(toque.punto)) < 0) eje.negate(); // hacia la cámara
      signo = -1; u = eje.dot(toque.punto); nombre = "Por cara";
    }
    const [min, max] = rango(this.e.caja(false), eje); // la barra recorre todo el modelo
    const corte = { id: ++this.n, nombre: `${nombre} ${this.n}`, eje, signo, u, min, max, plano: new THREE.Plane() };
    this.actualizar(corte);
    this.cortes.push(corte); this.sincronizar(); this.mostrarGuia(corte);
    return corte;
  }

  actualizar(c) { c.plano.normal.copy(c.eje).multiplyScalar(c.signo); c.plano.constant = -c.signo * c.u; } // signo·(eje·p − u) ≥ 0 se ve
  mover(c, u) { c.u = u; this.actualizar(c); this.e.pintar(); this.mostrarGuia(c); }
  invertir(c) { c.signo *= -1; this.actualizar(c); this.sincronizar(); }
  quitar(c) { this.cortes = this.cortes.filter((x) => x !== c); this.guia.visible = false; this.sincronizar(); }

  mostrarGuia(c) {
    const b = this.e.caja(), r = b.getSize(new THREE.Vector3()).length() * 0.75;
    const ctr = b.getCenter(new THREE.Vector3());
    ctr.addScaledVector(c.eje, c.u - c.eje.dot(ctr)); // centro de la caja proyectado sobre el plano
    this.guia.position.copy(ctr); this.guia.scale.set(r, r, 1);
    this.guia.lookAt(ctr.clone().add(c.eje));
    this.guia.visible = true; this.e.pintar();
    clearTimeout(this.tGuia);
    this.tGuia = setTimeout(() => { this.guia.visible = false; this.e.pintar(); }, 1200);
  }

  // ---------- Caja de sección ----------

  activarCaja(b = this.e.caja()) {
    if (b.isEmpty()) return;
    if (!this.caja) {
      const marco = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: COLOR }));
      const matAsa = new THREE.MeshBasicMaterial({ color: COLOR, depthTest: false, transparent: true, opacity: 0.9 });
      const geoAsa = new THREE.SphereGeometry(1, 16, 12);
      const asas = [0, 1, 2, 3, 4, 5].map((i) => { const a = new THREE.Mesh(geoAsa, matAsa); a.renderOrder = 10; a.userData.i = i; return a; });
      const planos = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((n) => new THREE.Plane(new THREE.Vector3(...n), 0));
      this.caja = { min: new THREE.Vector3(), max: new THREE.Vector3(), planos, marco, asas };
      this.e.escena.add(marco, ...asas);
    }
    const pad = b.getSize(new THREE.Vector3()).multiplyScalar(0.01).addScalar(0.01);
    this.caja.min.copy(b.min).sub(pad); this.caja.max.copy(b.max).add(pad);
    this.colocarCaja(); this.sincronizar();
  }

  quitarCaja() {
    if (!this.caja) return;
    this.e.escena.remove(this.caja.marco, ...this.caja.asas);
    this.caja = null; this.sincronizar();
  }

  colocarCaja() {
    const { min, max, planos, marco, asas } = this.caja;
    const ej = ["x", "y", "z"];
    ej.forEach((k, i) => { planos[2 * i].constant = -min[k]; planos[2 * i + 1].constant = max[k]; }); // min ≤ p ≤ max
    marco.position.copy(min).add(max).multiplyScalar(0.5);
    marco.scale.copy(max).sub(min);
    asas.forEach((a, i) => { a.position.copy(marco.position); a.position[ej[i >> 1]] = i % 2 ? max[ej[i >> 1]] : min[ej[i >> 1]]; });
    this.escalarAsas(); this.e.pintar();
  }

  escalarAsas() {
    if (!this.caja) return;
    const k = Math.tan(THREE.MathUtils.degToRad(this.e.cam.fov / 2)) * 0.022; // ≈ tamaño fijo en pantalla
    for (const a of this.caja.asas) a.scale.setScalar(a.position.distanceTo(this.e.cam.position) * k);
  }

  /** Arrastre de las asas: se capturan antes que la órbita (fase de captura en el contenedor). */
  eventosAsas() {
    const zona = this.e.lienzo.parentElement, ray = new THREE.Raycaster();
    const rayo = (ev) => {
      const rc = this.e.lienzo.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((ev.clientX - rc.left) / rc.width) * 2 - 1, -((ev.clientY - rc.top) / rc.height) * 2 + 1), this.e.cam);
      return ray.ray;
    };
    const asaEn = (ev) => {
      if (!this.caja) return null;
      rayo(ev);
      return ray.intersectObjects(this.caja.asas, false)[0]?.object || null;
    };
    const sobreEje = (r, p0, u) => { // parámetro s del punto del eje (p0 + s·u) más cercano al rayo
      const w = p0.clone().sub(r.origin), b = u.dot(r.direction), den = 1 - b * b;
      return den < 1e-4 ? null : (b * r.direction.dot(w) - u.dot(w)) / den;
    };
    let arr = null;
    zona.addEventListener("pointerdown", (ev) => {
      const a = asaEn(ev);
      if (!a) return;
      const i = a.userData.i, k = ["x", "y", "z"][i >> 1], u = new THREE.Vector3(); u[k] = 1;
      const s0 = sobreEje(rayo(ev), a.position, u);
      if (s0 == null) return;
      arr = { i, k, u, p0: a.position.clone(), s0, v0: (i % 2 ? this.caja.max : this.caja.min)[k] };
      this.e.ctl.enabled = false; zona.setPointerCapture(ev.pointerId); ev.stopPropagation();
    }, true);
    zona.addEventListener("pointermove", (ev) => {
      if (!arr) { zona.style.cursor = asaEn(ev) ? "grab" : ""; return; }
      const s = sobreEje(rayo(ev), arr.p0, arr.u);
      if (s == null) return;
      const { min, max } = this.caja, v = arr.v0 + s - arr.s0, k = arr.k;
      if (arr.i % 2) max[k] = Math.max(v, min[k] + 0.05); else min[k] = Math.min(v, max[k] - 0.05);
      this.colocarCaja();
    }, true);
    const fin = () => { if (arr) { arr = null; this.e.ctl.enabled = true; this.alCambiar?.(); } };
    zona.addEventListener("pointerup", fin, true);
    zona.addEventListener("pointercancel", fin, true);
  }

  reiniciar() { this.cortes = []; this.guia.visible = false; if (this.caja) this.quitarCaja(); else this.sincronizar(); }
}

/** Proyección mínima y máxima de la caja b sobre el eje (con un 2 % de margen). */
function rango(b, eje) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 8; i++) {
    const v = eje.dot(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  const m = (hi - lo) * 0.02 + 0.01;
  return [lo - m, hi + m];
}
