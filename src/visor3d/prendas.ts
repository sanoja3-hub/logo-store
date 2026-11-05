// Prendas 3D construidas por código (sin modelos externos): torso, mangas, cuellos y detalles.
// Las medidas están en metros aproximados de una talla M. La prenda mira hacia +Z.

import * as THREE from 'three';
import type { Forma3D } from '../core/modelo';

export interface PrendaConstruida {
  grupo: THREE.Group;
  /** Malla principal donde se proyecta el logo (torso o copa de la gorra). */
  cuerpo: THREE.Mesh;
  /** Manga izquierda del usuario (a la derecha de quien mira), si existe. */
  manga: THREE.Mesh | null;
  /** Material de la tela, para cambiar el color sin reconstruir. */
  tela: THREE.MeshPhysicalMaterial;
}

const N = 72; // puntos por anillo

/** Superficie a partir de anillos de puntos (todos con la misma cantidad). */
function superficie(anillos: THREE.Vector3[][]): THREE.BufferGeometry {
  const filas = anillos.length;
  const cols = anillos[0].length;
  const pos = new Float32Array(filas * cols * 3);
  const uv = new Float32Array(filas * cols * 2);
  // Coordenadas UV proporcionales a la longitud real, para que la textura de la tela no se estire.
  let largoV = 0;
  const vAcum: number[] = [0];
  for (let i = 1; i < filas; i++) {
    largoV += anillos[i][0].distanceTo(anillos[i - 1][0]);
    vAcum.push(largoV);
  }
  for (let i = 0; i < filas; i++) {
    let largoU = 0;
    for (let j = 0; j < cols; j++) {
      const p = anillos[i][j];
      if (j > 0) largoU += p.distanceTo(anillos[i][j - 1]);
      const k = i * cols + j;
      pos.set([p.x, p.y, p.z], k * 3);
      uv.set([largoU * 6, vAcum[i] * 6], k * 2);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < filas - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Punto de una superelipse (más cuadrada que una elipse, como un torso real). */
function superelipse(a: number, bDel: number, bTras: number, th: number, n = 2.5): [number, number] {
  const c = Math.cos(th);
  const s = Math.sin(th);
  const x = a * Math.sign(c) * Math.abs(c) ** (2 / n);
  const z = (s >= 0 ? bDel : bTras) * Math.sign(s) * Math.abs(s) ** (2 / n);
  return [x, z];
}

const suave = (t: number) => t * t * (3 - 2 * t);
/** Interpola una curva definida por puntos de control [t, valor]. */
function curva(ctrl: [number, number][], t: number): number {
  if (t <= ctrl[0][0]) return ctrl[0][1];
  for (let i = 1; i < ctrl.length; i++) {
    if (t <= ctrl[i][0]) {
      const [t0, v0] = ctrl[i - 1];
      const [t1, v1] = ctrl[i];
      return v0 + (v1 - v0) * suave((t - t0) / (t1 - t0));
    }
  }
  return ctrl[ctrl.length - 1][1];
}

interface OpcionesTorso {
  alto: number;
  ancho: number;
  fondo: number;
  cuelloA: number;
  cuelloB: number;
  caidaHombro: number;
  /** Perfil del ancho a lo largo de la altura (t de 0 = ruedo a 1 = sisa). */
  perfil: [number, number][];
}

interface Torso {
  geo: THREE.BufferGeometry;
  /** Anillo del ruedo y del cuello, para poner bordes y cuellos. */
  ruedo: THREE.Vector3[];
  cuello: THREE.Vector3[];
  ySisa: number;
}

function torso(o: OpcionesTorso): Torso {
  const anillos: THREE.Vector3[][] = [];
  const tSisa = 0.84;
  const ySisa = o.alto * tSisa;
  const pasos = 48;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    const anillo: THREE.Vector3[] = [];
    let a: number, bD: number, bT: number, y: number, n: number;
    if (t <= tSisa) {
      const f = curva(o.perfil, t / tSisa);
      a = o.ancho * f;
      bD = o.fondo * f * 1.06;
      bT = o.fondo * f * 0.94;
      y = t * o.alto;
      n = 2.6;
    } else {
      // Hombros: del ancho de la sisa al cuello, subiendo un poco (caída del hombro).
      const s = (t - tSisa) / (1 - tSisa);
      const ease = 1 - (1 - s) ** 2.2;
      a = THREE.MathUtils.lerp(o.ancho * curva(o.perfil, 1), o.cuelloA, ease);
      bD = THREE.MathUtils.lerp(o.fondo * 1.06 * curva(o.perfil, 1), o.cuelloB * 1.1, s ** 0.8);
      bT = THREE.MathUtils.lerp(o.fondo * 0.94 * curva(o.perfil, 1), o.cuelloB * 0.9, s ** 0.8);
      y = ySisa + o.caidaHombro * Math.sin((s * Math.PI) / 2) + (o.alto - ySisa - o.caidaHombro) * s;
      n = THREE.MathUtils.lerp(2.6, 2, s);
    }
    for (let j = 0; j <= N; j++) {
      const th = (j / N) * Math.PI * 2 - Math.PI / 2; // costura en la espalda
      const [x, z] = superelipse(a, bD, bT, th, n);
      // El cuello se baja un poco por delante, como en las prendas reales.
      const bajaCuello = t > 0.97 && Math.sin(th) > 0 ? -0.025 * Math.sin(th) ** 2 * ((t - 0.97) / 0.03) : 0;
      anillo.push(new THREE.Vector3(x, y + bajaCuello, z));
    }
    anillos.push(anillo);
  }
  return { geo: superficie(anillos), ruedo: anillos[0], cuello: anillos[anillos.length - 1], ySisa };
}

interface Manga {
  geo: THREE.BufferGeometry;
  puno: THREE.Vector3[];
}

function manga(inicio: THREE.Vector3, dir: THREE.Vector3, largo: number, rIni: number, rFin: number, entrada = 0): Manga {
  const d = dir.clone().normalize();
  const e1 = new THREE.Vector3(-d.y, d.x, 0).normalize();
  const e2 = new THREE.Vector3(0, 0, 1);
  const anillos: THREE.Vector3[][] = [];
  const pasos = 24;
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos;
    // Con `entrada`, el primer tramo (escondido dentro del torso) es más angosto para no asomarse por el hombro.
    const r = entrada > 0 ? curva([[0, rIni * 0.55], [entrada, rIni], [1, rFin]], t) : THREE.MathUtils.lerp(rIni, rFin, suave(t));
    const c = inicio.clone().addScaledVector(d, largo * t);
    const anillo: THREE.Vector3[] = [];
    for (let j = 0; j <= N; j++) {
      const th = (j / N) * Math.PI * 2;
      anillo.push(
        c
          .clone()
          .addScaledVector(e1, Math.cos(th) * r * 0.92)
          .addScaledVector(e2, Math.sin(th) * r * 1.05),
      );
    }
    anillos.push(anillo);
  }
  return { geo: superficie(anillos), puno: anillos[anillos.length - 1] };
}

/** Un cordón a lo largo de un anillo (ruedos, puños, ribetes): da grosor visual a los bordes. */
function borde(puntos: THREE.Vector3[], radio: number, material: THREE.Material, cerrado = true): THREE.Mesh {
  const curvaPts = cerrado ? puntos.slice(0, -1) : puntos;
  const c = new THREE.CatmullRomCurve3(curvaPts, cerrado);
  const m = new THREE.Mesh(new THREE.TubeGeometry(c, Math.max(64, curvaPts.length * 2), radio, 8, cerrado), material);
  m.castShadow = true;
  return m;
}

/** Cuello que nace del anillo del cuello siguiendo un perfil (dr hacia afuera, dy hacia arriba). */
function cuelloPerfilado(cuello: THREE.Vector3[], perfil: [number, number][], aberturaFrente: number): THREE.BufferGeometry {
  const centro = cuello.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(cuello.length);
  // Puntos del cuello saltando la abertura del frente (+Z).
  const usados = cuello.filter((p) => {
    const ang = Math.atan2(p.x - centro.x, p.z - centro.z); // 0 = frente
    return Math.abs(ang) >= aberturaFrente;
  });
  // Ordenar desde un lado de la abertura alrededor de la espalda hasta el otro lado.
  usados.sort((p, q) => {
    const ap = Math.atan2(p.x - centro.x, p.z - centro.z);
    const aq = Math.atan2(q.x - centro.x, q.z - centro.z);
    const np = ap < 0 ? ap + Math.PI * 2 : ap;
    const nq = aq < 0 ? aq + Math.PI * 2 : aq;
    return np - nq;
  });
  const anillos = perfil.map(([dr, dy]) =>
    usados.map((p) => {
      const radial = new THREE.Vector3(p.x - centro.x, 0, p.z - centro.z).normalize();
      return p.clone().addScaledVector(radial, dr).add(new THREE.Vector3(0, dy, 0));
    }),
  );
  return superficie(anillos);
}

/** Proyecta un rayo contra una malla y devuelve el punto y la normal de la superficie. */
export function tocar(
  malla: THREE.Mesh,
  origen: THREE.Vector3,
  dir: THREE.Vector3,
): { punto: THREE.Vector3; normal: THREE.Vector3 } | null {
  malla.updateWorldMatrix(true, false);
  // Un corrimiento mínimo evita que el rayo caiga justo sobre una arista (la costura de la malla).
  const ray = new THREE.Raycaster(origen.clone().add(new THREE.Vector3(0.00137, 0.00071, 0.00093)), dir.clone().normalize());
  const hit = ray.intersectObject(malla, false)[0];
  if (!hit || !hit.face) return null;
  const normal = hit.face.normal.clone().transformDirection(malla.matrixWorld);
  if (normal.dot(dir) > 0) normal.negate();
  return { punto: hit.point.clone(), normal };
}

/** Línea que sigue el frente del torso (para cierres y botoneras). */
function lineaFrontal(cuerpo: THREE.Mesh, yDesde: number, yHasta: number, x = 0): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 24; i++) {
    const y = THREE.MathUtils.lerp(yDesde, yHasta, i / 24);
    const h = tocar(cuerpo, new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
    if (h) pts.push(h.punto.addScaledVector(h.normal, 0.002));
  }
  return pts;
}

