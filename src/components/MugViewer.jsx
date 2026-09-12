import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { MugScene } from '../lib/MugScene';

/**
 * MugViewer — wrapper React do MugScene Three.js.
 * Expõe a instângia via ref pra automação.
 */
const MugViewer = forwardRef(function MugViewer({ className }, ref) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getScene: () => sceneRef.current,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    const mug = new MugScene(canvas, width, height);
    sceneRef.current = mug;

    // Expor pra Puppeteer controlar headless
    window.__mug = {
      scene: mug,
      loadArtwork: (url) => mug.setArtwork(url),
      setCamera: (x, y, z) => {
        mug.camera.position.set(x, y, z);
        mug.camera.lookAt(0, 1, 0);
        mug.controls.target.set(0, 1, 0);
        mug.controls.update();
      },
      setMugRotation: (y) => { mug.mugGroup.rotation.y = y; },
      setAutoRotate: (v) => mug.setAutoRotate(v),
      render: () => mug.renderer.render(mug.scene, mug.camera),
      capture: () => mug.renderer.domElement.toDataURL('image/png'),
      setColors: (c) => mug.setColors(c),
      waitReady: () => new Promise((r) => setTimeout(r, 800)),
    };
    window.dispatchEvent(new Event('mug-ready'));

    // Resize observer
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        mug.resize(w, h);
      }
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      mug.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
});

export default MugViewer;
