import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class MugScene {
  constructor(canvas, width, height) {
    this.canvas = canvas;
    this._disposed = false;

    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1e1e2a);

    // ── Camera ──
    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    this.camera.position.set(0, 2.8, 7.5);

    // ── Controls ──
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 16;
    this.controls.target.set(0, 1.0, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.maxPolarAngle = Math.PI * 0.85;

    this._setupLights();
    this._buildMug();
    this._startLoop();
  }

  // ═══════════════════════════════════════════
  //  LIGHTS
  // ═══════════════════════════════════════════

  _setupLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));

    const key = new THREE.DirectionalLight(0xfff5e6, 1.0);
    key.position.set(5, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.001;
    key.shadow.radius = 3;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xc8d8f0, 0.45);
    fill.position.set(-5, 4, -2);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.35);
    rim.position.set(-1, 3, -7);
    this.scene.add(rim);

    const bounce = new THREE.DirectionalLight(0xe8e0d8, 0.12);
    bounce.position.set(0, -2, 3);
    this.scene.add(bounce);
  }

  // ═══════════════════════════════════════════
  //  MUG GEOMETRY (Single Mesh Approach)
  // ═══════════════════════════════════════════

  _buildMug() {
    this.mugGroup = new THREE.Group();
    this.scene.add(this.mugGroup);

    const P = {
      radius: 0.80,        
      height: 1.90,        
      wall: 0.055,         
      seg: 80,             
      handleTube: 0.09,    
    };

    const H = P.height;
    const R = P.radius;
    const W = P.wall;
    const outerH = H - W / 2;

    this._currentExteriorHex = '#ffffff';
    this._currentImage = null;

    // ────────────────────────────────
    // 1. PAREDE EXTERIOR (Única malha)
    // ────────────────────────────────
    this.exteriorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
      metalness: 0.0,
      side: THREE.FrontSide,
    });

    const outerGeo = new THREE.CylinderGeometry(R, R, outerH, P.seg, 1, true);
    this.outerMesh = new THREE.Mesh(outerGeo, this.exteriorMat);
    this.outerMesh.position.y = outerH / 2;
    // Rotação exata para que a costura da textura (gap) fique escondida sob a alça
    this.outerMesh.rotation.y = Math.PI / 2;
    this.outerMesh.castShadow = true;
    this.outerMesh.receiveShadow = true;
    this.mugGroup.add(this.outerMesh);

    // ────────────────────────────────
    // 2. PAREDE INTERIOR
    // ────────────────────────────────
    this.interiorMat = new THREE.MeshStandardMaterial({
      color: 0xf5efe4,
      roughness: 0.55,
      metalness: 0.0,
      side: THREE.BackSide,
    });

    const innerR = R - W;
    const innerH = H - 1.5 * W; 
    
    const innerGeo = new THREE.CylinderGeometry(innerR, innerR, innerH, P.seg, 1, true);
    this.innerMesh = new THREE.Mesh(innerGeo, this.interiorMat);
    this.innerMesh.position.y = W + innerH / 2;
    this.innerMesh.receiveShadow = true;
    this.mugGroup.add(this.innerMesh);

    // ────────────────────────────────
    // 3. FUNDO INTERNO
    // ────────────────────────────────
    this.bottomMat = new THREE.MeshStandardMaterial({
      color: 0xf5efe4,
      roughness: 0.55,
      metalness: 0.0,
    });

    const bottomGeo = new THREE.CircleGeometry(innerR, P.seg);
    this.bottomMesh = new THREE.Mesh(bottomGeo, this.bottomMat);
    this.bottomMesh.rotation.x = -Math.PI / 2;
    this.bottomMesh.position.y = W;
    this.bottomMesh.receiveShadow = true;
    this.mugGroup.add(this.bottomMesh);

    // ────────────────────────────────
    // 4. BORDA SUPERIOR
    // ────────────────────────────────
    this.rimMat = new THREE.MeshStandardMaterial({
      color: 0xf5efe4,
      roughness: 0.3,
      metalness: 0.0,
    });

    const rimRadius = R - W / 2;
    const rimTube = W / 2;
    const rimGeo = new THREE.TorusGeometry(rimRadius, rimTube, 16, P.seg);
    this.rimMesh = new THREE.Mesh(rimGeo, this.rimMat);
    this.rimMesh.rotation.x = Math.PI / 2;
    this.rimMesh.position.y = outerH; 
    this.rimMesh.castShadow = true;
    this.mugGroup.add(this.rimMesh);

    // ────────────────────────────────
    // 4.5 BASE INFERIOR (Isolada para não borrar)
    // ────────────────────────────────
    this.baseMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.32,
    });
    
    const baseGeo = new THREE.RingGeometry(innerR, R, P.seg);
    this.baseMesh = new THREE.Mesh(baseGeo, this.baseMat);
    this.baseMesh.rotation.x = Math.PI / 2; 
    this.baseMesh.position.y = 0;
    this.mugGroup.add(this.baseMesh);

    // ────────────────────────────────
    // 5. ALÇA 
    // ────────────────────────────────
    this.handleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0.0,
    });

    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(R - 0.05, H * 0.82, 0), 
      new THREE.Vector3(R + 0.85, H * 0.82, 0), 
      new THREE.Vector3(R + 0.75, H * 0.20, 0), 
      new THREE.Vector3(R - 0.05, H * 0.20, 0)  
    );

    const handleGeo = new THREE.TubeGeometry(curve, 64, P.handleTube, 32, false);
    
    this.handleMesh = new THREE.Mesh(handleGeo, this.handleMat);
    this.handleMesh.scale.set(1, 1, 0.6); 
    this.handleMesh.castShadow = true;
    this.mugGroup.add(this.handleMesh);

    // ────────────────────────────────
    // 6. GROUND SHADOW
    // ────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.18 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.01;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this._artworkTexture = null;
  }

  // ═══════════════════════════════════════════
  //  ARTWORK (Canvas Único Unificado)
  // ═══════════════════════════════════════════

  _updateCanvasTexture() {
    if (this._disposed) return; 

    if (!this._currentImage) {
      this.exteriorMat.map = null;
      this.exteriorMat.color.set(this._currentExteriorHex);
      this.exteriorMat.needsUpdate = true;
      return;
    }

    const canvasW = 2300; 
    const canvasH = 950;  
    const printW = 2100;  
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    
    // 1. Pinta todo o fundo com a cor exterior exata
    ctx.fillStyle = this._currentExteriorHex;
    ctx.fillRect(0, 0, canvasW, canvasH);
    
    // 2. Desenha a arte por cima do fundo colorido
    const img = this._currentImage;
    const imgW = img.width || img.videoWidth;
    const imgH = img.height || img.videoHeight;
    
    const scale = Math.min(printW / imgW, canvasH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    
    const drawX = (canvasW - drawW) / 2;
    const drawY = (canvasH - drawH) / 2;
    
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this._artworkTexture = texture;
    this.exteriorMat.map = texture;
    
    // Reseta a cor física do material para branco puro, 
    // garantindo que não misture com as cores recém pintadas no Canvas.
    this.exteriorMat.color.set(0xffffff);
    this.exteriorMat.needsUpdate = true;
  }

  setArtwork(imageUrl) {
    if (!imageUrl) {
      this._currentImage = null;
      this._updateCanvasTexture();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this._currentImage = img;
      this._updateCanvasTexture();
    };
    img.src = imageUrl;
  }

  setArtworkFromImage(imgElement) {
    this._currentImage = imgElement;
    this._updateCanvasTexture();
  }

  // ═══════════════════════════════════════════
  //  CORES
  // ═══════════════════════════════════════════

  setExteriorColor(hex) {
    const c = new THREE.Color(hex);
    this._currentExteriorHex = '#' + c.getHexString();
    
    // A base isolada garante que a parte de baixo da caneca acompanhe a cor sem borrar textura
    this.baseMat.color.copy(c);
    
    if (this._currentImage) {
      this._updateCanvasTexture(); // Redesenha o fundo do canvas mantendo a arte
    } else {
      this.exteriorMat.color.copy(c);
      this.exteriorMat.needsUpdate = true;
    }
  }

  setInteriorColor(hex) {
    const c = new THREE.Color(hex);
    this.interiorMat.color.copy(c);
    this.bottomMat.color.copy(c);
    this.rimMat.color.copy(c); 
  }

  setHandleColor(hex) {
    this.handleMat.color.set(hex);
  }

  setBackground(hex) {
    this.scene.background = new THREE.Color(hex);
  }

  setColors({ exterior, interior, handle, background } = {}) {
    if (exterior) this.setExteriorColor(exterior);
    if (interior) this.setInteriorColor(interior);
    if (handle) this.setHandleColor(handle);
    if (background) this.setBackground(background);
  }

  // ═══════════════════════════════════════════
  //  ANIMAÇÃO & EXTRAS
  // ═══════════════════════════════════════════

  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
  }

  setRotateSpeed(speed) {
    this.controls.autoRotateSpeed = speed;
  }

  setArtOpacity(val) {
    if (this.exteriorMat) {
        this.exteriorMat.transparent = val < 1;
        this.exteriorMat.opacity = val;
        this.exteriorMat.needsUpdate = true;
    }
  }

  setExposure(val) {
    this.renderer.toneMappingExposure = val;
  }

  resize(width, height) {
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  exportImage(multiplier = 2) {
    const w = this.renderer.domElement.width;
    const h = this.renderer.domElement.height;

    const oldPR = this.renderer.getPixelRatio();
    const oldSize = { w, h };

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w * multiplier, h * multiplier);
    this.renderer.render(this.scene, this.camera);

    const dataURL = this.renderer.domElement.toDataURL('image/png');

    this.renderer.setPixelRatio(oldPR);
    this.renderer.setSize(oldSize.w / oldPR, oldSize.h / oldPR);

    return dataURL;
  }

  getState() {
    return {
      exterior: this._currentExteriorHex,
      interior: '#' + this.interiorMat.color.getHexString(),
      handle: '#' + this.handleMat.color.getHexString(),
      background: '#' + this.scene.background.getHexString(),
      autoRotate: this.controls.autoRotate,
      rotateSpeed: this.controls.autoRotateSpeed,
      artOpacity: this.exteriorMat.opacity,
      exposure: this.renderer.toneMappingExposure,
      hasArtwork: !!this._artworkTexture,
    };
  }

  _startLoop() {
    const tick = () => {
      if (this._disposed) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this._rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  dispose() {
    this._disposed = true;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.controls.dispose();
    this.renderer.dispose();

    this.scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (obj.material.map) obj.material.map.dispose();
        obj.material.dispose();
      }
    });
  }
}