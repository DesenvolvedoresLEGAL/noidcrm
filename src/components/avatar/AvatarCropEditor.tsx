import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2, Maximize2, Move, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clamp, computeCropTransform, renderCroppedAvatar } from '@/lib/avatar/cropMath';

interface AvatarCropEditorProps {
  open: boolean;
  file: File | null;
  /** Final output size in pixels (square). Defaults to 512. */
  outputSize?: number;
  /** Maximum zoom multiplier on top of the base cover scale. */
  maxZoom?: number;
  /** Visual size of the editor canvas in CSS pixels. Defaults to 320. */
  editorSize?: number;
  saving?: boolean;
  onCancel: () => void;
  onSave: (blob: Blob) => void | Promise<void>;
}

export function AvatarCropEditor({
  open,
  file,
  outputSize = 512,
  maxZoom = 3,
  editorSize = 320,
  saving = false,
  onCancel,
  onSave,
}: AvatarCropEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const editorCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
  });

  // Editor canvas works in target output pixels; CSS scales it down to `editorSize`.
  const cssToTarget = outputSize / editorSize;

  // Load the file into an HTMLImageElement.
  useEffect(() => {
    if (!open || !file) {
      setImage(null);
      setImageError(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setImageError(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.onerror = () => {
      setImageError('Não foi possível carregar a imagem.');
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [open, file]);

  // Render editor + circular preview every time anything changes.
  const drawAll = useCallback(() => {
    if (!image) return;

    const editor = editorCanvasRef.current;
    if (editor) {
      editor.width = outputSize;
      editor.height = outputSize;
      const ctx = editor.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Soft checkerboard backdrop so transparent / non-covering areas are obvious.
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, outputSize, outputSize);

        const t = computeCropTransform({
          imageWidth: image.naturalWidth,
          imageHeight: image.naturalHeight,
          outputSize,
          zoom,
          offsetX: offset.x,
          offsetY: offset.y,
        });
        ctx.drawImage(image, t.drawX, t.drawY, t.drawW, t.drawH);

        // Dim outside the circular crop area to preview the final shape.
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    const preview = previewCanvasRef.current;
    if (preview) {
      const previewSize = 96;
      preview.width = previewSize;
      preview.height = previewSize;
      const ctx = preview.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, previewSize, previewSize);
        ctx.save();
        ctx.beginPath();
        ctx.arc(previewSize / 2, previewSize / 2, previewSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const t = computeCropTransform({
          imageWidth: image.naturalWidth,
          imageHeight: image.naturalHeight,
          outputSize: previewSize,
          zoom,
          offsetX: (offset.x / outputSize) * previewSize,
          offsetY: (offset.y / outputSize) * previewSize,
        });
        ctx.drawImage(image, t.drawX, t.drawY, t.drawW, t.drawH);
        ctx.restore();
      }
    }
  }, [image, zoom, offset, outputSize]);

  useEffect(() => {
    drawAll();
  }, [drawAll]);

  // Re-clamp offset when zoom changes so the image always covers the frame.
  useEffect(() => {
    if (!image) return;
    const t = computeCropTransform({
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      outputSize,
      zoom,
      offsetX: offset.x,
      offsetY: offset.y,
    });
    if (Math.abs(offset.x) > t.maxOffsetX || Math.abs(offset.y) > t.maxOffsetY) {
      setOffset({
        x: clamp(offset.x, -t.maxOffsetX, t.maxOffsetX),
        y: clamp(offset.y, -t.maxOffsetY, t.maxOffsetY),
      });
    }
  }, [zoom, image, outputSize, offset.x, offset.y]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!image) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active || !image) return;
    const dx = (e.clientX - dragRef.current.startX) * cssToTarget;
    const dy = (e.clientY - dragRef.current.startY) * cssToTarget;

    const t = computeCropTransform({
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      outputSize,
      zoom,
      offsetX: 0,
      offsetY: 0,
    });
    setOffset({
      x: clamp(dragRef.current.baseX + dx, -t.maxOffsetX, t.maxOffsetX),
      y: clamp(dragRef.current.baseY + dy, -t.maxOffsetY, t.maxOffsetY),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!image) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.002;
    setZoom((z) => clamp(z + delta, 1, maxZoom));
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleSave = async () => {
    if (!image) return;
    const canvas = renderCroppedAvatar(image, outputSize, zoom, offset.x, offset.y);
    canvas.toBlob(
      (blob) => {
        if (blob) onSave(blob);
      },
      'image/png',
      0.95,
    );
  };

  const editorStyle = useMemo(
    () => ({ width: editorSize, height: editorSize }),
    [editorSize],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajuste sua foto</DialogTitle>
          <DialogDescription>
            Arraste para reposicionar e use o zoom para enquadrar perfeitamente o rosto.
            A prévia ao lado mostra exatamente como sua foto vai aparecer no sistema.
          </DialogDescription>
        </DialogHeader>

        {imageError ? (
          <div className="py-12 text-center text-destructive">{imageError}</div>
        ) : !image ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Editor canvas */}
            <div
              className="relative rounded-lg overflow-hidden bg-muted touch-none select-none ring-1 ring-border"
              style={editorStyle}
            >
              <canvas
                ref={editorCanvasRef}
                style={editorStyle}
                className={cn(
                  'block w-full h-full cursor-grab active:cursor-grabbing',
                  'touch-none',
                )}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheel}
              />
              {/* Subtle circular guide overlay */}
              <div
                className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-primary/40"
                aria-hidden
              />
            </div>

            {/* Controls + preview */}
            <div className="flex-1 w-full space-y-5 min-w-[200px]">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Prévia
                </p>
                <div className="flex items-center gap-3">
                  <canvas
                    ref={previewCanvasRef}
                    className="rounded-full ring-2 ring-border bg-muted"
                    style={{ width: 64, height: 64 }}
                  />
                  <canvas
                    ref={(el) => {
                      // duplicate small preview not needed; rely on previewCanvasRef sized 96
                    }}
                    style={{ display: 'none' }}
                  />
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    Será salva em<br />
                    <span className="font-semibold text-foreground">
                      {outputSize}×{outputSize}px PNG
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ZoomIn className="h-3.5 w-3.5" />
                    Zoom
                  </span>
                  <span className="font-mono">{zoom.toFixed(1)}×</span>
                </div>
                <Slider
                  min={1}
                  max={maxZoom}
                  step={0.05}
                  value={[zoom]}
                  onValueChange={(v) => setZoom(v[0] ?? 1)}
                />
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-center gap-1.5">
                  <Move className="h-3.5 w-3.5" />
                  Arraste a foto para reposicionar
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="w-full"
              >
                <Maximize2 className="h-4 w-4 mr-2" />
                Centralizar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!image || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar foto'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
