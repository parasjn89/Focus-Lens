import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Loader2 } from 'lucide-react';

const CANVAS_SIZE = 320;
const OUTPUT_SIZE = 400;

export function AvatarCropModal({ isOpen, imageSrc, onClose, onSave, isSaving }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgElement, setImgElement] = useState(null);
  const [previewDataUrl, setPreviewDataUrl] = useState('');

  const canvasRef = useRef(null);

  // Reset zoom & pan when image changes or modal opens
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setPan({ x: 0, y: 0 });

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setImgElement(img);
      };
      img.src = imageSrc;
    } else {
      setImgElement(null);
      setPreviewDataUrl('');
    }
  }, [isOpen, imageSrc]);

  // Calculate draw parameters
  const calculateDrawParams = useCallback(() => {
    if (!imgElement) return null;

    const baseScale = CANVAS_SIZE / Math.min(imgElement.naturalWidth, imgElement.naturalHeight);
    const scale = baseScale * zoom;
    const drawWidth = imgElement.naturalWidth * scale;
    const drawHeight = imgElement.naturalHeight * scale;

    const maxPanX = Math.max(0, (drawWidth - CANVAS_SIZE) / 2);
    const maxPanY = Math.max(0, (drawHeight - CANVAS_SIZE) / 2);

    const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, pan.x));
    const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, pan.y));

    const drawX = (CANVAS_SIZE - drawWidth) / 2 + clampedPanX;
    const drawY = (CANVAS_SIZE - drawHeight) / 2 + clampedPanY;

    return { drawX, drawY, drawWidth, drawHeight, clampedPanX, clampedPanY };
  }, [imgElement, zoom, pan]);

  // Render canvas & circular thumbnail preview
  useEffect(() => {
    if (!imgElement || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const params = calculateDrawParams();
    if (!params) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Draw the image onto canvas
    ctx.drawImage(imgElement, params.drawX, params.drawY, params.drawWidth, params.drawHeight);

    // Update the live circular thumbnail
    try {
      setPreviewDataUrl(canvas.toDataURL('image/jpeg', 0.8));
    } catch {
      // Ignore if canvas tainted
    }
  }, [imgElement, calculateDrawParams]);

  // Mouse & Touch Pan handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!imgElement) return;

    const params = calculateDrawParams();
    if (!params) return;

    // Create export canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = OUTPUT_SIZE;
    exportCanvas.height = OUTPUT_SIZE;
    const exportCtx = exportCanvas.getContext('2d');

    const scaleRatio = OUTPUT_SIZE / CANVAS_SIZE;
    exportCtx.drawImage(
      imgElement,
      params.drawX * scaleRatio,
      params.drawY * scaleRatio,
      params.drawWidth * scaleRatio,
      params.drawHeight * scaleRatio
    );

    const croppedBase64 = exportCanvas.toDataURL('image/jpeg', 0.9);
    await onSave(croppedBase64);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-black/80 space-y-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 id="avatar-modal-title" className="text-lg font-bold text-white">
              Crop & Position Avatar
            </h3>
            <p className="text-xs text-slate-400">
              Drag to position, zoom to crop to a perfect square.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport Canvas & Circular Frame Overlay */}
        <div className="flex flex-col items-center justify-center">
          <div
            className="relative w-[320px] h-[320px] rounded-2xl overflow-hidden border-2 border-brand-500/40 bg-slate-950 shadow-inner cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="w-full h-full block"
            />

            {/* Circular Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-white/30 border-dashed m-3" />
            <div className="absolute inset-0 pointer-events-none shadow-[0_0_0_9999px_rgba(10,15,30,0.4)] rounded-full m-3" />
          </div>

          <div className="flex items-center justify-between w-full mt-3 px-1 text-[11px] text-slate-400">
            <span>Drag image to reposition</span>
            {previewDataUrl && (
              <div className="flex items-center space-x-2">
                <span>Preview:</span>
                <img
                  src={previewDataUrl}
                  alt="Thumbnail"
                  className="w-6 h-6 rounded-full object-cover border border-brand-400/50 shadow"
                />
              </div>
            )}
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <ZoomIn className="w-3.5 h-3.5 text-brand-400" />
              Zoom Level
            </span>
            <span className="font-mono text-[11px] text-brand-400">
              {Math.round(zoom * 100)}%
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <ZoomOut className="w-4 h-4 text-slate-500 shrink-0" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              disabled={isSaving}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <ZoomIn className="w-4 h-4 text-slate-500 shrink-0" />
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving || (zoom === 1 && pan.x === 0 && pan.y === 0)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
              title="Reset Zoom & Pan"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !imgElement}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading Avatar...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Save Profile Picture</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
