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
  let answerKeyStartIndex = -1;

  // Pre-scan: find Answer Key / Answer Section
  for (let i = 0; i < lines.length; i++) {
    if (/^(ANSWER\s*KEY|ANSWER\s*SECTION|KUNCI\s*JAWABAN)/i.test(lines[i]) ||
        /Answer\s*Section/i.test(lines[i])) {
      answerKeyStartIndex = i;
      break;
    }
  }

  const parseEndIndex = answerKeyStartIndex >= 0 ? answerKeyStartIndex : lines.length;
  
  for (let i = 0; i < parseEndIndex; i++) {
    const line = lines[i];
    
    // Skip empty lines
    if (!line) continue;
    
    // Detect section markers
    if (/ESSAY|URAIAN|SHORT ANSWER/i.test(line)) {
      if (currentQuestion && currentQuestion.number) {
        if (isUraianMode || validateQuestion(currentQuestion) || validateQuestionPartial(currentQuestion)) {
          questions.push(finalizeQuestion(currentQuestion));
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
    if (/^Multiple\s*Choice$|^PILIHAN\s*GANDA$/i.test(line)) {
      if (currentQuestion && currentQuestion.number) {
        if (isUraianMode || validateQuestion(currentQuestion) || validateQuestionPartial(currentQuestion)) {
          questions.push(finalizeQuestion(currentQuestion));
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
    
    // Detect question number — also handles ExamView Test format "____ 1. text"
    const cleanedLine = line.replace(/^_+\s*/, '');
    const questionMatch = cleanedLine.match(/^(\d+)[.)]\s+(.+)$/);
    if (questionMatch) {
      const detectedNumber = parseInt(questionMatch[1]);
      const canStartNewQuestion =
        !currentQuestion ||
        detectedNumber > (currentQuestion.number || 0) ||
        (allowNumberReset && detectedNumber === 1);

      if (canStartNewQuestion) {
        // Save previous question if exists
        if (currentQuestion && currentQuestion.number) {
          if (isUraianMode || validateQuestion(currentQuestion) || validateQuestionPartial(currentQuestion)) {
            questions.push(finalizeQuestion(currentQuestion));
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

      // Numbered lines inside question body
      if (currentQuestion && currentState === 'question') {
        currentQuestion.text = `${currentQuestion.text || ''}\n${line}`.trim();
      } else if (currentQuestion && currentQuestion.options && currentState === 'options' && !isUraianMode) {
        const lastOption = findLastOption(currentQuestion.options);
        if (lastOption) {
          currentQuestion.options[lastOption] += '\n' + line;
        }
      }
      continue;
    }
    
    // For URAIAN, only collect text and answer
    if (isUraianMode && currentQuestion) {
      const answerMatch = line.match(/^(ANS|ANSWER|JAWABAN|KUNCI|PEMBAHASAN)\s*[:.-]?\s*(.*)$/i);
      if (answerMatch) {
        const firstAnswerLine = answerMatch[2].trim();
        if (firstAnswerLine) {
          currentQuestion.answer = firstAnswerLine;
        }
        currentState = 'answer';
        continue;
      }
      
      if (line.match(/^PTS\s*[:.-]?\s*\d+/i)) {
        continue;
      }
      
      // Continue question text
      if (currentState === 'question') {
        if (!line.match(/^(ANS|ANSWER|JAWABAN|KUNCI|PEMBAHASAN|PTS)/i)) {
          const isPointLine = line.match(/^\s*(\d+|[a-zA-Z])[.)]\s+.+/);
          if (isPointLine) {
            currentQuestion.text = (currentQuestion.text || '') + '\n' + line.trim();
          } else {
            currentQuestion.text = (currentQuestion.text || '') + ' ' + line;
          }
          currentQuestion.text = currentQuestion.text.trim();
        }
      } else if (currentState === 'answer') {
        if (!line.match(/^\d+[.)]\s+/) && !line.match(/^(PTS|ESSAY|URAIAN|SHORT ANSWER)/i)) {
          const isPointLine = line.match(/^\s*(\d+|[a-zA-Z])[.)]\s+.+/);
          if (isPointLine || currentQuestion.answer) {
            currentQuestion.answer = currentQuestion.answer
              ? `${currentQuestion.answer}\n${line}`
              : line;
          } else {
            currentQuestion.answer = line;
          }
        }
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
    if (isUraianMode || validateQuestion(currentQuestion) || validateQuestionPartial(currentQuestion)) {
      questions.push(finalizeQuestion(currentQuestion));
    } else {
      errors.push(`Soal ${currentQuestion.number} tidak lengkap`);
    }
  }

  // Phase 2: Parse Answer Key section and merge answers
  // Debug: show lines that might contain answer section
  const answerRelatedLines = lines.map((l, i) => ({ i, l })).filter(x => /answer|section|kunci|key/i.test(x.l));
  console.error('[DEBUG][PARSE] Answer Key scan', { 
    answerKeyStartIndex, totalLines: lines.length,
    answerRelatedLines: answerRelatedLines.slice(0, 10),
    last15: lines.slice(-15)
  });
  if (answerKeyStartIndex >= 0) {
    const answerMap = parseAnswerKeySection(lines, answerKeyStartIndex + 1);
    console.error('[DEBUG][PARSE] Answer Key parsed', { answerMapSize: answerMap.size, sample: Array.from(answerMap.entries()).slice(0, 5) });
    if (answerMap.size > 0) {
      for (const q of questions) {
        if (!q.answer && answerMap.has(q.number)) {
          q.answer = answerMap.get(q.number)!;
        }
      }
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

// Partial validation: has text and at least some options (answer may come from Answer Key later)
function validateQuestionPartial(q: Partial<Question>): boolean {
  return !!(
    q.number &&
    q.text &&
    q.options &&
    (q.options.a || q.options.b || q.options.c || q.options.d)
  );
}

// Safely cast partial question to full Question with defaults
function finalizeQuestion(q: Partial<Question>): Question {
  return {
    number: q.number || 0,
    text: q.text || '',
    options: {
      a: q.options?.a || '',
      b: q.options?.b || '',
      c: q.options?.c || '',
      d: q.options?.d || '',
      ...(q.options?.e ? { e: q.options.e } : {})
    },
    answer: q.answer || '',
    type: q.type || 'PG',
    ...(q.images ? { images: q.images } : {})
  };
}

// Parse Answer Key section from ExamView Test export
// Supports formats: "1. B", "1. ANS: B", "1) B", multi-column tables
function parseAnswerKeySection(lines: string[], startIndex: number): Map<number, string> {
  const answerMap = new Map<number, string>();

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip section type headers within the answer section (e.g. "MULTIPLE CHOICE", "ESSAY")
    if (/^(MULTIPLE\s*CHOICE|ESSAY|URAIAN|SHORT\s*ANSWER|PILIHAN\s*GANDA)/i.test(line)) continue;

    // Match: number + separator + optional "ANS:" + letter (A-E)
    const pattern = /(\d+)[.)]\s*(?:ANS\s*[:.-]?\s*)?([A-Ea-e])(?:\s|$)/g;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const num = parseInt(match[1]);
      const letter = match[2].toUpperCase();
      answerMap.set(num, letter);
    }
  }

  return answerMap;
}

function findLastOption(options: any): 'a' | 'b' | 'c' | 'd' | 'e' | null {
  if (options.e) return 'e';
  if (options.d) return 'd';
  if (options.c) return 'c';
  if (options.b) return 'b';
  if (options.a) return 'a';
  return null;
}

// Split lines that contain multiple inline options (from N-column table layouts)
// e.g. "a. Jakarta b. Bandung" → two separate lines
function splitInlineOptions(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { result.push(line); continue; }

    // Find positions where option patterns start: [a-eA-E][.)] followed by space
    const positions: number[] = [];
    for (let i = 0; i < trimmed.length - 2; i++) {
      const ch = trimmed[i].toLowerCase();
      if (ch >= 'a' && ch <= 'e') {
        const next = trimmed[i + 1];
        const after = trimmed[i + 2];
        if ((next === '.' || next === ')') && (after === ' ' || after === '\t')) {
          if (i === 0 || /\s/.test(trimmed[i - 1])) {
            positions.push(i);
          }
        }
      }
    }

    if (positions.length >= 2) {
      // Verify all detected letters are unique (no duplicates)
      const letters = positions.map(p => trimmed[p].toLowerCase());
      const uniqueLetters = new Set(letters);
      if (uniqueLetters.size === letters.length) {
        for (let j = 0; j < positions.length; j++) {
          const start = positions[j];
          const end = j + 1 < positions.length ? positions[j + 1] : trimmed.length;
          const part = trimmed.substring(start, end).trim();
          if (part) result.push(part);
        }
        continue;
      }
    }

    // Also split inline answer-key entries: "1. B 2. A 3. C ..."
    const akPositions: number[] = [];
    for (let i = 0; i < trimmed.length - 3; i++) {
      if (/\d/.test(trimmed[i])) {
        // Find end of number
        let numEnd = i + 1;
        while (numEnd < trimmed.length && /\d/.test(trimmed[numEnd])) numEnd++;
        if (numEnd < trimmed.length - 1) {
          const sep = trimmed[numEnd];
          const afterSep = trimmed[numEnd + 1];
          if ((sep === '.' || sep === ')') && afterSep === ' ') {
            if (i === 0 || /\s/.test(trimmed[i - 1])) {
              akPositions.push(i);
            }
          }
        }
      }
    }
    if (akPositions.length >= 3) {
      // Likely multi-column answer key row
      for (let j = 0; j < akPositions.length; j++) {
        const start = akPositions[j];
        const end = j + 1 < akPositions.length ? akPositions[j + 1] : trimmed.length;
        const part = trimmed.substring(start, end).trim();
        if (part) result.push(part);
      }
      continue;
    }

    result.push(trimmed);
  }

  return result.join('\n');
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
  
  // Step 2: Table handling — column-agnostic
  // \cell → tab (not newline) so options in same row stay on same line
  // \row → newline to separate table rows
  text = text.replace(/\\cell(?![a-z])\s*/g, '\t');
  text = text.replace(/\\row(?![a-z])\s*/g, '\n');
  text = text.replace(/\\trowd[^\\\{]*?(?=\\|{)/g, '');
  text = text.replace(/\\clvertalt/g, '');
  text = text.replace(/\\cellx\d+/g, '');
  text = text.replace(/\\intbl/g, '');
  
  // Step 3: Replace RTF codes
  // IMPORTANT: (?![a-z]) prevents \par from matching inside \pard (which would leave orphan 'd')
  text = text.replace(/\\par(?![a-z])\s*/g, '\n');
  text = text.replace(/\\tab(?![a-z])\s*/g, ' ');
  
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
    
    // Skip standalone single letters (artifact from RTF table parsing)
    if (/^[a-eA-E]$/.test(line)) continue;
    
    // Skip ExamView Test header noise lines
    if (/^(Name|Class|Date|ID)\s*[:_]?\s*$/i.test(line)) continue;
    if (/^Page\s+\d+/i.test(line)) continue;
    if (/^Identify the choice/i.test(line)) continue;
    if (/^_{3,}$/.test(line)) continue;
    
    // Strip leading underscores (ExamView Test blank answer lines: "____ 1.")
    line = line.replace(/^_+\s*/, '');
    if (!line) continue;
    
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
    
    // If line is just "a." through "e." (or "a)" etc), merge with ALL following
    // continuation lines until we hit another pattern (option, question, marker)
    if (/^[a-eA-E][.)]$/.test(line)) {
      let merged = line;
      while (i + 1 < rawLines.length) {
        const nextLine = rawLines[i + 1].trim();
        // Stop merging if next line is empty, another option letter, a question number, or a marker
        if (!nextLine) break;
        if (/^[a-eA-E][.)]/.test(nextLine)) break;
        if (/^_*\s*\d+[.)]\s/.test(nextLine)) break;
        if (/^(ANS|ANSWER|JAWABAN|KUNCI|MULTIPLE|ESSAY|URAIAN|SHORT|ANSWER\s*KEY)/i.test(nextLine)) break;
        merged = merged + ' ' + nextLine;
        i++;
      }
      line = merged;
    }
    
    // Merge continuation lines (lines that don't start with a recognized pattern)
    // into the previous line — handles word-wrapped text from RTF
    if (cleanLines.length > 0 && line.length > 0) {
      const prevLine = cleanLines[cleanLines.length - 1];
      const isOptionStart = /^[a-eA-E][.)]\s/.test(line);
      const isQuestionStart = /^\d+[.)]\s/.test(line);
      const isMarker = /^(ANS|ANSWER|JAWABAN|KUNCI|MULTIPLE|ESSAY|URAIAN|SHORT|PTS|\[IMG_|\[GAMBAR)/i.test(line);
      const prevIsOrphanOption = /^[a-eA-E][.)]$/.test(prevLine);
      
      // If current line doesn't start with any known pattern, it's a continuation
      if (!isOptionStart && !isQuestionStart && !isMarker && !prevIsOrphanOption) {
        // Check if previous line looks like it was cut mid-sentence
        const prevEndsClean = /[.?!:;,\)]$/.test(prevLine);
        if (!prevEndsClean && prevLine.length > 0) {
          cleanLines[cleanLines.length - 1] = prevLine + line;
          continue;
        }
      }
    }
    
    cleanLines.push(line);
  }
  
  // Step 10: Join and split inline options (dynamic N-column support)
  text = cleanLines.join('\n');
  text = splitInlineOptions(text);
  
  // Step 11: Final cleanup
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Final: merge consecutive [GAMBAR] into one
  text = text.replace(/(\[GAMBAR\]\n?)+/g, '[GAMBAR]\n');
  
  return { text: text.trim(), images };
}
