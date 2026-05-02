import * as XLSX from 'xlsx';

export interface KisiKisiItem {
  nomorSoal: number;
  capaianPembelajaran: string;  // CP
  tujuanPembelajaran: string;   // TP
  alurTujuanPembelajaran: string; // ATP
  indikator: string;
  materiBab: string;
  levelKognitif: string;
  bentukSoal: string;
}

export interface KisiKisiData {
  items: KisiKisiItem[];
  metadata: {
    mataPelajaran?: string;
    kelas?: string;
    tahunPelajaran?: string;
    penyusun?: string;
  };
}

/**
 * Parse kisi-kisi from Excel file (auto-detect sheet by headers)
 */
export async function parseKisiKisiExcel(file: File): Promise<KisiKisiData> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const sheetNames = workbook.SheetNames;
  console.log('[KISI] Sheet names:', sheetNames);

  const candidates = sheetNames
    .map((name) => {
      const worksheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
      const headerInfo = findHeaderRowAndMapping(jsonData);
      if (!headerInfo) return null;

      const score = scoreColumnMapping(headerInfo.colMap);
      return {
        name,
        jsonData,
        headerRowIndex: headerInfo.headerRowIndex,
        headers: headerInfo.headers,
        colMap: headerInfo.colMap,
        score
      };
    })
    .filter((candidate): candidate is SheetCandidate => candidate !== null);

  const bestSheet = candidates
    .filter((candidate) => candidate.colMap.nomorSoal >= 0 && candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!bestSheet) {
    throw new Error(
      `Sheet kisi-kisi tidak ditemukan. Pastikan ada header seperti NO, CP, TP, ATP, INDIKATOR. Sheet yang tersedia: ${sheetNames.join(', ')}`
    );
  }

  const { name: kisiSheetName, jsonData, headerRowIndex, headers, colMap } = bestSheet;

  console.log('[KISI] Using sheet:', kisiSheetName);
  console.log('[KISI] Raw data rows:', jsonData.length);
  console.log('[KISI] First 5 rows:', jsonData.slice(0, 5));
  console.log('[KISI] Header row index:', headerRowIndex);
  console.log('[KISI] Headers:', headers);
  console.log('[KISI] Column mapping:', colMap);

  // Parse data rows
  const items: KisiKisiItem[] = [];

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const nomorSoal = parseNomorSoal(row[colMap.nomorSoal]);
    if (nomorSoal <= 0) continue; // Skip rows without valid number

    items.push({
      nomorSoal,
      capaianPembelajaran: getCellValue(row, colMap.cp),
      tujuanPembelajaran: getCellValue(row, colMap.tp),
      alurTujuanPembelajaran: getCellValue(row, colMap.atp),
      indikator: getCellValue(row, colMap.indikator),
      materiBab: getCellValue(row, colMap.materi),
      levelKognitif: getCellValue(row, colMap.level),
      bentukSoal: getCellValue(row, colMap.bentuk)
    });
  }

  console.log('[KISI] Parsed items:', items.length);

  return {
    items,
    metadata: {}
  };
}

function getCellValue(row: unknown[], index: number): string {
  if (index < 0 || index >= row.length) return '';
  const value = row[index];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseNomorSoal(value: unknown): number {
  if (value === null || value === undefined) return -1;
  const num = parseInt(String(value), 10);
  return isNaN(num) ? -1 : num;
}

interface ColumnMapping {
  nomorSoal: number;
  cp: number;
  tp: number;
  atp: number;
  indikator: number;
  materi: number;
  level: number;
  bentuk: number;
}

interface SheetCandidate {
  name: string;
  jsonData: unknown[][];
  headerRowIndex: number;
  headers: string[];
  colMap: ColumnMapping;
  score: number;
}

function findColumnMapping(headers: string[]): ColumnMapping {
  const upperHeaders = headers.map(h => h.toUpperCase());
  
  const findCol = (patterns: string[]): number => {
    for (const pattern of patterns) {
      const idx = upperHeaders.findIndex(h => h.includes(pattern));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  
  return {
    // Column 1: No. Soal
    nomorSoal: findCol(['NO. SOAL', 'NO SOAL', 'NOMOR SOAL', 'NO.', 'NOMOR', 'NO']),
    // Column 2: Capaian Pembelajaran
    cp: findCol(['CAPAIAN PEMBELAJARAN', 'CAPAIAN', 'CP']),
    // Column 3: Tujuan Pembelajaran
    tp: findCol(['TUJUAN PEMBELAJARAN', 'TUJUAN', 'TP']),
    // Column 4: Alur Tujuan Pembelajaran
    atp: findCol(['ALUR TUJUAN PEMBELAJARAN', 'ALUR TUJUAN', 'ATP', 'ALUR']),
    // Column 6: Indikator Soal
    indikator: findCol(['INDIKATOR SOAL', 'INDIKATOR', 'IND']),
    // Column 5: Materi
    materi: findCol(['MATERI', 'BAB', 'KOMPETENSI DASAR', 'KD']),
    // Column 7: Level Kognitif
    level: findCol(['LEVEL KOGNITIF', 'LEVEL', 'KOGNITIF', 'TINGKAT', 'L1', 'L2', 'L3']),
    // Column 8: Bentuk Soal
    bentuk: findCol(['BENTUK SOAL', 'BENTUK', 'JENIS', 'TIPE'])
  };
}

function findHeaderRowAndMapping(jsonData: unknown[][]): {
  headerRowIndex: number;
  headers: string[];
  colMap: ColumnMapping;
} | null {
  let headerRowIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(20, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row || row.length === 0) continue;

    const rowStr = row.map(cell => String(cell || '').toUpperCase()).join(' ');
    if (rowStr.includes('CAPAIAN') || rowStr.includes('TUJUAN') ||
        (rowStr.includes('NO') && (rowStr.includes('CP') || rowStr.includes('TP')))) {
      headerRowIndex = i;
      headers = row.map(cell => String(cell || '').trim());
      break;
    }
  }

  if (headerRowIndex === -1) {
    // Fallback: assume first non-empty row is header
    for (let i = 0; i < jsonData.length; i++) {
      if (jsonData[i] && jsonData[i].length > 3) {
        headerRowIndex = i;
        headers = jsonData[i].map(cell => String(cell || '').trim());
        break;
      }
    }
  }

  if (headerRowIndex === -1) return null;

  const colMap = findColumnMapping(headers);
  return { headerRowIndex, headers, colMap };
}

function scoreColumnMapping(colMap: ColumnMapping): number {
  let score = 0;

  if (colMap.nomorSoal >= 0) score += 3;
  if (colMap.cp >= 0) score += 2;
  if (colMap.tp >= 0) score += 2;
  if (colMap.atp >= 0) score += 1;
  if (colMap.indikator >= 0) score += 2;
  if (colMap.materi >= 0) score += 1;
  if (colMap.level >= 0) score += 1;
  if (colMap.bentuk >= 0) score += 1;

  return score;
}

/**
 * Merge kisi-kisi data with parsed questions
 */
export function mergeKisiKisiWithQuestions<T extends { number: number }>(
  questions: T[],
  kisiKisi: KisiKisiData
): (T & { kisiKisi?: KisiKisiItem })[] {
  const kisiMap = new Map<number, KisiKisiItem>();
  
  for (const item of kisiKisi.items) {
    kisiMap.set(item.nomorSoal, item);
  }
  
  return questions.map(q => ({
    ...q,
    kisiKisi: kisiMap.get(q.number)
  }));
}
