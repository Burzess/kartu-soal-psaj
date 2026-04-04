// WMF to PNG converter using wmf (SheetJS)
// This runs on client-side only (requires Canvas)

import { ExtractedImage } from './parser';

// Dynamic import to avoid SSR issues
let WMF: {
  image_size: (data: ArrayBuffer | Uint8Array) => [number, number];
  draw_canvas: (data: ArrayBuffer | Uint8Array, canvas: HTMLCanvasElement | OffscreenCanvas) => void;
} | null = null;

async function getWMF() {
  if (WMF) return WMF;
  
  try {
    const module = await import('wmf');
    WMF = module.default || module;
    return WMF;
  } catch (e) {
    console.warn('Failed to load wmf:', e);
    return null;
  }
}

/**
 * Try to extract DIB/BMP from WMF data
 * Many RTF files embed BMP inside WMF wrapper
 */
function extractDibFromWmf(bytes: Uint8Array): { data: Uint8Array; width: number; height: number; bpp: number } | null {
  // Look for BITMAPINFOHEADER signature (size = 40 = 0x28)
  // The DIB header starts with 0x28 0x00 0x00 0x00
  for (let i = 0; i < bytes.length - 40; i++) {
    if (bytes[i] === 0x28 && bytes[i+1] === 0x00 && bytes[i+2] === 0x00 && bytes[i+3] === 0x00) {
      // Found potential BITMAPINFOHEADER
      const headerSize = bytes[i] | (bytes[i+1] << 8) | (bytes[i+2] << 16) | (bytes[i+3] << 24);
      if (headerSize !== 40) continue; // Standard BITMAPINFOHEADER is 40 bytes
      
      // Read width (signed 32-bit at offset 4)
      const width = bytes[i+4] | (bytes[i+5] << 8) | (bytes[i+6] << 16) | (bytes[i+7] << 24);
      // Read height (signed 32-bit at offset 8)
      let height = bytes[i+8] | (bytes[i+9] << 8) | (bytes[i+10] << 16) | (bytes[i+11] << 24);
      // Height can be negative (top-down DIB)
      if (height > 0x7FFFFFFF) height = height - 0x100000000;
      const absHeight = Math.abs(height);
      
      // Read bits per pixel (16-bit at offset 14)
      const bitsPerPixel = bytes[i+14] | (bytes[i+15] << 8);
      
      // Support 1, 4, 8, 24, and 32 bit images
      if (width > 0 && width < 10000 && absHeight > 0 && absHeight < 10000 && 
          (bitsPerPixel === 1 || bitsPerPixel === 4 || bitsPerPixel === 8 || 
           bitsPerPixel === 24 || bitsPerPixel === 32)) {
        // Looks valid! Extract DIB data
        console.log(`Found DIB: ${width}x${absHeight}, ${bitsPerPixel}bpp at offset ${i}`);
        return {
          data: bytes.slice(i),
          width,
          height: absHeight,
          bpp: bitsPerPixel
        };
      }
    }
  }
  return null;
}

/**
 * Render DIB to canvas and return PNG data URL
 */