function botones(cuerpo: THREE.Mesh, ys: number[], material: THREE.Material, x = 0, r = 0.0075): THREE.Object3D[] {
  const geo = new THREE.CylinderGeometry(r, r, 0.004, 20);
  geo.rotateX(Math.PI / 2);
  return ys
    .map((y) => {
      const h = tocar(cuerpo, new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
      if (!h) return null;
      const b: THREE.Object3D = new THREE.Mesh(geo, material);
      b.position.copy(h.punto.addScaledVector(h.normal, 0.006));
      b.lookAt(h.punto.clone().add(h.normal));
      return b;
    })
    .filter((b): b is THREE.Object3D => b !== null);
}

let texturaTela: THREE.Texture | null = null;

/** Mapa de normales de tejido (sarga fina) generado en un lienzo. */
function normalTela(): THREE.Texture {
  if (texturaTela) return texturaTela;
  const t = 256;
  const alto = new Float32Array(t * t);
  for (let y = 0; y < t; y++)
    for (let x = 0; x < t; x++) {
      const sarga = Math.sin(((x + y) / t) * Math.PI * 2 * 48) * 0.5;
      const trama = Math.sin((x / t) * Math.PI * 2 * 96) * 0.25 + Math.sin((y / t) * Math.PI * 2 * 96) * 0.25;
      alto[y * t + x] = sarga + trama + (Math.random() - 0.5) * 0.35;
    }
  const c = document.createElement('canvas');
  c.width = c.height = t;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(t, t);
  for (let y = 0; y < t; y++)
    for (let x = 0; x < t; x++) {
      const h = (xx: number, yy: number) => alto[((yy + t) % t) * t + ((xx + t) % t)];
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const v = new THREE.Vector3(-dx, -dy, 2).normalize();
      const k = (y * t + x) * 4;
      img.data[k] = (v.x * 0.5 + 0.5) * 255;
      img.data[k + 1] = (v.y * 0.5 + 0.5) * 255;
      img.data[k + 2] = (v.z * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  texturaTela = new THREE.CanvasTexture(c);
  texturaTela.wrapS = texturaTela.wrapT = THREE.RepeatWrapping;
  texturaTela.repeat.set(4, 4);
  return texturaTela;
}

export function materialTela(hex: string): THREE.MeshPhysicalMaterial {
  const color = new THREE.Color(hex);
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.88,
    metalness: 0,
    sheen: 0.35,
    sheenRoughness: 0.8,
    sheenColor: color.clone().lerp(new THREE.Color('#ffffff'), 0.15),
    normalMap: normalTela(),
    normalScale: new THREE.Vector2(0.28, 0.28),
    side: THREE.DoubleSide,
  });
}

/** Color de detalles (botones, cierres) que contrasta con la tela. */
function colorDetalle(hex: string): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  return hsl.l > 0.55 ? '#2a2d33' : '#d9dadc';
}

