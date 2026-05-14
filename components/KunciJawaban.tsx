'use client';

import React from 'react';
import { Question, ExtractedImage } from '@/lib/parser';

interface KunciJawabanProps {
  questions: Question[];
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

export default function KunciJawaban({ questions, metadata, skorPerSoal = 1.5, images }: KunciJawabanProps) {
  const pgQuestions = questions.filter(q => q.type === 'PG');
  const essayQuestions = questions.filter(q => q.type === 'URAIAN');
  
  const hasPG = pgQuestions.length > 0;
  const hasEssay = essayQuestions.length > 0;

  // LOGIKA DINAMIS: Jika hanya ada PG (tanpa essay), skor otomatis dibagi agar max 100
  const actualSkorPerSoalPG = (hasPG && !hasEssay) 
    ? Number((100 / pgQuestions.length).toFixed(2)) 
    : skorPerSoal;

  const totalSkorPG = Number((pgQuestions.length * actualSkorPerSoalPG).toFixed(2));
  const totalSkorEssay = essayQuestions.length * 8; // Default skor essay per soal
  const totalKeseluruhan = Number((totalSkorPG + totalSkorEssay).toFixed(2));

  return (
    <div className="w-full p-8 text-[20px] print:break-after-page" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-bold text-[32px] mb-3">KUNCI JAWABAN & PEDOMAN PENILAIAN</h1>
        <h2 className="font-bold text-[26px] mb-2">PENILAIAN SUMATIF AKHIR JENJANG (PSAJ)</h2>
        <h2 className="font-bold text-[26px] mb-2">TAHUN PELAJARAN {metadata?.tahunPelajaran || '2025/2026'}</h2>
        <h2 className="font-bold text-[26px]">MAPEL {(metadata?.mataPelajaran || '-').toUpperCase()}</h2>
      </div>

      {/* Pedoman Penilaian Pilihan Ganda */}
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
                  <td className="border border-black p-4">{actualSkorPerSoalPG}</td>
                </tr>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <td className="border border-black p-4"></td>
                  <td className="border border-black p-4 text-left">Salah</td>
                  <td className="border border-black p-4">0</td>
                </tr>
                <tr className="font-bold" style={{ backgroundColor: '#f0f0f0' }}>
                  <td className="border border-black p-4" colSpan={2}>TOTAL SKOR PILIHAN GANDA</td>
                  <td className="border border-black p-4">{actualSkorPerSoalPG} x {pgQuestions.length} = {totalSkorPG}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Kunci Jawaban Pilihan Ganda */}
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
                      {renderTextWithImages(q.answer && q.options[q.answer.toLowerCase() as keyof typeof q.options] || '', images)}
                    </td>
                    <td className="border border-black p-4 text-center">{actualSkorPerSoalPG}</td>
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