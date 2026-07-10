import React, { useRef, useState, useEffect } from 'react';
import { Undo, Trash2, Check, X, Circle, Eraser, MoveUp } from 'lucide-react';

interface DrawingCanvasProps {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
  initialColor?: string;
  language: 'it' | 'en';
}

export default function DrawingCanvas({ onSave, onClose, initialColor = '#000000', language }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [color, setColor] = useState(initialColor);
  const [lineWidth, setLineWidth] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  
  const [recentBrushColors, setRecentBrushColors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('android_notes_recent_brush_colors');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const handleApplyBrushColor = (colorHex: string) => {
    setColor(colorHex);
    setIsEraser(false);
    setRecentBrushColors(prev => {
      const filtered = prev.filter(c => c.toLowerCase() !== colorHex.toLowerCase());
      const updated = [colorHex, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('android_notes_recent_brush_colors', JSON.stringify(updated));
      } catch (e) {
        console.warn(e);
      }
      return updated;
    });
  };
  
  // History for undo
  const [history, setHistory] = useState<string[]>([]);
  
  const translations = {
    it: {
      draw: 'Disegno a mano libera',
      save: 'Salva nel Note',
      cancel: 'Annulla',
      brush: 'Spessore',
      eraser: 'Gomma',
      clear: 'Pulisci',
      undo: 'Ripristina',
    },
    en: {
      draw: 'Freehand Drawing',
      save: 'Save to Note',
      cancel: 'Cancel',
      brush: 'Thickness',
      eraser: 'Eraser',
      clear: 'Clear All',
      undo: 'Undo',
    }
  };

  const t = translations[language];

  // Set up canvas size and context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      // Save current content
      const tempImage = canvas.toDataURL();
      
      // We set actual coordinate size based on parent size
      canvas.width = parent.clientWidth || 350;
      canvas.height = 400; // fixed elegant drawing height
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Restore content
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = tempImage;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Save blank state in history
    const initData = canvas.toDataURL();
    setHistory([initData]);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    
    // Check if Touch
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Prevent scrolling or zooming on touches while drawing
    if (e.cancelable) {
      e.preventDefault();
    }
    
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = lineWidth;
    
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    if (e.cancelable) {
      e.preventDefault();
    }

    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Push updated state to history
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      setHistory(prev => [...prev.slice(-15), dataUrl]); // keep last 15 actions
    }
  };

  const handleUndo = () => {
    if (history.length <= 1) return;
    
    const newHistory = [...history];
    newHistory.pop(); // remove current state
    const prevState = newHistory[newHistory.length - 1];
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx || !prevState) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
    img.src = prevState;
    
    setHistory(newHistory);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const emptyState = canvas.toDataURL();
    setHistory([emptyState]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Verify canvas is not empty (it shouldn't match initial blankState)
    onSave(canvas.toDataURL());
  };

  const colorPalette = [
    '#000000', // Black
    '#e11d48', // Red
    '#2563eb', // Blue
    '#16a34a', // Green
    '#ca8a04', // Yellow
    '#9333ea', // Purple
    '#ea580c', // Orange
    '#4b5563', // Gray
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" id="drawing-modal">
      <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-lg p-5 shadow-2xl flex flex-col border border-neutral-200 dark:border-neutral-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {t.draw}
          </h3>
          <button 
            id="close-drawing-btn"
            onClick={onClose} 
            className="p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Canvas Wrap */}
        <div className="relative border border-neutral-300 dark:border-neutral-800 rounded-xl overflow-hidden bg-white mb-4 shadow-inner" style={{ height: '400px' }}>
          {/* Sketch Canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="block w-full cursor-crosshair bg-white"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Toolbar controls */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          
          {/* Tool selectors and slider */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-neutral-100 dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/50 dark:border-neutral-800/50">
            {/* Draw vs erase */}
            <div className="flex items-center gap-1.5 bg-neutral-200 dark:bg-neutral-800 p-1 rounded-lg">
              <button
                id="brush-tool-btn"
                onClick={() => setIsEraser(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${!isEraser ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'}`}
              >
                <Circle className="w-3 h-3 fill-current" style={{ color: color }} />
                Pen
              </button>
              <button
                id="eraser-tool-btn"
                onClick={() => setIsEraser(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${isEraser ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800'}`}
              >
                <Eraser className="w-3.5 h-3.5" />
                {t.eraser}
              </button>
            </div>

            {/* Thickness */}
            <div className="flex items-center gap-2 flex-grow max-w-[150px]">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">{t.brush}: {lineWidth}px</span>
              <input 
                id="line-width-slider"
                type="range" 
                min="1" 
                max="25" 
                value={lineWidth} 
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-full accent-yellow-500 cursor-pointer h-1 bg-neutral-300 dark:bg-neutral-700 rounded-lg appearance-none"
              />
            </div>

            {/* Canvas Actions */}
            <div className="flex items-center gap-1.5">
              <button
                id="draw-undo-btn"
                disabled={history.length <= 1}
                onClick={handleUndo}
                className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-40 transition-colors"
                title={t.undo}
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                id="draw-clear-btn"
                onClick={clearCanvas}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title={t.clear}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Color select palette (only active if pen mode is selected) */}
          <div className="flex flex-col gap-2 py-1 w-full">
            <div className="flex items-center gap-2.5 overflow-x-auto">
              <span className="text-xs text-neutral-400 uppercase tracking-widest font-mono">Colors:</span>
              <div className="flex items-center gap-1.5">
                {colorPalette.map((pColor) => (
                  <button
                    key={pColor}
                    id={`canvas-color-${pColor.replace('#', '')}`}
                    onClick={() => handleApplyBrushColor(pColor)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform scale-100 relative flex items-center justify-center ${color === pColor && !isEraser ? 'border-yellow-500 scale-110 shadow' : 'border-transparent'}`}
                    style={{ backgroundColor: pColor }}
                  >
                    {color === pColor && !isEraser && (
                      <Check className={`w-3.5 h-3.5 ${pColor === '#000000' ? 'text-white' : 'text-black'}`} />
                    )}
                  </button>
                ))}
                
                {/* Custom hex wheel picker */}
                <label 
                  id="canvas-custom-color-label"
                  className="w-7 h-7 rounded-full border-2 border-neutral-300 dark:border-neutral-700 relative flex items-center justify-center cursor-pointer shadow hover:scale-105 transition-transform" 
                  style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
                >
                  <input
                    id="canvas-custom-color-picker"
                    type="color"
                    value={color.startsWith('#') && color.length === 7 ? color : '#000000'}
                    onChange={(e) => handleApplyBrushColor(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Recent colors row */}
            {recentBrushColors.length > 0 && (
              <div className="flex items-center gap-2.5 overflow-x-auto border-t border-neutral-100 dark:border-neutral-900/60 pt-2 animate-in fade-in duration-200">
                <span className="text-[10px] text-neutral-400 uppercase tracking-widest font-mono">Recent:</span>
                <div className="flex items-center gap-1.5 font-sans">
                  {recentBrushColors.map((rColor, idx) => (
                    <button
                      key={`${rColor}-${idx}`}
                      id={`canvas-recent-${rColor.replace('#', '')}-${idx}`}
                      onClick={() => handleApplyBrushColor(rColor)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform scale-100 relative flex items-center justify-center ${color === rColor && !isEraser ? 'border-yellow-500 scale-110 shadow' : 'border-transparent'}`}
                      style={{ backgroundColor: rColor }}
                      title={`Recente ${idx + 1}`}
                    >
                      {color === rColor && !isEraser && (
                        <Check className="w-3.5 h-3.5 text-white mix-blend-difference" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            id="draw-cancel-btn"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            {t.cancel}
          </button>
          <button
            id="draw-save-btn"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-yellow-500 hover:bg-yellow-600 text-neutral-900 shadow-lg shadow-yellow-500/10 transition-colors"
          >
            {t.save}
          </button>
        </div>

      </div>
    </div>
  );
}
