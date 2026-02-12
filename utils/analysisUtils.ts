import { Rect, Profile } from '../types';
import { MOCK_DATABASE } from '../services/mockDatabase';

export const analyzeLazyRedaction = (
  canvas: HTMLCanvasElement, 
  rect: Rect
): boolean => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const imageData = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
  const data = imageData.data;
  
  let nonBlackPixels = 0;
  const totalPixels = rect.w * rect.h;
  const threshold = 30; // Brightness threshold to consider "not black"

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Check luminance
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // If it's not super dark, it might be an artifact (lazy redaction)
    // We also ignore pure white background pixels if the box isn't perfectly tight
    if (luminance > threshold && luminance < 250) {
      nonBlackPixels++;
    }
  }

  // If more than 5% of the pixels are suspicious, flag it
  return (nonBlackPixels / totalPixels) > 0.05;
};

export const detectRedactionAtPoint = (
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number
): Rect | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const w = canvas.width;
  const h = canvas.height;

  // Safety check bounds
  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return null;

  // Get full image data (optimized for multiple pixel lookups)
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  // Helper to check darkness at coordinates
  // Returns true if pixel is "dark" (likely redaction)
  const isDark = (x: number, y: number) => {
     if (x < 0 || x >= w || y < 0 || y >= h) return false;
     const idx = (Math.floor(y) * w + Math.floor(x)) * 4;
     const r = data[idx];
     const g = data[idx+1];
     const b = data[idx+2];
     const lum = 0.299 * r + 0.587 * g + 0.114 * b;
     return lum < 60; // Dark threshold
  };

  // 1. Validate start point
  if (!isDark(startX, startY)) return null;

  // Iterative Scanline Approach (O(W+H))
  // This is much faster than flood fill and works well for rectangular blocks

  // Step 2: Scan Horizontal from Start Point
  let minX = Math.floor(startX);
  let maxX = Math.floor(startX);
  
  while (minX > 0 && isDark(minX - 1, startY)) minX--;
  while (maxX < w - 1 && isDark(maxX + 1, startY)) maxX++;

  // Step 3: Find Center X and Scan Vertical
  const centerX = Math.floor((minX + maxX) / 2);
  let minY = Math.floor(startY);
  let maxY = Math.floor(startY);

  while (minY > 0 && isDark(centerX, minY - 1)) minY--;
  while (maxY < h - 1 && isDark(centerX, maxY + 1)) maxY++;

  // Step 4: Find Center Y and Re-Scan Horizontal (Refinement)
  // This corrects if the user clicked near the edge of a non-perfectly aligned box
  const centerY = Math.floor((minY + maxY) / 2);
  let refinedMinX = centerX;
  let refinedMaxX = centerX;

  while (refinedMinX > 0 && isDark(refinedMinX - 1, centerY)) refinedMinX--;
  while (refinedMaxX < w - 1 && isDark(refinedMaxX + 1, centerY)) refinedMaxX++;

  // Create Rect with small padding
  const padding = 0; 
  const rect = {
      x: refinedMinX - padding,
      y: minY - padding,
      w: (refinedMaxX - refinedMinX) + (padding * 2),
      h: (maxY - minY) + (padding * 2)
  };

  // Minimum size sanity check
  if (rect.w < 5 || rect.h < 5) return null;

  return rect;
};

export const estimateHiddenCharacters = (
  redactionW: number,
  referenceW: number,
  referenceTextLength: number
): number => {
  if (referenceTextLength === 0) return 0;
  const avgCharWidth = referenceW / referenceTextLength;
  return Math.round(redactionW / avgCharWidth);
};

export const generateEvidenceImage = (
  originalCanvas: HTMLCanvasElement,
  redactionRect: Rect,
  match: Profile
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = originalCanvas.width;
  canvas.height = originalCanvas.height + 150; // Add space for footer
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Draw original image
  ctx.drawImage(originalCanvas, 0, 0);

  // Draw Footer Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, originalCanvas.height, canvas.width, 150);
  
  // Footer Border
  ctx.strokeStyle = '#00ff41';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, originalCanvas.height);
  ctx.lineTo(canvas.width, originalCanvas.height);
  ctx.stroke();

  // Footer Text
  ctx.font = 'bold 20px "JetBrains Mono"';
  ctx.fillStyle = '#00ff41';
  ctx.fillText('UNDACTED ANALYSIS REPORT', 20, originalCanvas.height + 40);

  ctx.font = '16px "JetBrains Mono"';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`SUBJECT MATCH: ${match.name.toUpperCase()}`, 20, originalCanvas.height + 75);
  ctx.fillText(`ROLE: ${match.role} | CLEARANCE: ${match.clearance}`, 20, originalCanvas.height + 100);

  ctx.font = 'italic 12px "JetBrains Mono"';
  ctx.fillStyle = '#666666';
  ctx.fillText("DISCLAIMER: Hypothetical determination created by AI. Not an official legal document. Educational purposes only.", 20, originalCanvas.height + 135);

  // Overlay Revealed Text
  if (redactionRect) {
      ctx.font = `bold ${redactionRect.h * 0.7}px "JetBrains Mono"`; // Estimate font size
      ctx.fillStyle = '#00ff41';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const centerX = redactionRect.x + (redactionRect.w / 2);
      const centerY = redactionRect.y + (redactionRect.h / 2);
      
      ctx.fillText(match.name, centerX, centerY);
  }

  return canvas.toDataURL('image/png');
};