function malla(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function superior(forma: Forma3D, tela: THREE.MeshPhysicalMaterial, hex: string): PrendaConstruida {
  const grupo = new THREE.Group();
  const abrigo = forma === 'chaqueta' || forma === 'chaleco';
  const k = abrigo ? 1.07 : 1;
  const t = torso({
    alto: abrigo ? 0.7 : 0.68,
    ancho: 0.24 * k,
    fondo: 0.125 * k,
    cuelloA: abrigo ? 0.085 : 0.078,
    cuelloB: abrigo ? 0.08 : 0.072,
    caidaHombro: 0.07,
    perfil:
      forma === 'camisa'
        ? [[0, 0.97], [0.45, 0.93], [0.8, 1.0], [1, 1.0]]
        : abrigo
          ? [[0, 0.98], [0.5, 0.97], [0.8, 1.02], [1, 1.0]]
          : [[0, 1.0], [0.45, 0.95], [0.8, 1.02], [1, 1.0]],
  });
  const cuerpo = malla(t.geo, tela);
  grupo.add(cuerpo);

  const detalle = new THREE.MeshStandardMaterial({ color: colorDetalle(hex), roughness: 0.4, metalness: 0.3 });
  const ribete = tela;
  grupo.add(borde(t.ruedo, abrigo ? 0.008 : 0.004, abrigo ? ribete : tela));

  let mangaIzq: THREE.Mesh | null = null;
  if (forma !== 'chaleco') {
    const larga = forma === 'camisa' || forma === 'chaqueta';
    const ang = THREE.MathUtils.degToRad(larga ? 15 : 36);
    for (const lado of [1, -1]) {
      // La cara superior de la manga arranca justo en la esquina del hombro, sin dejar escalón.
      const rIni = larga ? 0.088 * k : 0.092;
      const esquina = new THREE.Vector3(lado * 0.236 * k, t.ySisa + 0.004, 0);
      const haciaArriba = new THREE.Vector3(lado * Math.cos(ang), Math.sin(ang), 0);
      const hombro = esquina.addScaledVector(haciaArriba, -rIni * 0.92);
      const dir = new THREE.Vector3(lado * Math.sin(ang), -Math.cos(ang), 0);
      const inicio = hombro.clone().addScaledVector(dir, -0.055);
      const m = larga
        ? manga(inicio, dir, 0.6, rIni, 0.05 * k, 0.1)
        : manga(inicio, dir, 0.245, rIni, 0.078, 0.22);
      const mm = malla(m.geo, tela);
      grupo.add(mm);
      if (lado === 1) mangaIzq = mm;
      if (larga) {
        // Puño
        const dirN = dir.clone().normalize();
        const fin = inicio.clone().addScaledVector(dirN, 0.6);
        const p = manga(fin.clone().addScaledVector(dirN, -0.06), dirN, 0.065, 0.054 * k, 0.054 * k);
        grupo.add(malla(p.geo, abrigo ? ribete : tela));
        grupo.add(borde(p.puno, 0.004, tela));
      } else {
        grupo.add(borde(m.puno, 0.0045, tela));
      }
    }
  } else {
    // Sisas del chaleco: ribete sobre la superficie alrededor de la abertura del brazo.
    for (const lado of [1, -1]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const h = tocar(
          cuerpo,
          new THREE.Vector3(lado * 1, t.ySisa - 0.02 + Math.sin(a) * 0.12, Math.cos(a) * 0.075),
          new THREE.Vector3(-lado, 0, 0),
        );
        if (h) pts.push(h.punto.addScaledVector(h.normal, 0.003));
      }
      if (pts.length > 10) grupo.add(borde([...pts, pts[0]], 0.007, detalle));
    }
  }

  // Cuellos y frentes
  if (forma === 'franela') {
    grupo.add(borde(t.cuello, 0.009, tela));
  } else if (forma === 'chemise') {
    grupo.add(malla(cuelloPerfilado(t.cuello, [[0, 0], [0.004, 0.03], [0.014, 0.043], [0.032, 0.03], [0.05, 0.002]], 0.22), tela));
    const tapeta = lineaFrontal(cuerpo, t.ySisa - 0.05, 0.665);
    if (tapeta.length > 2) grupo.add(borde(tapeta, 0.012, tela, false));
    for (const b of botones(cuerpo, [0.62, 0.585], detalle)) grupo.add(b);
  } else if (forma === 'camisa') {
    grupo.add(
      malla(cuelloPerfilado(t.cuello, [[0, 0], [0.003, 0.028], [0.012, 0.042], [0.03, 0.03], [0.06, -0.012]], 0.12), tela),
    );
    const tapeta = lineaFrontal(cuerpo, 0.01, 0.665);
    if (tapeta.length > 2) grupo.add(borde(tapeta, 0.005, tela, false));
    const nacar = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color('#888888'), 0.35), roughness: 0.35 });
    for (const b of botones(cuerpo, [0.62, 0.52, 0.42, 0.32, 0.22, 0.12], nacar, 0, 0.0095)) grupo.add(b);
    // Bolsillo al pecho (lado izquierdo de quien la viste).
    const h = tocar(cuerpo, new THREE.Vector3(-0.11, 0.47, 1), new THREE.Vector3(0, 0, -1));
    if (h) {
      const bolsillo = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.11), tela);
      bolsillo.position.copy(h.punto.addScaledVector(h.normal, 0.003));
      bolsillo.lookAt(h.punto.clone().add(h.normal));
      grupo.add(bolsillo);
      const pts = [
        new THREE.Vector3(-0.05, 0.055, 0),
        new THREE.Vector3(-0.05, -0.055, 0),
        new THREE.Vector3(0.05, -0.055, 0),
        new THREE.Vector3(0.05, 0.055, 0),
      ];
      bolsillo.updateMatrix();
      grupo.add(borde(pts.map((p) => p.applyMatrix4(bolsillo.matrix)), 0.0025, tela, false));
    }
  } else {
    // Chaqueta y chaleco: cuello alto y cierre frontal.
    grupo.add(malla(cuelloPerfilado(t.cuello, [[0, 0], [0.006, 0.04], [0.008, 0.07], [0.004, 0.08]], 0.1), ribete));
    const cierre = lineaFrontal(cuerpo, 0.005, 0.69);
    if (cierre.length > 2) {
      grupo.add(borde(cierre, 0.006, detalle, false));
      const tirador = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.035, 0.005), detalle);
      tirador.position.copy(cierre[cierre.length - 2]).add(new THREE.Vector3(0, -0.02, 0.008));
      grupo.add(tirador);
    }
    // Bolsillos laterales
    for (const lado of [1, -1]) {
      const linea = lineaFrontal(cuerpo, 0.12, 0.26, lado * 0.15).map((p, i, a) =>
        p.clone().add(new THREE.Vector3(lado * 0.03 * (i / a.length), 0, 0)),
      );
      if (linea.length > 2) grupo.add(borde(linea, 0.004, detalle, false));
    }
  }

  return { grupo, cuerpo, manga: mangaIzq, tela };
}

