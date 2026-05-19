import { useState, useRef, useEffect, useCallback, type ReactNode, type ChangeEvent } from 'react';

interface Props {
  onFile: (dataUrl: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  maxSize?: number;
  quality?: number;
  maxInputBytes?: number;
  children: (open: () => void) => ReactNode;
}

const ALLOWED_INPUT_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const DEFAULT_MAX_INPUT_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_SIZE = 800;
const DEFAULT_QUALITY = 0.85;

function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse), (hover: none)').matches;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

async function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible ou corrompue'));
    img.src = dataUrl;
  });
}

async function resizeImage(file: File, maxSize: number, quality: number): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  const img = await decodeImage(dataUrl);

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w === 0 || h === 0) throw new Error('Dimensions image invalides');

  if (w <= maxSize && h <= maxSize) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', quality);
  }

  const scale = Math.min(maxSize / w, maxSize / h);
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export function PhotoPicker({
  onFile,
  onError,
  disabled,
  maxSize = DEFAULT_MAX_SIZE,
  quality = DEFAULT_QUALITY,
  maxInputBytes = DEFAULT_MAX_INPUT_BYTES,
  children,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const mountedRef = useRef(true);
  const titleId = useRef(`photo-picker-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const reportError = useCallback((msg: string) => {
    if (onError) onError(msg);
  }, [onError]);

  const open = useCallback(() => {
    if (disabled || busy) return;
    if (isTouchDevice()) setMenuOpen(true);
    else fileRef.current?.click();
  }, [disabled, busy]);

  const handleChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setMenuOpen(false);
    if (!file) return;

    if (!ALLOWED_INPUT_MIME.has(file.type.toLowerCase())) {
      reportError(`Format non supporté (${file.type || 'inconnu'}). Utilisez JPEG, PNG, WebP ou HEIC.`);
      return;
    }
    if (file.size > maxInputBytes) {
      const maxMb = Math.round(maxInputBytes / (1024 * 1024));
      reportError(`Fichier trop volumineux (max ${maxMb} Mo).`);
      return;
    }

    setBusy(true);
    try {
      const dataUrl = await resizeImage(file, maxSize, quality);
      if (mountedRef.current) onFile(dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Traitement de l\'image impossible';
      if (mountedRef.current) reportError(msg);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  }, [maxInputBytes, maxSize, quality, onFile, reportError]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
      />

      {children(open)}

      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId.current}
          onClick={() => setMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(27,24,18,0.5)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            animation: 'fadeIn 0.15s ease',
            padding: 0,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card)',
              borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
              padding: '14px 16px calc(28px + env(safe-area-inset-bottom))',
              width: '100%',
              maxWidth: 480,
              boxShadow: 'var(--shadow-lg)',
              display: 'flex', flexDirection: 'column', gap: 8,
              animation: 'slideUp 0.2s ease',
            }}
          >
            <div style={{
              width: 36, height: 4, background: 'var(--rule)',
              borderRadius: 2, margin: '4px auto 14px',
            }} />

            <h2 id={titleId.current} style={{
              fontSize: 13, fontWeight: 600, color: 'var(--ink-3)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
              margin: '0 4px 8px', fontFamily: 'var(--font-mono)',
            }}>
              Ajouter une photo
            </h2>

            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
                background: 'var(--card)', color: 'var(--ink)',
                cursor: busy ? 'wait' : 'pointer', fontSize: 15, fontWeight: 500,
                textAlign: 'start', font: 'inherit', opacity: busy ? 0.6 : 1,
              }}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--terra)', flexShrink: 0 }}>
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Prendre une photo
            </button>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px',
                border: '1px solid var(--rule)', borderRadius: 'var(--r-md)',
                background: 'var(--card)', color: 'var(--ink)',
                cursor: busy ? 'wait' : 'pointer', fontSize: 15, fontWeight: 500,
                textAlign: 'start', font: 'inherit', opacity: busy ? 0.6 : 1,
              }}
            >
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--terra)', flexShrink: 0 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              Choisir depuis la galerie
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              style={{
                marginTop: 4, padding: '12px 16px',
                border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: 14, color: 'var(--ink-3)',
                font: 'inherit',
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
