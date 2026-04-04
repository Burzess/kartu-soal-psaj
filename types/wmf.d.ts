declare module 'wmf' {
  interface WMFModule {
    /**
     * Extracts the image offset and extents
     * @param data - ArrayBuffer, Uint8Array or Buffer containing WMF data
     * @returns [width, height] in pixels
     */
    image_size(data: ArrayBuffer | Uint8Array): [number, number];
    
    /**
     * Parses the WMF and draws to a Canvas
     * @param data - ArrayBuffer, Uint8Array or Buffer containing WMF data
     * @param canvas - Canvas element to draw on
     */
    draw_canvas(data: ArrayBuffer | Uint8Array, canvas: HTMLCanvasElement | OffscreenCanvas): void;
  }
  
  const wmf: WMFModule;
  export default wmf;
  export = wmf;
}
