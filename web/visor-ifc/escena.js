// Visor IFC TARSEN — escena 3D: cámara, navegación, modelos, selección y vistas.
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "./vendor/bvh/index.module.js";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

export const PALETA = ["#c9c3b6", "#e07a5f", "#5fa8d3", "#9bc995", "#e0b44c", "#a98bd4"];
const COLOR_SEL = 0xffcf5c;

export class Escena {
  constructor(lienzo) {
    this.lienzo = lienzo;
    this.r = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
    this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.r.localClippingEnabled = true;
    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color("#141c17");
    this.cam = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
    this.cam.position.set(20, 15, 20);
    this.escena.add(new THREE.HemisphereLight(0xffffff, 0x444438, 1.6));
    const sol = new THREE.DirectionalLight(0xffffff, 1.4);
    sol.position.set(0.5, 1, 0.8);
    this.cam.add(sol); this.escena.add(this.cam);
    this.ctl = new OrbitControls(this.cam, lienzo);
    // Izquierdo: orbitar. Central: desplazar (con Mayús, orbitar: OrbitControls gira en PAN si hay Mayús/Ctrl). Derecho: desplazar.
    this.ctl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
    this.ctl.zoomToCursor = true;
    lienzo.addEventListener("mousedown", (ev) => { if (ev.button === 1) ev.preventDefault(); }); // sin autodesplazamiento del navegador
    this.ctl.enableDamping = true; this.ctl.dampingFactor = 0.15; this.ctl.screenSpacePanning = true;
    this.ctl.addEventListener("change", () => this.pintar());
    this.corteActivo = { value: 0 }; // 1 si hay cortes o caja: las caras interiores se pintan como sección maciza
    this.planos = [];      // planos de recorte activos (cortes + caja), compartidos por todos los materiales
    this.modelos = new Map();
    this.sel = null;       // { id, eid, mallas: [] }
    this.selMat = new THREE.MeshBasicMaterial({ color: COLOR_SEL, side: THREE.DoubleSide, depthTest: true,
      polygonOffset: true, polygonOffsetFactor: -20, polygonOffsetUnits: -20, clippingPlanes: this.planos });
    this.ray = new THREE.Raycaster();
    new ResizeObserver(() => this.ajustarTamano()).observe(lienzo);
    this.ajustarTamano();
    this.bucle();
  }

  ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = this.lienzo;
    if (!w || !h) return;
    this.r.setSize(w, h, false);
    this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    this.pintar();
  }

  pintar() { this.sucio = true; }
  bucle() {
    requestAnimationFrame(() => this.bucle());
    if (this.ctl.update() || this.sucio) { this.sucio = false; this.r.render(this.escena, this.cam); }
  }

  // ---------- Modelos ----------

  /** Crea las mallas de un modelo a partir de los datos del motor. d = { opaco, transp } */
  anadirModelo(id, d, color) {
    const grupo = new THREE.Group();
    const m = { id, grupo, color, porModelo: false, transparente: false, mallas: [], tramos: new Map() };
    for (const [clave, c] of [["opaco", d.opaco], ["transp", d.transp]]) {
      if (!c.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(c.pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(c.nor, 3));
      g.setAttribute("color", new THREE.BufferAttribute(c.col, 4, true));
      g.setIndex(new THREE.BufferAttribute(c.idx, 1));
      g.computeBoundingBox(); g.computeBoundingSphere();
      const transp = clave === "transp";
      const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, clippingPlanes: this.planos,
        transparent: transp, opacity: 1, depthWrite: !transp,
        polygonOffset: true, polygonOffsetFactor: -this.modelos.size, polygonOffsetUnits: -this.modelos.size }); // el último modelo cargado gana en caras coincidentes
      this.macizo(mat);
      const malla = new THREE.Mesh(g, mat);
      malla.userData = { id, transp, ini: c.ini, num: c.num, eids: c.eids, triIni: Uint32Array.from(c.ini, (x) => x / 3) };
      // Tramos de índices por elemento, para resaltar la selección
      for (let i = 0; i < c.eids.length; i++) {
        const e = c.eids[i];
        if (!m.tramos.has(e)) m.tramos.set(e, []);
        m.tramos.get(e).push([malla, c.ini[i], c.num[i]]);
      }
      grupo.add(malla); m.mallas.push(malla);
    }
    // Caja de cada elemento (unión de sus geometrías), para la caja «núcleo»
    const porEl = new Map();
    for (const c of [d.opaco, d.transp]) for (let i = 0; i < c.eids.length; i++) {
      const k = c.cajas, j = i * 6, b = porEl.get(c.eids[i]);
      if (!b) porEl.set(c.eids[i], [k[j], k[j + 1], k[j + 2], k[j + 3], k[j + 4], k[j + 5]]);
      else for (let q = 0; q < 3; q++) { b[q] = Math.min(b[q], k[j + q]); b[q + 3] = Math.max(b[q + 3], k[j + q + 3]); }
    }
    m.cajasEl = Float32Array.from([...porEl.values()].flat());
    if (d.aristas?.length) { // contornos: aristas vivas calculadas en el lector
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(d.aristas, 3));
      m.lineas = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1b211d, transparent: true, opacity: 0.7, clippingPlanes: this.planos }));
      m.lineas.raycast = () => {};
      grupo.add(m.lineas);
    }
    this.escena.add(grupo);
    this.modelos.set(id, m);
    this.aplicarAspecto(m);
    // Árbol de búsqueda (BVH) para que la selección sea instantánea; "indirect" no reordena los índices.
    setTimeout(() => m.mallas.forEach((x) => x.geometry.computeBoundsTree({ indirect: true })), 50);
    this.pintar();
    return m;
  }

  /** Sección maciza: con un corte activo, lo que se ve por dentro de un sólido cerrado son sus caras traseras;
   *  se pintan lisas (sin luz) y un poco más oscuras que el elemento, como el relleno de una sección. */
  macizo(mat) {
    mat.onBeforeCompile = (s) => {
      s.uniforms.uCorte = this.corteActivo;
      s.fragmentShader = "uniform float uCorte;\n" + s.fragmentShader.replace("#include <dithering_fragment>",
        "#include <dithering_fragment>\nif (uCorte > 0.5 && !gl_FrontFacing) gl_FragColor = vec4(diffuseColor.rgb * 0.62, diffuseColor.a);");
    };
    mat.customProgramCacheKey = () => "macizo";
  }

  quitarModelo(id) {
    const m = this.modelos.get(id);
    if (!m) return;
    if (this.sel?.id === id) this.seleccionar(null);
    m.mallas.forEach((x) => { x.geometry.disposeBoundsTree?.(); x.geometry.dispose(); x.material.dispose(); });
    if (m.lineas) { m.lineas.geometry.dispose(); m.lineas.material.dispose(); }
    this.escena.remove(m.grupo); this.modelos.delete(id); this.pintar();
  }

  /** Colores del IFC o color único por modelo; transparencia para superponer. */
  aplicarAspecto(m) {
    for (const x of m.mallas) {
      const mat = x.material;
      mat.vertexColors = !m.porModelo;
      mat.color.set(m.porModelo ? m.color : 0xffffff);
      // Vidrios (cubo "transp"): con colores del IFC su alfa va en el color de vértice; con color por modelo, 50 %.
      const op = m.transparente ? 0.3 : x.userData.transp && m.porModelo ? 0.5 : 1;
      mat.opacity = op;
      mat.transparent = x.userData.transp || op < 1;
      mat.depthWrite = !mat.transparent;
      mat.needsUpdate = true;
    }
    if (m.lineas) m.lineas.material.opacity = m.transparente ? 0.25 : 0.7;
    this.pintar();
  }

  verModelo(id, visible) { const m = this.modelos.get(id); if (m) { m.grupo.visible = visible; if (!visible && this.sel?.id === id) this.seleccionar(null); this.pintar(); } }

  // ---------- Caja envolvente y vistas ----------

  /** Caja de los modelos visibles. Con nucleo = true se descartan los elementos sueltos muy alejados del resto
   *  (p. ej. marcadores de origen o de georreferencia), para encuadrar y centrar cortes en el edificio. */
  caja(nucleo = true) {
    const b = new THREE.Box3(), cajas = [];
    for (const m of this.modelos.values()) {
      if (!m.grupo.visible) continue;
      for (const x of m.mallas) b.union(x.geometry.boundingBox);
      cajas.push(m.cajasEl);
    }
    if (!nucleo || b.isEmpty()) return b;
    const cx = [], cy = [], cz = [];
    for (const k of cajas) for (let i = 0; i < k.length; i += 6) { cx.push((k[i] + k[i + 3]) / 2); cy.push((k[i + 1] + k[i + 4]) / 2); cz.push((k[i + 2] + k[i + 5]) / 2); }
    const med = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
    const mx = med(cx), my = med(cy), mz = med(cz);
    const d = cx.map((_, i) => Math.hypot(cx[i] - mx, cy[i] - my, cz[i] - mz));
    const lim = 3 * d.slice().sort((p, q) => p - q)[Math.floor(d.length * 0.75)] + 1; // 3 × percentil 75 + 1 m (criterio del visor)
    const n = new THREE.Box3();
    let j = 0;
    for (const k of cajas) for (let i = 0; i < k.length; i += 6, j++) {
      if (d[j] <= lim) n.union(new THREE.Box3(new THREE.Vector3(k[i], k[i + 1], k[i + 2]), new THREE.Vector3(k[i + 3], k[i + 4], k[i + 5])));
    }
    return n.isEmpty() ? b : n;
  }

  cajaSeleccion() {
    if (!this.sel) return null;
    const b = new THREE.Box3();
    const v = new THREE.Vector3();
    for (const x of this.sel.mallas) { // solo los vértices del elemento (el atributo de posición es el de todo el modelo)
      const pos = x.geometry.getAttribute("position"), ix = x.geometry.index.array;
      for (let i = 0; i < ix.length; i++) b.expandByPoint(v.fromBufferAttribute(pos, ix[i]));
    }
    return b;
  }

  /** Encuadra una caja desde la dirección dada (por defecto, la actual). */
  encuadrar(b = this.caja(), dir = null) {
    if (b.isEmpty()) return;
    const c = b.getCenter(new THREE.Vector3()), r = b.getBoundingSphere(new THREE.Sphere()).radius || 1;
    const d = dir ? dir.clone().normalize() : this.cam.position.clone().sub(this.ctl.target).normalize();
    const mv = THREE.MathUtils.degToRad(this.cam.fov / 2), mh = Math.atan(Math.tan(mv) * this.cam.aspect); // en pantallas estrechas manda el ángulo horizontal
    const dist = r / Math.sin(Math.min(mv, mh)) * 1.05;
    this.ctl.target.copy(c);
    this.cam.position.copy(c).addScaledVector(d, dist);
    this.cam.near = Math.max(dist / 1000, 0.01); this.cam.far = dist * 20; this.cam.updateProjectionMatrix();
    this.ctl.update(); this.pintar();
  }

  /** Vistas rápidas. Ejes del IFC: web-ifc convierte (x, y, z) del IFC en (x, z, −y), así que +Y del IFC es −Z aquí.
   *  Alzado frontal: mirando hacia +Y del IFC (cámara en −Y); posterior, al revés; izquierdo: desde −X; derecho: desde +X. */
  vista(tipo, b = this.caja()) {
    const d = {
      planta: [0, 1, 0.0001], frontal: [0, 0, 1], posterior: [0, 0, -1], izquierdo: [-1, 0, 0], derecho: [1, 0, 0], "3d": [1, 0.8, 1],
    }[tipo];
    this.encuadrar(b, new THREE.Vector3(...d));
  }

  // ---------- Selección ----------

  /** Rayo desde un punto de pantalla; devuelve el primer impacto visible y no recortado. */
  tocar(x, y) {
    const rc = this.lienzo.getBoundingClientRect();
    const p = new THREE.Vector2(((x - rc.left) / rc.width) * 2 - 1, -((y - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(p, this.cam);
    const mallas = [...this.modelos.values()].filter((m) => m.grupo.visible).flatMap((m) => m.mallas);
    for (const h of this.ray.intersectObjects(mallas, false)) {
      if (this.planos.some((pl) => pl.distanceToPoint(h.point) < -1e-4)) continue; // parte recortada
      const u = h.object.userData;
      const eid = u.eids[busca(u.triIni, h.faceIndex)];
      const n = h.face.normal.clone().transformDirection(h.object.matrixWorld);
      return { id: u.id, eid, punto: h.point, normal: n };
    }
    return null;
  }

  seleccionar(t) {
    if (this.sel) { this.sel.mallas.forEach((x) => { x.parent.remove(x); x.geometry.dispose(); }); this.sel = null; }
    if (t) {
      const m = this.modelos.get(t.id), mallas = [];
      for (const [malla, ini, num] of m.tramos.get(t.eid) || []) {
        const g = new THREE.BufferGeometry();
        for (const k of ["position", "normal"]) g.setAttribute(k, malla.geometry.getAttribute(k));
        g.setIndex(new THREE.BufferAttribute(malla.geometry.index.array.slice(ini, ini + num), 1));
        const s = new THREE.Mesh(g, this.selMat); s.renderOrder = 2; s.raycast = () => {};
        m.grupo.add(s); mallas.push(s);
      }
      this.sel = { id: t.id, eid: t.eid, mallas };
    }
    this.pintar();
  }

  /** Doble clic: centra la órbita en el punto tocado. */
  orbitarEn(punto) {
    const d = punto.clone().sub(this.ctl.target);
    this.ctl.target.add(d); this.cam.position.add(d); this.ctl.update(); this.pintar();
  }
}

/** Índice del último elemento de a (creciente) que es <= v. */
function busca(a, v) {
  let lo = 0, hi = a.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m] <= v) lo = m; else hi = m - 1; }
  return lo;
}