function pantalon(tela: THREE.MeshPhysicalMaterial, hex: string): PrendaConstruida {
  const grupo = new THREE.Group();
  const anillos: THREE.Vector3[][] = [];
  // Cadera: de la pretina (y=0) hacia abajo.
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const y = -t * 0.3;
    const a = curva([[0, 0.19], [0.55, 0.207], [1, 0.2]], t);
    const b = curva([[0, 0.115], [0.55, 0.128], [1, 0.112]], t);
    const anillo: THREE.Vector3[] = [];
    for (let j = 0; j <= N; j++) {
      const th = (j / N) * Math.PI * 2 - Math.PI / 2;
      const [x, z] = superelipse(a, b * 1.05, b * 1.1, th, 2.4);
      anillo.push(new THREE.Vector3(x, y, z));
    }
    anillos.push(anillo);
  }
  const cadera = malla(superficie(anillos), tela);
  grupo.add(cadera);
  grupo.add(malla(superficie([anillos[0].map((p) => p.clone().multiplyScalar(1.02)), anillos[0].map((p) => p.clone().multiplyScalar(1.02).add(new THREE.Vector3(0, 0.045, 0)))]), tela));
  grupo.add(borde(anillos[0].map((p) => p.clone().multiplyScalar(1.02).add(new THREE.Vector3(0, 0.045, 0))), 0.005, tela));

  let piernaIzq: THREE.Mesh | null = null;
  for (const lado of [1, -1]) {
    const inicio = new THREE.Vector3(lado * 0.098, -0.14, 0);
    const dir = new THREE.Vector3(lado * 0.04, -1, 0);
    const p = manga(inicio, dir, 0.89, 0.108, 0.08);
    const m = malla(p.geo, tela);
    grupo.add(m);
    grupo.add(borde(p.puno, 0.005, tela));
    if (lado === 1) piernaIzq = m;
  }
  const detalle = new THREE.MeshStandardMaterial({ color: colorDetalle(hex), roughness: 0.5, metalness: 0.2 });
  // Trabillas y bragueta
  for (const x of [-0.17, -0.08, 0.08, 0.17]) {
    const h = tocar(cadera, new THREE.Vector3(x, 0.01, 1), new THREE.Vector3(0, 0, -1));
    if (!h) continue;
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.006), tela);
    tr.position.copy(h.punto.addScaledVector(h.normal, 0.008).add(new THREE.Vector3(0, 0.012, 0)));
    tr.lookAt(tr.position.clone().add(h.normal));
    grupo.add(tr);
  }
  const bragueta = lineaFrontal(cadera, -0.2, -0.01, 0.012);
  if (bragueta.length > 2) grupo.add(borde(bragueta, 0.003, detalle, false));
  for (const b of botones(cadera, [0.022], detalle)) grupo.add(b);
  grupo.position.y = 0.95;
  return { grupo, cuerpo: cadera, manga: piernaIzq, tela };
}

