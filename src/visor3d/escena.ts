// Escena 3D del showroom: estudio con luz suave, prenda girable y logo proyectado sobre la tela.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Forma3D, Ubicacion } from '../core/modelo';
import { construirPrenda, tocar, type PrendaConstruida } from './prendas';

export interface EstadoVisor {
  forma: Forma3D;
  colorHex: string;
  logo: string | null;
  ubicacion: Ubicacion;
  escalaLogo: number;
}

export type Vista = 'frente' | 'espalda' | 'lado';

export class Escena3D {
  private renderer: THREE.WebGLRenderer;
  private escena = new THREE.Scene();
  private camara: THREE.PerspectiveCamera;
  private controles: OrbitControls;
  private prenda: PrendaConstruida | null = null;
  private decal: THREE.Mesh | null = null;
  private texturaLogo: THREE.Texture | null = null;
  private logoActual: string | null = null;
  private estado: EstadoVisor | null = null;
  private observador: ResizeObserver;
  private cuadro = 0;
  private anguloDestino: number | null = null;
  private ultimaInteraccion = 0;
  private piso: THREE.Mesh;
  private centro = new THREE.Vector3(0, 0.4, 0);

  constructor(private contenedor: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    contenedor.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.escena.environmentIntensity = 0.35;

    this.camara = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    this.camara.position.set(0, 0.5, 2.6);

    const clave = new THREE.DirectionalLight('#ffffff', 2.2);
    clave.position.set(1.6, 2.6, 2.2);
    clave.castShadow = true;
    clave.shadow.mapSize.set(2048, 2048);
    clave.shadow.camera.left = clave.shadow.camera.bottom = -1.2;
    clave.shadow.camera.right = clave.shadow.camera.top = 1.2;
    clave.shadow.radius = 6;
    clave.shadow.bias = -0.0004;
    const relleno = new THREE.DirectionalLight('#dfe8ff', 0.8);
    relleno.position.set(-2, 1.2, 1.5);
    const contra = new THREE.DirectionalLight('#ffffff', 1.4);
    contra.position.set(-0.5, 2, -2.5);
    this.escena.add(clave, relleno, contra, new THREE.HemisphereLight('#ffffff', '#cbd2dc', 0.6));

    this.piso = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), new THREE.ShadowMaterial({ opacity: 0.16 }));
    this.piso.rotation.x = -Math.PI / 2;
    this.piso.receiveShadow = true;
    this.escena.add(this.piso);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.dampingFactor = 0.08;
    this.controles.enablePan = false;
    this.controles.minPolarAngle = THREE.MathUtils.degToRad(55);
    this.controles.maxPolarAngle = THREE.MathUtils.degToRad(100);
    this.controles.autoRotate = true;
    this.controles.autoRotateSpeed = 0.9;
    this.controles.addEventListener('start', () => {
      this.controles.autoRotate = false;
      this.anguloDestino = null;
      this.ultimaInteraccion = performance.now();
    });
    this.controles.addEventListener('end', () => (this.ultimaInteraccion = performance.now()));

    this.observador = new ResizeObserver(() => this.ajustarTamano());
    this.observador.observe(contenedor);
    this.ajustarTamano();
    this.animar();
  }

  private ajustarTamano() {
    const w = this.contenedor.clientWidth || 1;
    const h = this.contenedor.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
    this.encuadrar(false);
  }

  private animar = () => {
    this.cuadro = requestAnimationFrame(this.animar);
    if (!this.controles.autoRotate && this.anguloDestino === null && performance.now() - this.ultimaInteraccion > 6000) {
      this.controles.autoRotate = true;
    }
    if (this.anguloDestino !== null) {
      const actual = this.controles.getAzimuthalAngle();
      let delta = this.anguloDestino - actual;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      if (Math.abs(delta) < 0.002) this.anguloDestino = null;
      else this.girarAzimut(delta * 0.12);
    }
    this.controles.update();
    this.renderer.render(this.escena, this.camara);
  };

  private girarAzimut(delta: number) {
    const desplazamiento = this.camara.position.clone().sub(this.controles.target);
    desplazamiento.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta);
    this.camara.position.copy(this.controles.target).add(desplazamiento);
  }

  /** Coloca la cámara para que la prenda llene el cuadro. */
  private encuadrar(reiniciar: boolean) {
    if (!this.prenda) return;
    const caja = new THREE.Box3().setFromObject(this.prenda.grupo);
    const tam = caja.getSize(new THREE.Vector3());
    caja.getCenter(this.centro);
    const alto = Math.max(tam.y, tam.x / this.camara.aspect) * (this.camara.aspect > 1.3 ? 1.45 : 1.25);
    const dist = alto / 2 / Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2));
    this.controles.target.copy(this.centro);
    this.controles.minDistance = dist * 0.45;
    this.controles.maxDistance = dist * 1.6;
    if (reiniciar) {
      this.camara.position.set(this.centro.x, this.centro.y + alto * 0.08, this.centro.z + dist);
    } else {
      const dir = this.camara.position.clone().sub(this.controles.target).normalize();
      this.camara.position.copy(this.controles.target).addScaledVector(dir, dist);
    }
    this.piso.position.y = caja.min.y - 0.002;
  }

  actualizar(nuevo: EstadoVisor) {
    const previo = this.estado;
    this.estado = nuevo;
    if (!previo || previo.forma !== nuevo.forma || !this.prenda) {
      if (this.prenda) {
        this.escena.remove(this.prenda.grupo);
        liberar(this.prenda.grupo);
      }
      this.decal = null;
      this.prenda = construirPrenda(nuevo.forma, nuevo.colorHex);
      this.escena.add(this.prenda.grupo);
      this.encuadrar(true);
      this.anguloDestino = null;
    } else if (previo.colorHex !== nuevo.colorHex) {
      this.prenda.grupo.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
        if (m && m === this.prenda!.tela) {
          m.color.set(nuevo.colorHex);
          m.sheenColor.set(nuevo.colorHex).lerp(new THREE.Color('#ffffff'), 0.15);
        }
      });
    }
    this.prenda.grupo.updateMatrixWorld(true);
    void this.ponerLogo();
    if (previo && previo.ubicacion !== nuevo.ubicacion && nuevo.logo) {
      this.verVista(nuevo.ubicacion === 'espalda' ? 'espalda' : nuevo.ubicacion === 'manga' ? 'lado' : 'frente');
    }
  }

  private async ponerLogo() {
    const e = this.estado;
    if (!e || !this.prenda) return;
    if (this.decal) {
      this.decal.parent?.remove(this.decal);
      this.decal.geometry.dispose();
      (this.decal.material as THREE.Material).dispose();
      this.decal = null;
    }
    if (!e.logo || e.ubicacion === 'sin_logo') return;
    if (this.logoActual !== e.logo) {
      this.texturaLogo?.dispose();
      this.texturaLogo = await new THREE.TextureLoader().loadAsync(e.logo);
      this.texturaLogo.colorSpace = THREE.SRGBColorSpace;
      this.texturaLogo.anisotropy = 8;
      this.logoActual = e.logo;
      if (this.estado !== e) return; // cambió mientras cargaba
    }
    const tex = this.texturaLogo!;
    const img = tex.image as { width: number; height: number };
    const proporcion = img.width / img.height;

    const p = this.prenda;
    const caja = new THREE.Box3().setFromObject(p.cuerpo);
    const alto = caja.max.y - caja.min.y;
    let objetivo = p.cuerpo;
    let origen: THREE.Vector3;
    let dir: THREE.Vector3;
    let base: number;
    switch (e.ubicacion) {
      case 'pecho_centro':
        origen = new THREE.Vector3(0, caja.min.y + alto * 0.74, 2);
        dir = new THREE.Vector3(0, 0, -1);
        base = 0.13;
        break;
      case 'espalda':
        origen = new THREE.Vector3(0, caja.min.y + alto * 0.7, -2);
        dir = new THREE.Vector3(0, 0, 1);
        base = 0.22;
        break;
      case 'manga': {
        objetivo = p.manga ?? p.cuerpo;
        const cm = new THREE.Box3().setFromObject(objetivo);
        const c = cm.getCenter(new THREE.Vector3());
        const y = cm.max.y - (cm.max.y - cm.min.y) * (e.forma === 'chaqueta' || e.forma === 'camisa' ? 0.22 : 0.45);
        origen = new THREE.Vector3(c.x + 2, y, 0);
        dir = new THREE.Vector3(-1, 0, 0);
        base = 0.075;
        break;
      }
      case 'frente_gorra':
        origen = new THREE.Vector3(0, caja.min.y + alto * 0.42, 2);
        dir = new THREE.Vector3(0, 0, -1);
        base = 0.13;
        break;
      default: // pecho izquierdo de quien la viste = derecha de quien mira
        origen = new THREE.Vector3(e.forma === 'pantalon' ? 0.13 : 0.11, caja.min.y + alto * (e.forma === 'pantalon' ? 0.55 : 0.75), 2);
        dir = new THREE.Vector3(0, 0, -1);
        base = e.forma === 'pantalon' ? 0.06 : 0.085;
    }
    const hit = tocar(objetivo, origen, dir);
    if (!hit) return;
    const escala = base * e.escalaLogo;
    const ancho = proporcion >= 1 ? escala : escala * proporcion;
    const altoLogo = proporcion >= 1 ? escala / proporcion : escala;
    const orientacion = new THREE.Euler();
    const m = new THREE.Matrix4().lookAt(hit.punto.clone().add(hit.normal), hit.punto, new THREE.Vector3(0, 1, 0));
    orientacion.setFromRotationMatrix(m);
    const geo = new DecalGeometry(objetivo, hit.punto, orientacion, new THREE.Vector3(ancho, altoLogo, 0.12));
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.65,
      depthTest: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    this.decal = new THREE.Mesh(geo, mat);
    // DecalGeometry trabaja en coordenadas del mundo: se agrega a la escena, no al grupo.
    this.escena.add(this.decal);
  }

  verVista(v: Vista) {
    this.controles.autoRotate = false;
    this.ultimaInteraccion = performance.now();
    this.anguloDestino = v === 'frente' ? 0 : v === 'espalda' ? Math.PI : Math.PI / 2;
  }

  /** Imagen PNG de la prenda tal como se ve (para la orden del asesor). */
  capturar(vista: Vista = 'frente', lado = 900): string {
    const pos = this.camara.position.clone();
    const asp = this.camara.aspect;
    const tam = this.renderer.getSize(new THREE.Vector2());
    const angulo = vista === 'frente' ? 0 : vista === 'espalda' ? Math.PI : Math.PI / 2;
    // Encuadre cuadrado a partir del tamaño real de la prenda.
    let dist = pos.distanceTo(this.controles.target);
    if (this.prenda) {
      const t = new THREE.Box3().setFromObject(this.prenda.grupo).getSize(new THREE.Vector3());
      dist = (Math.max(t.x, t.y) * 1.12) / 2 / Math.tan(THREE.MathUtils.degToRad(this.camara.fov / 2)) + t.z / 2;
    }
    this.camara.position.set(
      this.controles.target.x + Math.sin(angulo) * dist,
      this.controles.target.y + dist * 0.04,
      this.controles.target.z + Math.cos(angulo) * dist,
    );
    this.camara.lookAt(this.controles.target);
    this.camara.aspect = 1;
    this.camara.updateProjectionMatrix();
    this.renderer.setSize(lado, lado, false);
    this.renderer.render(this.escena, this.camara);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setSize(tam.x, tam.y, false);
    this.camara.aspect = asp;
    this.camara.updateProjectionMatrix();
    this.camara.position.copy(pos);
    this.camara.lookAt(this.controles.target);
    return url;
  }

  destruir() {
    cancelAnimationFrame(this.cuadro);
    this.observador.disconnect();
    this.controles.dispose();
    if (this.prenda) liberar(this.prenda.grupo);
    this.texturaLogo?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function liberar(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
