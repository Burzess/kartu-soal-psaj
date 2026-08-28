'use client';

import React from 'react';
import { Question, ExtractedImage } from '@/lib/parser';

type ExamType = 'PSAJ' | 'KAK' | 'PAS' | 'PTS';

interface KunciJawabanProps {
  questions: Question[];
  examType: ExamType;
  metadata?: {
    namaSekolah?: string;
    mataPelajaran?: string;
    tahunPelajaran?: string;
  };
  skorPerSoal?: number;
  images?: ExtractedImage[];
}

// Helper render text (Tetap sama seperti aslinya)
function renderTextWithImages(text: string, images?: ExtractedImage[]): React.ReactNode {
  const lines = text.split('\n');
  const renderLine = (line: string, lineIndex: number): React.ReactNode => {
    const imgPattern = /\[(IMG_\d+)\]|\[GAMBAR\]/g;
    if (!imgPattern.test(line)) return line;
    imgPattern.lastIndex = 0;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    while ((match = imgPattern.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.substring(lastIndex, match.index));
      const imgId = match[1];
      if (imgId && images) {
        const img = images.find(i => i.id === imgId);
        if (img && (img.format === 'png' || img.format === 'jpeg')) {
          parts.push(
            <img key={`${imgId}-${match.index}-${lineIndex}`} src={img.data} alt={`Gambar ${imgId}`} className="inline-block max-w-full max-h-24 my-1 border border-gray-300 rounded" />
          );
        } else {
          parts.push(<span key={`${imgId}-${match.index}-${lineIndex}`} className="inline-block px-2 py-1 mx-1 text-[12px] rounded" style={{ backgroundColor: '#e5e5e5', border: '1px dashed #999' }}>📷 Gambar</span>);
        }
      } else {
        parts.push(<span key={`gambar-${match.index}-${lineIndex}`} className="inline-block px-2 py-1 mx-1 text-[12px] rounded" style={{ backgroundColor: '#e5e5e5', border: '1px dashed #999' }}>📷 Gambar</span>);
      }
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) parts.push(line.substring(lastIndex));
    return <>{parts}</>;
  };
  if (lines.length === 1) return renderLine(lines[0], 0);
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const isListItem = /^\s*(\d+|[a-zA-Z])[.)]\s+/.test(line);
        return <div key={idx} className={isListItem ? 'pl-6' : ''}>{renderLine(trimmed, idx)}</div>;
      })}
    </div>
  );
}

