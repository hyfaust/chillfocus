import { useState, useRef, useCallback, useEffect } from 'react';
import styles from './ImageCropper.module.css';

interface Props {
  src: string;
  onCrop: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function ImageCropper({ src, onCrop, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = 480;
      const maxH = 320;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = img.width * ratio;
      const h = img.height * ratio;
      setImgSize({ w, h });
      const ASPECT = 3.0; // Match Pomodoro container ratio
      // Fit crop box within image with this aspect ratio
      let cropW = w * 0.85;
      let cropH = cropW / ASPECT;
      if (cropH > h * 0.85) {
        cropH = h * 0.85;
        cropW = cropH * ASPECT;
      }
      setCrop({ x: (w - cropW) / 2, y: (h - cropH) / 2, w: cropW, h: cropH });
      setLoaded(true);
    };
    img.src = src;
  }, [src]);

  const drawPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imgSize.w;
    canvas.height = imgSize.h;
    ctx.clearRect(0, 0, imgSize.w, imgSize.h);

    ctx.drawImage(img, 0, 0, imgSize.w, imgSize.h);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, imgSize.w, imgSize.h);

    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(img,
      (crop.x / imgSize.w) * img.width,
      (crop.y / imgSize.h) * img.height,
      (crop.w / imgSize.w) * img.width,
      (crop.h / imgSize.h) * img.height,
      crop.x, crop.y, crop.w, crop.h
    );

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    ctx.setLineDash([]);
  }, [imgSize, crop, loaded]);

  useEffect(() => { drawPreview(); }, [drawPreview]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, cx: crop.x, cy: crop.y };
  }, [crop.x, crop.y]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setCrop(prev => ({
        ...prev,
        x: Math.max(0, Math.min(imgSize.w - prev.w, dragStart.current.cx + dx)),
        y: Math.max(0, Math.min(imgSize.h - prev.h, dragStart.current.cy + dy)),
      }));
    };
    const onUp = () => setDragging(false);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, [dragging, imgSize]);

  const handleApply = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = 1200;
    outCanvas.height = 400;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img,
      (crop.x / imgSize.w) * img.width,
      (crop.y / imgSize.h) * img.height,
      (crop.w / imgSize.w) * img.width,
      (crop.h / imgSize.h) * img.height,
      0, 0, 1200, 400
    );
    onCrop(outCanvas.toDataURL('image/jpeg', 0.85));
  }, [crop, imgSize, onCrop]);

  const handleResizeMouseDown = useCallback((corner: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startCrop = { ...crop };
    const ASPECT = 3.0;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      setCrop(() => {
        let x = startCrop.x;
        let y = startCrop.y;
        let newW = startCrop.w;
        let newH = startCrop.h;
        const minW = 60;

        // Determine new width based on corner
        if (corner === 'se' || corner === 'ne') {
          newW = Math.max(minW, startCrop.w + dx);
        } else {
          newW = Math.max(minW, startCrop.w - dx);
        }

        // Derive height from width to lock aspect ratio
        newH = newW / ASPECT;

        // Enforce image bounds
        newW = Math.min(newW, imgSize.w - x);
        newH = Math.min(newH, imgSize.h - y);
        if (newH < newW / ASPECT) newW = newH * ASPECT;
        newH = newW / ASPECT;

        // Adjust position for left-side corners
        if (corner === 'nw' || corner === 'sw') {
          x = startCrop.x + startCrop.w - newW;
        }
        if (corner === 'nw' || corner === 'ne') {
          y = startCrop.y + startCrop.h - newH;
        }

        return { x, y, w: newW, h: newH };
      });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [crop, imgSize]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>裁剪背景图片</h3>
          <span className={styles.hint}>拖动选区调整位置，拖动边角调整大小</span>
        </div>

        <div className={styles.canvasWrap} ref={containerRef}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            style={{ width: imgSize.w, height: imgSize.h }}
            onMouseDown={handleMouseDown}
          />
          <div
            className={styles.cropOverlay}
            style={{
              left: crop.x,
              top: crop.y,
              width: crop.w,
              height: crop.h,
              cursor: dragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleMouseDown}
          >
            <div className={`${styles.corner} ${styles.cornerNW}`} onMouseDown={(e) => handleResizeMouseDown('nw', e)} />
            <div className={`${styles.corner} ${styles.cornerNE}`} onMouseDown={(e) => handleResizeMouseDown('ne', e)} />
            <div className={`${styles.corner} ${styles.cornerSW}`} onMouseDown={(e) => handleResizeMouseDown('sw', e)} />
            <div className={`${styles.corner} ${styles.cornerSE}`} onMouseDown={(e) => handleResizeMouseDown('se', e)} />
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>取消</button>
          <button className={styles.applyBtn} onClick={handleApply}>应用裁剪</button>
        </div>
      </div>
    </div>
  );
}
