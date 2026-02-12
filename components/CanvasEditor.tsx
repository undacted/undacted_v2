import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Rect } from '../types';
import { Maximize, Type, AlertTriangle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { detectRedactionAtPoint } from '../utils/analysisUtils';

interface CanvasEditorProps {
  imageSrc: string;
  activeTool: 'redaction' | 'reference' | null;
  onRedactionDrawn: (rect: Rect) => void;
  onReferenceDrawn: (rect: Rect) => void;
  redactionRect: Rect | null;
  referenceRect: Rect | null;
  lazyRedactionDetected: boolean;
  finalImageUrl: string | null;
}

const addAlpha = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  imageSrc,
  activeTool,
  onRedactionDrawn,
  onReferenceDrawn,
  redactionRect,
  referenceRect,
  lazyRedactionDetected,
  finalImageUrl
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');

  // Panning refs
  const isPanning = useRef(false);
  const lastPanCoordinates = useRef({ x: 0, y: 0 });

  // Load Image
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImageObj(img);
      setZoomMode('fit');
    };
  }, [imageSrc]);

  // Handle Resize and Drawing Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    // Helper to draw rect
    const drawRect = (rect: Rect, color: string, label?: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      
      // Use semi-transparent fill
      ctx.fillStyle = addAlpha(color, 0.3);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      if (label) {
        ctx.fillStyle = color;
        ctx.font = 'bold 12px "JetBrains Mono"';
        ctx.fillText(label, rect.x, rect.y - 5);
      }
    };

    if (redactionRect) {
      drawRect(redactionRect, '#ff3333', 'TARGET (REDACTION)');
      if (lazyRedactionDetected) {
         ctx.strokeStyle = '#ffff00';
         ctx.lineWidth = 1;
         ctx.setLineDash([5, 5]);
         ctx.strokeRect(redactionRect.x - 4, redactionRect.y - 4, redactionRect.w + 8, redactionRect.h + 8);
         ctx.fillStyle = '#ffff00';
         ctx.fillText("⚠ ARTIFACTS FOUND", redactionRect.x, redactionRect.y + redactionRect.h + 15);
      }
    }

    if (referenceRect) {
      drawRect(referenceRect, '#00ff41', 'REFERENCE');
    }

    if (currentRect) {
      const color = activeTool === 'redaction' ? '#ff3333' : '#00ff41';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
      
      // Faint fill for the current drawing operation
      ctx.fillStyle = addAlpha(color, 0.15);
      ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
    }
  }, [imageObj, redactionRect, referenceRect, currentRect, activeTool, lazyRedactionDetected]);

  // Handle sizing with Resize Listener
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && imageObj && canvasRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const containerHeight = containerRef.current.clientHeight;
        
        // Calculate scale to fit within container (contain)
        // Subtract padding (32px = 2rem)
        const scaleX = (containerWidth - 32) / imageObj.width;
        const scaleY = (containerHeight - 32) / imageObj.height;
        const fitScale = Math.min(1, Math.min(scaleX, scaleY));
        
        let finalScale = fitScale;
        if (typeof zoomMode === 'number') {
            finalScale = zoomMode;
        }
        
        setScale(finalScale);
        
        canvasRef.current.width = imageObj.width;
        canvasRef.current.height = imageObj.height;
        canvasRef.current.style.width = `${imageObj.width * finalScale}px`;
        canvasRef.current.style.height = `${imageObj.height * finalScale}px`;
        draw();
      }
    };

    window.addEventListener('resize', handleResize);
    // Call once to set initial size
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [imageObj, draw, zoomMode]);

  const handleZoomIn = () => {
    setZoomMode(prev => {
        const current = scale;
        return current * 1.25;
    });
  };

  const handleZoomOut = () => {
    setZoomMode(prev => {
        const current = scale;
        return Math.max(0.1, current * 0.8);
    });
  };

  const handleFit = () => setZoomMode('fit');

  const getClientCoordinates = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  };

  const handleStart = (clientX: number, clientY: number) => {
    if (!activeTool) return;
    setIsDrawing(true);
    const { x, y } = getClientCoordinates(clientX, clientY);
    setStartPos({ x, y });
    setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDrawing || !activeTool) return;
    const { x, y } = getClientCoordinates(clientX, clientY);
    setCurrentRect({
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      w: Math.abs(x - startPos.x),
      h: Math.abs(y - startPos.y)
    });
  };

  const handleEnd = () => {
    if (isPanning.current) return; // Don't trigger draw end if we were panning

    if (!isDrawing || !currentRect) return;
    setIsDrawing(false);
    
    // Normalize negative width/height
    const normalizedRect = { ...currentRect };
    
    // Check if it was a drag (drawing) or a tap (click)
    if (normalizedRect.w > 5 && normalizedRect.h > 5) {
      // Manual Draw
      if (activeTool === 'redaction') {
        onRedactionDrawn(normalizedRect);
      } else if (activeTool === 'reference') {
        onReferenceDrawn(normalizedRect);
      }
    } else {
        // Tap / Click - Attempt Auto-Detection for Redaction
        if (activeTool === 'redaction' && canvasRef.current) {
            const detectedRect = detectRedactionAtPoint(canvasRef.current, startPos.x, startPos.y);
            if (detectedRect) {
                onRedactionDrawn(detectedRect);
            }
        }
    }
    setCurrentRect(null);
  };

  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  const onMouseUp = () => handleEnd();

  const onTouchStart = (e: React.TouchEvent) => {
      // 2-finger pan detection
      if (e.touches.length === 2) {
          isPanning.current = true;
          // Stop any current drawing
          setIsDrawing(false);
          setCurrentRect(null);

          const x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          lastPanCoordinates.current = { x, y };
          return;
      }

      if (activeTool && e.touches.length === 1) {
          handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }
  };

  const onTouchMove = (e: React.TouchEvent) => {
      // Handle Panning
      if (isPanning.current && e.touches.length === 2 && containerRef.current) {
          // Important: prevent default to avoid browser interfering (though touch-action: none handles most)
          // e.preventDefault(); 
          
          const x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          
          const deltaX = lastPanCoordinates.current.x - x;
          const deltaY = lastPanCoordinates.current.y - y;

          containerRef.current.scrollLeft += deltaX;
          containerRef.current.scrollTop += deltaY;

          lastPanCoordinates.current = { x, y };
          return;
      }

      if (activeTool && isDrawing && !isPanning.current) {
          handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
      if (isPanning.current && e.touches.length < 2) {
          isPanning.current = false;
          return;
      }
      handleEnd();
  };

  if (finalImageUrl) {
      return (
          <div className="flex-1 bg-black flex items-center justify-center p-4 relative overflow-auto">
              <img src={finalImageUrl} className="max-w-full shadow-2xl border-2 border-osint-green" alt="Evidence" />
          </div>
      )
  }

  return (
    <div className="flex-1 bg-black relative h-full flex flex-col overflow-hidden">
      {!imageSrc && (
        <div className="flex-1 flex flex-col items-center justify-center text-osint-gray">
          <Maximize className="w-16 h-16 mb-4 opacity-20" />
          <p>No Image Loaded</p>
        </div>
      )}
      
      {imageSrc && (
        <>
            <div ref={containerRef} className="flex-1 overflow-auto flex relative">
                <div className="relative m-auto p-4">
                    <canvas
                        ref={canvasRef}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        style={{ touchAction: activeTool ? 'none' : 'auto' }}
                        className={`border border-osint-gray shadow-2xl ${activeTool ? 'cursor-crosshair' : 'cursor-grab'}`}
                    />
                    {/* Tooltip overlay */}
                    <div className="absolute top-2 left-2 flex gap-2 pointer-events-none">
                        {activeTool === 'redaction' && (
                            <div className="bg-osint-alert text-black px-2 py-1 text-xs font-bold animate-pulse flex items-center">
                                <AlertTriangle className="w-3 h-3 mr-1"/> DRAW / TAP REDACTION (2-FINGER PAN)
                            </div>
                        )}
                        {activeTool === 'reference' && (
                            <div className="bg-osint-green text-black px-2 py-1 text-xs font-bold animate-pulse flex items-center">
                                <Type className="w-3 h-3 mr-1"/> DRAW REFERENCE BOX (2-FINGER PAN)
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 right-6 flex gap-2 bg-osint-panel border border-osint-gray p-2 rounded-lg shadow-xl z-30">
                <button onClick={handleZoomOut} className="p-2 hover:bg-osint-gray rounded text-osint-green transition-colors" title="Zoom Out">
                    <ZoomOut className="w-5 h-5" />
                </button>
                <button onClick={handleFit} className="p-2 hover:bg-osint-gray rounded text-osint-green transition-colors" title="Fit to Screen">
                    <RotateCcw className="w-5 h-5" />
                </button>
                <button onClick={handleZoomIn} className="p-2 hover:bg-osint-gray rounded text-osint-green transition-colors" title="Zoom In">
                    <ZoomIn className="w-5 h-5" />
                </button>
            </div>
        </>
      )}
    </div>
  );
};