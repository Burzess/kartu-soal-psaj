// Parser untuk format soal PSAJ
// Support: Plain text paste, RTF text

export interface ExtractedImage {
  id: string;
  data: string; // base64 data URL
  format: 'png' | 'jpeg' | 'wmf' | 'emf' | 'unknown';
}

export interface Question {
  number: number;
  text: string;
  options: {
    a: string;
    b: string;
    c: string;
    d: string;
    e?: string;
  };
  answer: string;
  type: 'PG' | 'URAIAN';
  images?: ExtractedImage[]; // Images associated with this question
}

export interface ParseResult {
  questions: Question[];
  errors: string[];
  images: ExtractedImage[]; // All extracted images
}

export function parseTextToQuestions(text: string): ParseResult {
  const lines = text.split('\n').map(line => line.trim());
  const questions: Question[] = [];
  const errors: string[] = [];
  
  let currentQuestion: Partial<Question> | null = null;
  let currentState: 'question' | 'options' | 'answer' = 'question';
  let isUraianMode = false;
  let allowNumberReset = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line) continue;
    
    // Detect section markers
    if (/ESSAY|URAIAN|SHORT ANSWER/i.test(line)) {
      if (currentQuestion && currentQuestion.number) {
        if (isUraianMode || validateQuestion(currentQuestion)) {
          questions.push(currentQuestion as Question);
        } else {
          errors.push(`Soal ${currentQuestion.number} tidak lengkap`);
        }
      }

      currentQuestion = null;
      currentState = 'question';
      isUraianMode = true;
      allowNumberReset = true;
      continue;
    }
    if (/MULTIPLE CHOICE|PILIHAN GANDA/i.test(line)) {
      if (currentQuestion && currentQuestion.number) {
        if (isUraianMode || validateQuestion(currentQuestion)) {
          questions.push(currentQuestion as Question);
        } else {
          errors.push(`Soal ${currentQuestion.number} tidak lengkap`);
        }
      }

      currentQuestion = null;
      currentState = 'question';
      isUraianMode = false;
      allowNumberReset = true;
      continue;
    }
    
    // Detect question number (1. atau 1) di awal baris)
    const questionMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (questionMatch) {
      const detectedNumber = parseInt(questionMatch[1]);
      const canStartNewQuestion =
        !currentQuestion ||
        detectedNumber > (currentQuestion.number || 0) ||
        (allowNumberReset && detectedNumber === 1);

      if (canStartNewQuestion) {
        // Save previous question if exists
        if (currentQuestion && currentQuestion.number) {
          if (isUraianMode || validateQuestion(currentQuestion)) {
            questions.push(currentQuestion as Question);
          } else {
            errors.push(`Soal ${currentQuestion.number} tidak lengkap`);
          }
        }

        // Start new question
        currentQuestion = {
          number: detectedNumber,
          text: questionMatch[2],
          options: { a: '', b: '', c: '', d: '' },
          answer: '',
          type: isUraianMode ? 'URAIAN' : 'PG'
        };
        currentState = 'question';
        allowNumberReset = false;
        continue;
      }

      // Numbered lines inside question body (e.g. image captions / list points)
      // should be treated as continuation text, not as a new question.
      if (currentQuestion && currentState === 'question') {
        currentQuestion.text = `${currentQuestion.text || ''} ${line}`.trim();
      } else if (currentQuestion && currentQuestion.options && currentState === 'options' && !isUraianMode) {
        const lastOption = findLastOption(currentQuestion.options);
        if (lastOption) {
          currentQuestion.options[lastOption] += ' ' + line;
        }
      }
      continue;
    }
    
    // For URAIAN, only collect text and answer
    if (isUraianMode && currentQuestion) {
      // Detect answer key
      const answerMatch = line.match(/^(ANS|ANSWER|JAWABAN|KUNCI|PEMBAHASAN)\s*[:.-]?\s*(.*)$/i);
      if (answerMatch) {
        const firstAnswerLine = answerMatch[2].trim();
        if (firstAnswerLine) {
          currentQuestion.answer = firstAnswerLine;
        }
        currentState = 'answer';
        continue;
      }
      
      // Continue question text
      if (currentState === 'question') {
        if (!line.match(/^(ANS|ANSWER|JAWABAN|KUNCI|PEMBAHASAN)/i)) {
          currentQuestion.text += ' ' + line;
        }
      } else if (currentState === 'answer') {
        currentQuestion.answer = currentQuestion.answer
          ? `${currentQuestion.answer}\n${line}`
          : line;
      }
      continue;
    }
    
    // For PG, detect options
    const optionMatch = line.match(/^([a-eA-E])[.)]\s+(.+)$/);
    if (optionMatch && currentQuestion && !isUraianMode) {
      const optLetter = optionMatch[1].toLowerCase();
      currentQuestion.options = currentQuestion.options || { a: '', b: '', c: '', d: '' };
      currentQuestion.options[optLetter as 'a' | 'b' | 'c' | 'd' | 'e'] = optionMatch[2];
      currentState = 'options';
      continue;
    }
    
    // Detect answer key - flexible format
    const answerMatch = line.match(/^(ANS|ANSWER|JAWABAN|KUNCI)\s*:?\s*([a-eA-E])(\s|$)/i);
    if (answerMatch && currentQuestion) {
      currentQuestion.answer = answerMatch[2].toUpperCase();
      currentState = 'answer';
      continue;
    }
    
    // Continue question text (multiline)
    if (currentState === 'question' && currentQuestion && currentQuestion.text) {
      if (!line.match(/^[a-eA-E][.)]/) && !line.match(/^(ANS|ANSWER|JAWABAN|KUNCI)/i)) {
        currentQuestion.text += ' ' + line;
      }
    }
    
    // Continue option text (multiline)
    if (currentState === 'options' && currentQuestion && currentQuestion.options && !isUraianMode) {
      if (!line.match(/^[a-eA-E][.)]/) && !line.match(/^(ANS|ANSWER|JAWABAN|KUNCI)/i)) {
        const lastOption = findLastOption(currentQuestion.options);
        if (lastOption) {
          currentQuestion.options[lastOption] += ' ' + line;
        }
      }
    }
  }
  
  // Save last question
  if (currentQuestion && currentQuestion.number) {
    if (isUraianMode || validateQuestion(currentQuestion)) {
      questions.push(currentQuestion as Question);
    } else {
      errors.push(`Soal ${currentQuestion.number} tidak lengkap`);
    }
  }
  
  return { questions, errors, images: [] };
}

