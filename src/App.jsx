import { useRef, useEffect } from 'react';
import MugViewer from './components/MugViewer';
import Sidebar from './components/Sidebar';

export default function App() {
  const mugRef = useRef(null);

  // Ler URL params pra automação (?artwork=...&exterior=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const artworkUrl = params.get('artwork');
    const exterior = params.get('exterior');
    const interior = params.get('interior');
    const handle = params.get('handle');
    const background = params.get('background');

    // Esperar MugScene pronta
    const init = () => {
      const mug = window.__mug;
      if (!mug) { setTimeout(init, 100); return; }

      if (artworkUrl) mug.loadArtwork(artworkUrl);
      mug.setColors({
        exterior: exterior || undefined,
        interior: interior || undefined,
        handle: handle || undefined,
        background: background || undefined,
      });
    };
    init();
  }, []);

  // Modo headless (sem sidebar) quando tem ?headless=1
  const params = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null;
  const headless = params?.get('headless') === '1';

  return (
    <div className="app-layout">
      {!headless && <Sidebar mugRef={mugRef} />}
      <div className="viewport" style={headless ? { flex: 1 } : undefined}>
        <MugViewer ref={mugRef} className="mug-canvas-wrap" />
        {!headless && (
          <div className="viewport-hint">
            <kbd>Arrastar</kbd> rotacionar &nbsp;·&nbsp; <kbd>Scroll</kbd> zoom &nbsp;·&nbsp; <kbd>Shift+Arrastar</kbd> mover
          </div>
        )}
      </div>
    </div>
  );
}