function gorra(tela: THREE.MeshPhysicalMaterial, hex: string): PrendaConstruida {
  const grupo = new THREE.Group();
  const r = 0.1;
  const copaGeo = new THREE.SphereGeometry(r, 72, 36, 0, Math.PI * 2, 0, Math.PI * 0.5);
  copaGeo.scale(1, 0.78, 1.12);
  const copa = malla(copaGeo, tela);
  grupo.add(copa);

  // Visera: media luna al frente, curvada hacia abajo en los lados.
  const anillos: THREE.Vector3[][] = [];
  for (let i = 0; i <= 8; i++) {
    const u = i / 8;
    const fila: THREE.Vector3[] = [];
    for (let j = 0; j <= 48; j++) {
      const a = THREE.MathUtils.degToRad(-54 + (108 * j) / 48);
      const base = new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r * 1.12);
      const largo = 0.085 * Math.cos(a * 1.25) ** 0.7;
      const p = base.clone().add(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(largo * u));
      p.y = -0.018 * u - 0.025 * Math.abs(Math.sin(a)) ** 1.5 * u;
      fila.push(p);
    }
    anillos.push(fila);
  }
  const visera = malla(superficie(anillos), tela);
  grupo.add(visera);
  grupo.add(borde(anillos[anillos.length - 1], 0.003, tela, false));

  const detalle = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.8), roughness: 0.8 });
  const boton = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), tela);
  boton.position.y = r * 0.78;
  grupo.add(boton);
  // Costuras de los 6 paneles
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const fi = (i / 20) * (Math.PI / 2);
      pts.push(new THREE.Vector3(Math.sin(a) * Math.sin(fi) * r * 1.003, Math.cos(fi) * r * 0.78 * 1.003, Math.cos(a) * Math.sin(fi) * r * 1.12 * 1.003));
    }
    grupo.add(borde(pts, 0.0015, detalle, false));
  }
  grupo.scale.setScalar(2.2);
  grupo.position.y = 0.35;
  return { grupo, cuerpo: copa, manga: null, tela };
}

export function construirPrenda(forma: Forma3D, hex: string): PrendaConstruida {
  const tela = materialTela(hex);
  if (forma === 'pantalon') return pantalon(tela, hex);
  if (forma === 'gorra') return gorra(tela, hex);
  return superior(forma, tela, hex);
}