function validateQuestion(q: Partial<Question>): q is Question {
  return !!(
    q.number &&
    q.text &&
    q.options &&
    q.options.a &&
    q.options.b &&
    q.options.c &&
    q.options.d &&
    q.answer
  );
}

function findLastOption(options: any): 'a' | 'b' | 'c' | 'd' | 'e' | null {
  if (options.e) return 'e';
  if (options.d) return 'd';
  if (options.c) return 'c';
  if (options.b) return 'b';
  if (options.a) return 'a';
  return null;
}

// Extract images from RTF and return them with placeholder markers
export function extractImagesFromRTF(rtfText: string): { text: string; images: ExtractedImage[] } {
  const images: ExtractedImage[] = [];
  let imageCounter = 0;
  let text = rtfText;
  
  // Pattern to match picture data blocks
  // RTF images are in format: {\pict\wmetafile8\picw...\pich... HEXDATA}
  // or with specific format markers: \pngblip, \jpegblip, \wmetafile, \emfblip
  
  // First, find and extract all picture blocks
  const pictPattern = /\{\\pict([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gi;
  
  text = text.replace(pictPattern, (match, pictContent) => {
    imageCounter++;
    const imageId = `IMG_${imageCounter}`;
    
    // Determine image format
    // Note: \wmetafile8 with \picbmp means it's actually BMP data wrapped in metafile
    let format: ExtractedImage['format'] = 'unknown';
    const hasPicBmp = /\\picbmp/i.test(pictContent);
    
    if (/\\pngblip/i.test(pictContent)) format = 'png';
    else if (/\\jpegblip/i.test(pictContent)) format = 'jpeg';
    else if (/\\wmetafile/i.test(pictContent)) {
      // Check if it's BMP wrapped in metafile or real WMF
      format = hasPicBmp ? 'wmf' : 'wmf';
    }
    else if (/\\emfblip/i.test(pictContent)) format = 'emf';
    
    // Extract hex data (the actual image bytes)
    // The hex data comes after all control words
    // Find where control words end and hex data begins
    let hexData = pictContent
      .replace(/\\[a-z]+(-?\d+)?/gi, '') // Remove control words
      .replace(/\s+/g, '') // Remove whitespace
      .replace(/[^0-9a-fA-F]/g, ''); // Keep only hex chars
    
    if (hexData.length > 100) { // Must have substantial data to be a real image
      // Convert hex to base64
      try {
        // For PNG and JPEG, we can directly convert
        if (format === 'png' || format === 'jpeg') {
          const bytes = hexToBytes(hexData);
          const base64 = bytesToBase64(bytes);
          const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
          
          images.push({
            id: imageId,
            data: `data:${mimeType};base64,${base64}`,
            format
          });
        } else if (format === 'wmf' || format === 'emf') {
          // WMF/EMF are Windows-specific formats
          // We'll still try to extract but mark as wmf/emf
          // Browsers can't display these directly, but we store the data
          const bytes = hexToBytes(hexData);
          const base64 = bytesToBase64(bytes);
          
          images.push({
            id: imageId,
            data: `data:application/octet-stream;base64,${base64}`,
            format
          });
        } else {
          // Try to detect format from magic bytes
          const detected = detectImageFormat(hexData);
          if (detected) {
            const bytes = hexToBytes(hexData);
            const base64 = bytesToBase64(bytes);
            
            let mimeType = 'application/octet-stream';
            if (detected === 'png') mimeType = 'image/png';
            else if (detected === 'jpeg') mimeType = 'image/jpeg';
            
            images.push({
              id: imageId,
              data: `data:${mimeType};base64,${base64}`,
              format: detected
            });
          }
        }
      } catch (e) {
        console.warn('Failed to extract image:', e);
      }
    }
    
    return ` [${imageId}] `;
  });
  
  // Also handle loose hex data that might be images (from different RTF structures)
  // Look for long hex sequences preceded by picture-related control words
  text = text.replace(/\\(pngblip|jpegblip|wmetafile\d*|emfblip)\s*([0-9a-fA-F\s]{100,})/gi, (match, formatWord, hexData) => {
    imageCounter++;
    const imageId = `IMG_${imageCounter}`;
    
    let format: ExtractedImage['format'] = 'unknown';
    if (/pngblip/i.test(formatWord)) format = 'png';
    else if (/jpegblip/i.test(formatWord)) format = 'jpeg';
    else if (/wmetafile/i.test(formatWord)) format = 'wmf';
    else if (/emfblip/i.test(formatWord)) format = 'emf';
    
    const cleanHex = hexData.replace(/\s+/g, '');
    
    try {
      if (format === 'png' || format === 'jpeg') {
        const bytes = hexToBytes(cleanHex);
        const base64 = bytesToBase64(bytes);
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        
        images.push({
          id: imageId,
          data: `data:${mimeType};base64,${base64}`,
          format
        });
      }
    } catch (e) {
      console.warn('Failed to extract loose image:', e);
    }
    
    return ` [${imageId}] `;
  });
  
  // Clean remaining long hex sequences (likely images we couldn't parse)
  text = text.replace(/[0-9a-f]{200,}/gi, ' [GAMBAR] ');
  
  return { text, images };
}

// Helper: Convert hex string to byte array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Helper: Convert bytes to base64
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // Use btoa if available (browser), otherwise manual encoding
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  // Node.js fallback
  return Buffer.from(bytes).toString('base64');
}

// Windows-1252 to Unicode mapping for characters 0x80-0x9F
// These are the characters that differ from Latin-1
const WINDOWS_1252_MAP: { [key: number]: string } = {
  0x80: '\u20AC', // Euro sign €
  0x82: '\u201A', // Single low-9 quotation mark ‚
  0x83: '\u0192', // Latin small letter f with hook ƒ
  0x84: '\u201E', // Double low-9 quotation mark „
  0x85: '\u2026', // Horizontal ellipsis …
  0x86: '\u2020', // Dagger †
  0x87: '\u2021', // Double dagger ‡
  0x88: '\u02C6', // Modifier letter circumflex accent ˆ
  0x89: '\u2030', // Per mille sign ‰
  0x8A: '\u0160', // Latin capital letter S with caron Š
  0x8B: '\u2039', // Single left-pointing angle quotation mark ‹
  0x8C: '\u0152', // Latin capital ligature OE Œ
  0x8E: '\u017D', // Latin capital letter Z with caron Ž
  0x91: '\u2018', // Left single quotation mark '
  0x92: '\u2019', // Right single quotation mark '
  0x93: '\u201C', // Left double quotation mark "
  0x94: '\u201D', // Right double quotation mark "
  0x95: '\u2022', // Bullet •
  0x96: '\u2013', // En dash –
  0x97: '\u2014', // Em dash —
  0x98: '\u02DC', // Small tilde ˜
  0x99: '\u2122', // Trade mark sign ™
  0x9A: '\u0161', // Latin small letter s with caron š
  0x9B: '\u203A', // Single right-pointing angle quotation mark ›
  0x9C: '\u0153', // Latin small ligature oe œ
  0x9E: '\u017E', // Latin small letter z with caron ž
  0x9F: '\u0178', // Latin capital letter Y with diaeresis Ÿ
};

// Decode Windows-1252 character code to Unicode string
function decodeWindows1252(code: number): string {
  // Check if it's a special Windows-1252 character
  if (code >= 0x80 && code <= 0x9F && WINDOWS_1252_MAP[code]) {
    return WINDOWS_1252_MAP[code];
  }
  // Otherwise, it's the same as Latin-1
  return String.fromCharCode(code);
}

// Helper: Detect image format from magic bytes
function detectImageFormat(hexData: string): 'png' | 'jpeg' | 'wmf' | 'emf' | null {
  const header = hexData.substring(0, 16).toLowerCase();
  
  // PNG magic: 89 50 4E 47 0D 0A 1A 0A
  if (header.startsWith('89504e47')) return 'png';
  
  // JPEG magic: FF D8 FF
  if (header.startsWith('ffd8ff')) return 'jpeg';
  
  // EMF magic: 01 00 00 00 (EMR_HEADER record type = 1)
  // More reliable check: look for EMF signature at offset 40
  if (hexData.length > 88) {
    const emfSig = hexData.substring(80, 88).toLowerCase();
    if (emfSig === '454d4600') return 'emf'; // " EMF" signature
  }
  if (header.startsWith('01000000')) return 'emf';
  
  // WMF magic: D7 CD C6 9A (Aldus Placeable Metafile header)
  if (header.startsWith('d7cdc69a')) return 'wmf';
  
  // Standard WMF: 01 00 09 00 (metafile type 1, header size 9 words)
  if (header.startsWith('01000900')) return 'wmf';
  
  return null;
}

// Parse RTF to plain text - Smart filtering
export function parseRTF(rtfText: string): { text: string; images: ExtractedImage[] } {
  // Step 0: Extract images FIRST (before cleaning)
  const { text: textWithMarkers, images } = extractImagesFromRTF(rtfText);
  let text = textWithMarkers;
  
  // Step 1: Remove header sections
  text = text.replace(/\{\\rtf1[^\{]*?\{\\fonttbl[\s\S]*?\}\}/g, '');
  text = text.replace(/\{\\colortbl[\s\S]*?\}/g, '');
  text = text.replace(/\{\\stylesheet[\s\S]*?\}/g, '');
  text = text.replace(/\{\\info[\s\S]*?\}/g, '');
  
  // Step 2: Table handling
  text = text.replace(/\\cell\s*/g, '\n');
  text = text.replace(/\\row\s*/g, '\n');
  text = text.replace(/\\trowd[^\\\{]*?(?=\\|{)/g, '');
  text = text.replace(/\\clvertalt/g, '');
  text = text.replace(/\\cellx\d+/g, '');
  text = text.replace(/\\intbl/g, '');
  
  // Step 3: Replace RTF codes
  text = text.replace(/\\par\s*/g, '\n');
  text = text.replace(/\\tab\s*/g, ' ');
  
  // Step 4: Special characters - Handle Windows-1252 encoding (common in Indonesian RTF)
  // RTF uses \'XX for hex-encoded characters
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (match, hex) => {
    const code = parseInt(hex, 16);
    return decodeWindows1252(code);
  });
  
  // Also handle Unicode escapes \uXXXX
  text = text.replace(/\\u(-?\d+)\s*\??/g, (match, code) => {
    const charCode = parseInt(code);
    // Negative values are used for characters > 32767
    const actualCode = charCode < 0 ? charCode + 65536 : charCode;
    return String.fromCharCode(actualCode);
  });
  
  // Step 5: Remove control words
  text = text.replace(/\\[a-z]+(-?\d+)?(\s+|(?=[\\{}\n]))/gi, ' ');
  text = text.replace(/\\[^a-z\s]/gi, '');
  
  // Step 6: Extract from braces
  let iterations = 0;
  while (text.includes('{') && iterations < 100) {
    text = text.replace(/\{([^{}]*)\}/g, '$1');
    iterations++;
  }
  text = text.replace(/[{}]/g, '');
  
  // Step 7: Remove table markers
  text = text.replace(/x\d+/g, '');
  
  // Step 8: Clean multiple spaces
  text = text.replace(/[ \t]+/g, ' ');
  
  // Step 9: Split, clean, and merge lines intelligently
  const rawLines = text.split('\n');
  const cleanLines: string[] = [];
  
  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();
    
    // Skip empty
    if (!line) continue;
    
    // Skip standalone "d" that's NOT "d."
    if (line === 'd') continue;
    
    // Skip lines that are mostly hex data (leftover from images)
    // If line is > 80% hex characters and longer than 20 chars, skip it
    if (line.length > 20) {
      const hexCount = (line.match(/[0-9a-f]/gi) || []).length;
      if (hexCount / line.length > 0.8) continue;
    }
    
    // Skip lines that are just "[GAMBAR]" repeated
    if (line.replace(/\[GAMBAR\]/g, '').trim() === '') {
      cleanLines.push('[GAMBAR]');
      continue;
    }
    
    // Clean multiple [GAMBAR] markers into one
    line = line.replace(/(\[GAMBAR\]\s*)+/g, '[GAMBAR] ');
    
    // If line is just "a." through "e.", merge with next line
    if (/^[a-e]\.$/.test(line) && i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1].trim();
      if (nextLine && nextLine !== 'd') {
        line = line + ' ' + nextLine;
        i++; // Skip next line since we merged
      }
    }
    
    cleanLines.push(line);
  }
  
  // Step 10: Final cleanup
  text = cleanLines.join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Final: merge consecutive [GAMBAR] into one
  text = text.replace(/(\[GAMBAR\]\n?)+/g, '[GAMBAR]\n');
  
  return { text: text.trim(), images };
}