export default function KunciJawaban({ questions, examType, metadata, skorPerSoal = 1.5, images }: KunciJawabanProps) {
  const pgQuestions = questions.filter(q => q.type === 'PG');
  const tfQuestions = questions.filter(q => q.type === 'TRUE_FALSE');
  const matchingQuestions = questions.filter(q => q.type === 'MATCHING');
  const essayQuestions = questions.filter(q => q.type === 'URAIAN');

  const examHeaderByType: Record<ExamType, string> = {
    PSAJ: 'PENILAIAN SUMATIF AKHIR JENJANG (PSAJ)',
    KAK: 'KOMPETENSI AKHIR KELULUSAN (KAK)',
    PAS: 'PENILAIAN AKHIR SEMESTER (PAS)',
    PTS: 'PENILAIAN TENGAH SEMESTER (PTS)'
  };
  
  const hasPG = pgQuestions.length > 0;
  const hasTF = tfQuestions.length > 0;
  const hasMatching = matchingQuestions.length > 0;
  const hasEssay = essayQuestions.length > 0;

  const totalObjectiveCount = pgQuestions.length + tfQuestions.length + matchingQuestions.length;

  // LOGIKA DINAMIS PEMBAGIAN SKOR
  let actualSkorObj = skorPerSoal;
  if (!hasEssay && totalObjectiveCount > 0) {
    actualSkorObj = Number((100 / totalObjectiveCount).toFixed(2));
  } else if (hasEssay && totalObjectiveCount > 0) {
    const totalEssayPoints = essayQuestions.length * 8;
    const remainingObjPoints = Math.max(0, 100 - totalEssayPoints);
    actualSkorObj = Number((remainingObjPoints / totalObjectiveCount).toFixed(2));
  }

  const totalSkorPG = Number((pgQuestions.length * actualSkorObj).toFixed(2));
  const totalSkorTF = Number((tfQuestions.length * actualSkorObj).toFixed(2));
  const totalSkorMatching = Number((matchingQuestions.length * actualSkorObj).toFixed(2));
  const totalSkorEssay = essayQuestions.length * 8;
  const totalKeseluruhan = Number((totalSkorPG + totalSkorTF + totalSkorMatching + totalSkorEssay).toFixed(2));

  return (
    <div className="w-full p-8 text-[20px] print:break-after-page" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-bold text-[32px] mb-3">KUNCI JAWABAN & PEDOMAN PENILAIAN</h1>
        <h2 className="font-bold text-[26px] mb-2">{examHeaderByType[examType]}</h2>
        <h2 className="font-bold text-[26px] mb-2">TAHUN PELAJARAN {metadata?.tahunPelajaran || '2025/2026'}</h2>
        <h2 className="font-bold text-[26px]">MAPEL {(metadata?.mataPelajaran || '-').toUpperCase()}</h2>
      </div>

      {/* Pedoman & Kunci Jawaban Pilihan Ganda */}
      {hasPG && (
        <>
          <div className="mb-6">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Pedoman Penilaian Soal Pilihan Ganda</h3>
            <table className="w-full border-collapse border border-black text-center text-[20px]">
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4 w-24">NO</th>
                  <th className="border border-black p-4">KRITERIA JAWABAN</th>
                  <th className="border border-black p-4 w-28">SKOR</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4">1-{pgQuestions.length}</td>
                  <td className="border border-black p-4 text-left">Benar</td>
                  <td className="border border-black p-4">{actualSkorObj}</td>
                </tr>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4"></td>
                  <td className="border border-black p-4 text-left">Salah</td>
                  <td className="border border-black p-4">0</td>
                </tr>
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4" colSpan={2}>TOTAL SKOR PILIHAN GANDA</td>
                  <td className="border border-black p-4">{actualSkorObj} x {pgQuestions.length} = {totalSkorPG}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Kunci Jawaban Soal Pilihan Ganda</h3>
            <table className="w-full border-collapse border border-black text-[20px]">
              <thead>
                <tr className="text-center" style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4 w-16">No</th>
                  <th className="border border-black p-4">Kunci Jawaban</th>
                  <th className="border border-black p-4 w-24">Skor</th>
                </tr>
              </thead>
              <tbody>
                {pgQuestions.map((q) => (
                  <tr key={q.number} style={{ backgroundColor: '#ffffff' }}>
                    <td className="border border-black p-4 text-center">{q.number}</td>
                    <td className="border border-black p-4 text-justify">
                      <span className="font-bold">{q.answer?.toLowerCase()}.</span>{' '}
                      {renderTextWithImages((q.answer && q.options?.[q.answer.toLowerCase()]) || '', images)}
                    </td>
                    <td className="border border-black p-4 text-center">{actualSkorObj}</td>
                  </tr>
                ))}
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4 text-center" colSpan={2}>Total Skor</td>
                  <td className="border border-black p-4 text-center">{totalSkorPG}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pedoman & Kunci Jawaban Benar / Salah */}
      {hasTF && (
        <>
          <div className="mb-6 print:break-before-page">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Pedoman Penilaian Soal Benar / Salah</h3>
            <table className="w-full border-collapse border border-black text-center text-[20px]">
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4 w-24">NO</th>
                  <th className="border border-black p-4">KRITERIA JAWABAN</th>
                  <th className="border border-black p-4 w-28">SKOR</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4">1-{tfQuestions.length}</td>
                  <td className="border border-black p-4 text-left">Benar</td>
                  <td className="border border-black p-4">{actualSkorObj}</td>
                </tr>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4"></td>
                  <td className="border border-black p-4 text-left">Salah</td>
                  <td className="border border-black p-4">0</td>
                </tr>
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4" colSpan={2}>TOTAL SKOR BENAR / SALAH</td>
                  <td className="border border-black p-4">{actualSkorObj} x {tfQuestions.length} = {totalSkorTF}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Kunci Jawaban Soal Benar / Salah</h3>
            <table className="w-full border-collapse border border-black text-[20px]">
              <thead>
                <tr className="text-center" style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4 w-16">No</th>
                  <th className="border border-black p-4">Kunci Jawaban</th>
                  <th className="border border-black p-4 w-24">Skor</th>
                </tr>
              </thead>
              <tbody>
                {tfQuestions.map((q) => {
                  const isA = q.answer === 'A' || q.answer === 'BENAR' || q.answer === 'TRUE' || q.answer === 'T';
                  const isB = q.answer === 'B' || q.answer === 'SALAH' || q.answer === 'FALSE' || q.answer === 'S';
                  const ansLabel = isA ? 'A. Benar' : isB ? 'B. Salah' : q.answer || '-';
                  return (
                    <tr key={q.number} style={{ backgroundColor: '#ffffff' }}>
                      <td className="border border-black p-4 text-center">{q.number}</td>
                      <td className="border border-black p-4 font-semibold">
                        {ansLabel}
                      </td>
                      <td className="border border-black p-4 text-center">{actualSkorObj}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4 text-center" colSpan={2}>Total Skor</td>
                  <td className="border border-black p-4 text-center">{totalSkorTF}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pedoman & Kunci Jawaban Mencocokkan */}
      {hasMatching && (
        <>
          <div className="mb-6 print:break-before-page">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Pedoman Penilaian Soal Mencocokkan</h3>
            <table className="w-full border-collapse border border-black text-center text-[20px]">
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4 w-24">NO</th>
                  <th className="border border-black p-4">KRITERIA JAWABAN</th>
                  <th className="border border-black p-4 w-28">SKOR</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4">1-{matchingQuestions.length}</td>
                  <td className="border border-black p-4 text-left">Benar</td>
                  <td className="border border-black p-4">{actualSkorObj}</td>
                </tr>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4"></td>
                  <td className="border border-black p-4 text-left">Salah</td>
                  <td className="border border-black p-4">0</td>
                </tr>
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4" colSpan={2}>TOTAL SKOR MENCOCOKKAN</td>
                  <td className="border border-black p-4">{actualSkorObj} x {matchingQuestions.length} = {totalSkorMatching}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Kunci Jawaban Soal Mencocokkan</h3>
            <table className="w-full border-collapse border border-black text-[20px]">
              <thead>
                <tr className="text-center" style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4 w-16">No</th>
                  <th className="border border-black p-4">Kunci Pasangan</th>
                  <th className="border border-black p-4 w-24">Skor</th>
                </tr>
              </thead>
              <tbody>
                {matchingQuestions.map((q) => {
                  const keyLetter = (q.answer || '').toLowerCase();
                  const matchedText = q.options?.[keyLetter] || '';
                  return (
                    <tr key={q.number} style={{ backgroundColor: '#ffffff' }}>
                      <td className="border border-black p-4 text-center">{q.number}</td>
                      <td className="border border-black p-4 text-justify">
                        <span className="font-bold">{q.answer?.toUpperCase()}.</span>{' '}
                        {renderTextWithImages(matchedText || q.answer, images)}
                      </td>
                      <td className="border border-black p-4 text-center">{actualSkorObj}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4 text-center" colSpan={2}>Total Skor</td>
                  <td className="border border-black p-4 text-center">{totalSkorMatching}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pedoman Penilaian Uraian */}
      {hasEssay && (
        <>
          <div className="mb-6 print:break-before-page">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Pedoman Penilaian Soal Uraian</h3>
            <table className="w-full border-collapse border border-black text-center text-[20px]">
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4">SKOR PER SOAL</th>
                  <th className="border border-black p-4">JUMLAH SOAL</th>
                  <th className="border border-black p-4">TOTAL SKOR</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4">8</td>
                  <td className="border border-black p-4">{essayQuestions.length}</td>
                  <td className="border border-black p-4">8 x {essayQuestions.length} = {totalSkorEssay}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Kunci Jawaban Uraian */}
          <div className="mb-8">
            <h3 className="font-bold text-[24px] mb-3 p-3" style={{ backgroundColor: '#e5e5e5' }}>Kunci Jawaban Soal Uraian</h3>
            <table className="w-full border-collapse border border-black text-[20px]">
              <thead>
                <tr className="text-center" style={{ backgroundColor: '#f0f0f0' }}>
                  <th className="border border-black p-4 w-16">No</th>
                  <th className="border border-black p-4">Kunci Jawaban</th>
                  <th className="border border-black p-4 w-24">Skor</th>
                </tr>
              </thead>
              <tbody>
                {essayQuestions.map((q) => {
                  return (
                    <tr key={q.number} style={{ backgroundColor: '#ffffff' }}>
                      <td className="border border-black p-4 text-center align-top">{q.number}</td>
                      <td className="border border-black p-4 text-justify">{renderTextWithImages(q.answer || '(Belum ada jawaban)', images)}</td>
                      <td className="border border-black p-4 text-center align-top">8</td>
                    </tr>
                  );
                })}
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4 text-center" colSpan={2}>Total Skor</td>
                  <td className="border border-black p-4 text-center">{totalSkorEssay}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Total Keseluruhan */}
      <div className="mt-6">
        <table className="w-full border-collapse border border-black">
          <tbody>
            <tr className="font-bold text-center text-[24px]" style={{ backgroundColor: '#fef08a' }}>
              <td className="border border-black p-5">TOTAL SKOR KESELURUHAN</td>
              <td className="border border-black p-5 w-40">{totalKeseluruhan}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
