import { useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════
//  PRESET COLORS
// ═══════════════════════════════════════════

const MUG_PRESETS = [
  '#ffffff', '#f5f0e8', '#1a1a1a', '#e74c3c', '#3498db',
  '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e91e63',
];

const BG_PRESETS = [
  '#1e1e2a', '#ffffff', '#f0f0f0', '#0f0f14', '#0f3460',
  '#16213e', '#e8e8e8', '#2d2d2d', '#f5e6ca', '#dfe6e9',
  '#ffeaa7', '#fab1a0', '#74b9ff', '#a29bfe', '#55efc4',
  '#fd79a8', '#636e72', '#b2bec3', '#2d3436', '#c8d6e5',
  '#ff7675', '#00cec9', '#fdcb6e', '#6c5ce7',
];

// ═══════════════════════════════════════════
//  SUB-COMPONENTS
// ═══════════════════════════════════════════

function Section({ title, children }) {
  return (
    <div className="sidebar-section">
      <div className="section-title">{title}</div>
      {children}
    </div>
  );
}

function ColorRow({ label, color, onChange, presets, onPreset }) {
  return (
    <div className="control-block">
      <div className="control-row">
        <span className="control-label">{label}</span>
        <div className="color-pick-wrap">
          <div className="color-swatch" style={{ background: color }}>
            <input type="color" value={color} onChange={(e) => onChange(e.target.value)} />
          </div>
          <span className="color-hex">{color}</span>
        </div>
      </div>
      {presets && (
        <div className="color-presets">
          {presets.map((c) => (
            <div
              key={c}
              className={`preset-dot${color.toLowerCase() === c.toLowerCase() ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => onPreset(c)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RangeRow({ label, value, min, max, step, unit, onChange }) {
  return (
    <div className="control-block">
      <div className="control-label" style={{ marginBottom: 6 }}>{label}</div>
      <div className="range-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        <span className="range-value">
          {unit === '%' ? Math.round(value * 100) + '%' : value + 'x'}
        </span>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <div className="control-row">
      <span className="control-label">{label}</span>
      <div className={`toggle${checked ? ' active' : ''}`} onClick={() => onChange(!checked)}>
        <div className="toggle-thumb" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  SIDEBAR
// ═══════════════════════════════════════════

export default function Sidebar({ mugRef }) {
  const fileRef = useRef(null);
  const [hasArt, setHasArt] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [artFile, setArtFile] = useState(null); // raw File for render API
  const [extColor, setExtColor] = useState('#ffffff');
  const [intColor, setIntColor] = useState('#f5f0e8');
  const [hdlColor, setHdlColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState('#1e1e2a');
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotateSpeed, setRotateSpeed] = useState(0.8);
  const [artOpacity, setArtOpacity] = useState(1);
  const [brightness, setBrightness] = useState(1.1);
  const [exportRes, setExportRes] = useState(2);
  const [flash, setFlash] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderResult, setRenderResult] = useState(null);
  const [renderError, setRenderError] = useState(null);

  const getScene = useCallback(() => mugRef.current?.getScene(), [mugRef]);

  // ── Artwork ──
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setArtFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result;
      setPreviewUrl(url);
      setHasArt(true);

      // Load into Three.js
      const img = new Image();
      img.onload = () => getScene()?.setArtworkFromImage(img);
      img.src = url;
    };
    reader.readAsDataURL(file);
  }, [getScene]);

  const removeArt = useCallback(() => {
    setHasArt(false);
    setPreviewUrl(null);
    setArtFile(null);
    setRenderResult(null);
    getScene()?.setArtwork(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [getScene]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  // ── Colors ──
  const onExtColor = useCallback((c) => { setExtColor(c); getScene()?.setExteriorColor(c); }, [getScene]);
  const onIntColor = useCallback((c) => { setIntColor(c); getScene()?.setInteriorColor(c); }, [getScene]);
  const onHdlColor = useCallback((c) => { setHdlColor(c); getScene()?.setHandleColor(c); }, [getScene]);
  const onBgColor = useCallback((c) => { setBgColor(c); getScene()?.setBackground(c); }, [getScene]);

  // ── Animation ──
  const onAutoRotate = useCallback((v) => { setAutoRotate(v); getScene()?.setAutoRotate(v); }, [getScene]);
  const onRotateSpeed = useCallback((v) => { setRotateSpeed(v); getScene()?.setRotateSpeed(v); }, [getScene]);
  const onArtOpacity = useCallback((v) => { setArtOpacity(v); getScene()?.setArtOpacity(v); }, [getScene]);
  const onBrightness = useCallback((v) => { setBrightness(v); getScene()?.setExposure(v); }, [getScene]);

  // ── Export ──
  const doExport = useCallback(() => {
    const scene = getScene();
    if (!scene) return;
    const dataURL = scene.exportImage(exportRes);
    const link = document.createElement('a');
    link.download = `caneca-mockup-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  }, [getScene, exportRes]);

  // ── Render Video + Fotos ──
  const doRender = useCallback(async () => {
    if (!artFile) return;
    setRendering(true);
    setRenderResult(null);
    setRenderError(null);
    try {
      const fd = new FormData();
      fd.append('artwork', artFile);
      fd.append('exterior', extColor);
      fd.append('interior', intColor);
      fd.append('handle', hdlColor);
      fd.append('background', bgColor);
      fd.append('fps', '30');
      fd.append('duration', '11');
      fd.append('width', '1080');
      fd.append('height', '1080');

      const res = await fetch('/api/render', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no render');
      setRenderResult(data);
    } catch (err) {
      setRenderError(err.message);
    } finally {
      setRendering(false);
    }
  }, [artFile, extColor, intColor, hdlColor, bgColor]);

  // ── Drag state ──
  const [dragOver, setDragOver] = useState(false);

  return (
    <div id="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h1><span className="logo-icon">☕</span> Caneca 3D Mockup</h1>
        <p>Sua arte em 3D — upload, personalize, exporte</p>
      </div>

      {/* Upload */}
      <Section title="Arte / Design">
        <div
          id="upload-zone"
          className={dragOver ? 'dragover' : ''}
          onClick={() => !hasArt && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { setDragOver(false); onDrop(e); }}
          style={{ display: hasArt ? 'none' : undefined }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div className="upload-label">Arraste ou clique para enviar</div>
          <div className="upload-sub">PNG, JPG — recomendação 1200×600px</div>
        </div>

        {hasArt && (
          <div id="upload-preview">
            <img src={previewUrl} alt="Preview" />
            <button className="remove-btn" onClick={removeArt}>✕</button>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </Section>

      {/* Mug Colors */}
      <Section title="Cores da Caneca">
        <ColorRow label="Exterior" color={extColor} onChange={onExtColor} presets={MUG_PRESETS} onPreset={onExtColor} />
        <ColorRow label="Interior" color={intColor} onChange={onIntColor} presets={MUG_PRESETS} onPreset={onIntColor} />
        <ColorRow label="Alça" color={hdlColor} onChange={onHdlColor} presets={MUG_PRESETS} onPreset={onHdlColor} />
      </Section>

      {/* Background */}
      <Section title="Fundo">
        <ColorRow label="Cor de fundo" color={bgColor} onChange={onBgColor} />
        <div className="bg-grid">
          {BG_PRESETS.map((c) => (
            <div
              key={c}
              className={`bg-swatch${bgColor.toLowerCase() === c.toLowerCase() ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => onBgColor(c)}
            />
          ))}
        </div>
      </Section>

      {/* Animation */}
      <Section title="Animação">
        <Toggle label="Auto-girar" checked={autoRotate} onChange={onAutoRotate} />
        <RangeRow label="Velocidade" value={rotateSpeed} min={0.2} max={4} step={0.1} unit="x" onChange={onRotateSpeed} />
        <RangeRow label="Opacidade da arte" value={artOpacity} min={0} max={1} step={0.05} unit="%" onChange={onArtOpacity} />
        <RangeRow label="Brilho" value={brightness} min={0.3} max={2.5} step={0.05} unit="%" onChange={onBrightness} />
      </Section>

      {/* Export */}
      <Section title="Exportar">
        <div className="control-row" style={{ marginBottom: 10 }}>
          <span className="control-label">Resolução</span>
          <select
            value={exportRes}
            onChange={(e) => setExportRes(parseInt(e.target.value))}
            className="res-select"
          >
            <option value={1}>1x (HD)</option>
            <option value={2}>2x (Full HD)</option>
            <option value={3}>3x (Ultra)</option>
          </select>
        </div>
        <button className="btn btn-export" onClick={doExport}>
          📷 Exportar PNG
        </button>

        <div style={{ marginTop: 12, borderTop: '1px solid var(--panel-border)', paddingTop: 12 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Video + Fotos (servidor)</div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            Gera video 360° + 2 fotos com as cores atuais (exterior, interior, alça)
          </p>
          <button
            className="btn btn-render"
            onClick={doRender}
            disabled={rendering || !artFile}
            style={{
              width: '100%', padding: '10px 16px', border: 'none', borderRadius: 'var(--radius)',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: rendering ? 'wait' : 'pointer',
              background: rendering ? '#555' : 'var(--accent)', color: '#fff',
              opacity: !artFile ? 0.5 : 1,
            }}
          >
            {rendering ? '⏳ Renderizando...' : '🎬 Renderizar Video + Fotos'}
          </button>

          {renderError && (
            <p style={{ fontSize: 12, color: '#e74c3c', marginTop: 8 }}>{renderError}</p>
          )}

          {renderResult && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a href={renderResult.video} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                🎥 Baixar Video
              </a>
              <a href={renderResult.fotoCentro} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                📷 Foto Centro
              </a>
              <a href={renderResult.fotoAlca} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
                📷 Foto Alça
              </a>
            </div>
          )}
        </div>
      </Section>

      {/* Flash */}
      {flash && (
        <div className="export-flash show">
          <div className="flash-icon">✅</div>
          <div className="flash-msg">Imagem exportada!</div>
        </div>
      )}
    </div>
  );
}