function renderDibToCanvas(dibData: Uint8Array, width: number, height: number): string | null {
  try {
    // Parse BITMAPINFOHEADER
    const bitsPerPixel = dibData[14] | (dibData[15] << 8);
    const compression = dibData[16] | (dibData[17] << 8) | (dibData[18] << 16) | (dibData[19] << 24);
    
    // Only support uncompressed (BI_RGB = 0)
    if (compression !== 0) {
      console.warn('DIB compression not supported:', compression);
      return null;
    }
    
    // Calculate row padding (rows must be 4-byte aligned)
    const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
    
    // Pixel data starts after header (40 bytes for BITMAPINFOHEADER)
    // Plus color table for paletted images
    let dataOffset = 40;
    let colorTable: Uint8Array | null = null;
    
    if (bitsPerPixel === 1) {
      // 1-bit (monochrome) has 2 color palette
      colorTable = dibData.slice(40, 40 + 2 * 4);
      dataOffset = 40 + 2 * 4;
    } else if (bitsPerPixel === 4) {
      // 4-bit image has 16 color palette (4 bytes each: BGRA)
      colorTable = dibData.slice(40, 40 + 16 * 4);
      dataOffset = 40 + 16 * 4;
    } else if (bitsPerPixel === 8) {
      // 8-bit image has 256 color palette (4 bytes each: BGRA)
      colorTable = dibData.slice(40, 40 + 256 * 4);
      dataOffset = 40 + 256 * 4;
    }
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const imageData = ctx.createImageData(width, height);
    
    // DIB is stored bottom-up by default
    for (let y = 0; y < height; y++) {
      const srcY = height - 1 - y; // Flip vertically
      const srcRowStart = dataOffset + srcY * rowSize;
      
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) * 4;
        
        if (bitsPerPixel === 24) {
          const srcIdx = srcRowStart + x * 3;
          imageData.data[dstIdx + 0] = dibData[srcIdx + 2]; // R (BGR -> RGB)
          imageData.data[dstIdx + 1] = dibData[srcIdx + 1]; // G
          imageData.data[dstIdx + 2] = dibData[srcIdx + 0]; // B
          imageData.data[dstIdx + 3] = 255; // A
        } else if (bitsPerPixel === 32) {
          const srcIdx = srcRowStart + x * 4;
          imageData.data[dstIdx + 0] = dibData[srcIdx + 2]; // R
          imageData.data[dstIdx + 1] = dibData[srcIdx + 1]; // G
          imageData.data[dstIdx + 2] = dibData[srcIdx + 0]; // B
          imageData.data[dstIdx + 3] = 255; // A (ignore alpha in source)
        } else if (bitsPerPixel === 8 && colorTable) {
          const srcIdx = srcRowStart + x;
          const paletteIdx = dibData[srcIdx] * 4;
          imageData.data[dstIdx + 0] = colorTable[paletteIdx + 2]; // R
          imageData.data[dstIdx + 1] = colorTable[paletteIdx + 1]; // G
          imageData.data[dstIdx + 2] = colorTable[paletteIdx + 0]; // B
          imageData.data[dstIdx + 3] = 255; // A
        } else if (bitsPerPixel === 4 && colorTable) {
          // 4-bit: 2 pixels per byte (high nibble first)
          const srcIdx = srcRowStart + Math.floor(x / 2);
          const nibble = (x % 2 === 0) 
            ? (dibData[srcIdx] >> 4) & 0x0F  // High nibble
            : dibData[srcIdx] & 0x0F;         // Low nibble
          const paletteIdx = nibble * 4;
          imageData.data[dstIdx + 0] = colorTable[paletteIdx + 2]; // R
          imageData.data[dstIdx + 1] = colorTable[paletteIdx + 1]; // G
          imageData.data[dstIdx + 2] = colorTable[paletteIdx + 0]; // B
          imageData.data[dstIdx + 3] = 255; // A
        } else if (bitsPerPixel === 1 && colorTable) {
          // 1-bit: 8 pixels per byte (MSB first)
          const srcIdx = srcRowStart + Math.floor(x / 8);
          const bitPos = 7 - (x % 8); // MSB first
          const bit = (dibData[srcIdx] >> bitPos) & 0x01;
          const paletteIdx = bit * 4;
          imageData.data[dstIdx + 0] = colorTable[paletteIdx + 2]; // R
          imageData.data[dstIdx + 1] = colorTable[paletteIdx + 1]; // G
          imageData.data[dstIdx + 2] = colorTable[paletteIdx + 0]; // B
          imageData.data[dstIdx + 3] = 255; // A
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  } catch (e) {
    console.warn('Failed to render DIB:', e);
    return null;
  }
}

/**
 * Convert WMF/EMF images to PNG data URLs
 * @param images - Array of extracted images from RTF parser
 * @returns Array of images with WMF/EMF converted to PNG
 */
export async function convertWmfEmfToPng(images: ExtractedImage[]): Promise<ExtractedImage[]> {
  const wmf = await getWMF();
  const convertedImages: ExtractedImage[] = [];
  
  for (const img of images) {
    if (img.format === 'wmf') {
      try {
        // Extract base64 data from data URL
        const base64Match = img.data.match(/base64,(.+)$/);
        if (!base64Match) {
          convertedImages.push(img);
          continue;
        }
        
        const base64Data = base64Match[1];
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // First, try to extract embedded DIB/BMP
        const dib = extractDibFromWmf(bytes);
        if (dib) {
          console.log(`📦 Found embedded DIB in ${img.id}: ${dib.width}x${dib.height}`);
          const pngDataUrl = renderDibToCanvas(dib.data, dib.width, dib.height);
          if (pngDataUrl) {
            convertedImages.push({
              id: img.id,
              data: pngDataUrl,
              format: 'png'
            });
            console.log(`✅ Converted ${img.id} from WMF/DIB to PNG`);
            continue;
          }
        }
        
        // Fallback: try wmf library
        if (wmf) {
          let size: [number, number];
          try {
            size = wmf.image_size(bytes);
          } catch (e) {
            console.warn(`Could not get size for ${img.id}, using default`);
            size = [400, 300];
          }
          
          const width = Math.min(Math.max(size[0], 50), 800);
          const height = Math.min(Math.max(size[1], 50), 600);
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
          }
          
          try {
            wmf.draw_canvas(bytes, canvas);
            const pngDataUrl = canvas.toDataURL('image/png');
            
            if (pngDataUrl && pngDataUrl.startsWith('data:image')) {
              convertedImages.push({
                id: img.id,
                data: pngDataUrl,
                format: 'png'
              });
              console.log(`✅ Converted ${img.id} from WMF to PNG via wmf library`);
              continue;
            }
          } catch (e) {
            console.warn(`wmf.draw_canvas failed for ${img.id}:`, e);
          }
        }
        
        // If all else fails, keep original
        console.warn(`⚠️ Could not convert ${img.id}`);
        convertedImages.push(img);
        
      } catch (e) {
        console.warn(`❌ Failed to convert ${img.id}:`, e);
        convertedImages.push(img);
      }
    } else if (img.format === 'emf') {
      console.warn(`⚠️ EMF format not supported for ${img.id}`);
      convertedImages.push(img);
    } else {
      convertedImages.push(img);
    }
  }
  
  return convertedImages;
}

/**
 * Check if an image needs conversion (is WMF/EMF format)
 */
export function needsConversion(image: ExtractedImage): boolean {
  return image.format === 'wmf' || image.format === 'emf';
}

/**
 * Check if any images in array need conversion
 */
export function hasWmfEmfImages(images: ExtractedImage[]): boolean {
  return images.some(needsConversion);
}
