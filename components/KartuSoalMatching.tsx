'use client';

import React from 'react';
import { Question, ExtractedImage } from '@/lib/parser';
import { KisiKisiItem } from '@/lib/kisi-parser';

type ExamType = 'PSAJ' | 'KAK' | 'PAS' | 'PTS';

interface KartuSoalMatchingProps {
  question: Question;
  metadata?: {
    namaSekolah?: string;
    mataPelajaran?: string;
    kurikulum?: string;
    kelasUjian?: string;
    penyusun?: string;
    tahunPelajaran?: string;
  };
  images?: ExtractedImage[];
  kisiKisi?: KisiKisiItem;
  examType: ExamType;
  totalQuestions?: number;
}

// Helper to render text with image placeholders and preserve line breaks/lists
function renderTextWithImages(text: string, images?: ExtractedImage[]): React.ReactNode {
  const lines = text.split('\n');
  
  const renderLine = (line: string, lineIndex: number): React.ReactNode => {
    const imgPattern = /\[(IMG_\d+)\]|\[GAMBAR\]/g;
    
    if (!imgPattern.test(line)) {
      return line;
    }
    
    imgPattern.lastIndex = 0;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = imgPattern.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      
      const imgId = match[1];
      
      if (imgId && images) {
        const img = images.find(i => i.id === imgId);
        if (img && (img.format === 'png' || img.format === 'jpeg')) {
          parts.push(
            <img 
              key={`${imgId}-${match.index}-${lineIndex}`}
              src={img.data} 
              alt={`Gambar ${imgId}`}
              className="inline-block max-w-full max-h-32 my-1 border border-gray-300 rounded"
            />
          );
        } else {
          parts.push(
            <span key={`${imgId}-${match.index}-${lineIndex}`} className="inline-block bg-gray-200 border border-dashed border-gray-400 px-2 py-1 mx-1 text-gray-600 text-[10px] rounded">
              📷 Gambar (format tidak didukung)
            </span>
          );
        }
      } else {
        parts.push(
          <span key={`gambar-${match.index}-${lineIndex}`} className="inline-block bg-gray-200 border border-dashed border-gray-400 px-2 py-1 mx-1 text-gray-600 text-[10px] rounded">
            📷 Gambar
          </span>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }
    
    return <>{parts}</>;
  };

  if (lines.length === 1) {
    return renderLine(lines[0], 0);
  }

  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null;
        
        const isListItem = /^\s*(\d+|[a-zA-Z])[.)]\s+/.test(line);
        
        return (
          <div key={idx} className={isListItem ? 'pl-4' : ''}>
            {renderLine(trimmedLine, idx)}
          </div>
        );
      })}
    </div>
  );
}

export default function KartuSoalMatching({ question, metadata, images, kisiKisi, examType, totalQuestions }: KartuSoalMatchingProps) {
  const labelData = [
    { label: 'Capaian Pembelajaran', value: kisiKisi?.capaianPembelajaran || '' },
    { label: 'Tujuan Pembelajaran', value: kisiKisi?.tujuanPembelajaran || '' },
    { label: 'ATP', value: kisiKisi?.alurTujuanPembelajaran || '' },
    { label: 'Materi', value: kisiKisi?.materiBab || '' },
    { label: 'Indikator Soal', value: kisiKisi?.indikator || '' },
    { label: 'Level Kognitif', value: kisiKisi?.levelKognitif || '' }
  ];

  // Build matching choices list from question.options
  const optionEntries = Object.entries(question.options || {})
    .filter(([, val]) => val && val.trim() !== '')
    .sort(([a], [b]) => a.localeCompare(b));

  const answerDisplay = (question.answer || '-').toUpperCase();

  const kelasDanUjian = metadata?.kelasUjian ? `${metadata.kelasUjian} / ${examType}` : '-';

  return (
    <div className="mt-8 w-full bg-white border-2 border-black print:border-black print:break-after-page text-black text-[12px] leading-normal" style={{ backgroundColor: '#ffffff' }}>
      <div className="bg-[#c8c8c8] border-b border-black text-center font-bold text-[24px] py-2 tracking-tight">
        KARTU SOAL BENTUK MENCOCOKKAN
      </div>

      <div className="grid grid-cols-2 border-b border-black">
        <div className="p-4 space-y-2">
          <div className="flex">
            <span className="w-36 font-bold">Nama Sekolah</span>
            <span>: {metadata?.namaSekolah || 'SMK 45 Surabaya'}</span>
          </div>
          <div className="flex">
            <span className="w-36 font-bold">Mata Pelajaran</span>
            <span>: {metadata?.mataPelajaran || '-'}</span>
          </div>
          <div className="flex">
            <span className="w-36 font-bold">Kurikulum</span>
            <span>: {metadata?.kurikulum || 'Merdeka'}</span>
          </div>
          <div className="flex">
            <span className="w-36 font-bold">Kelas / Ujian</span>
            <span>: {kelasDanUjian}</span>
          </div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex">
            <span className="w-34 font-bold">Bentuk Tes</span>
            <span>: Mencocokkan</span>
          </div>
          <div className="flex">
            <span className="w-34 font-bold">Jumlah Soal</span>
            <span>: {totalQuestions || '-'}</span>
          </div>
          <div className="flex">
            <span className="w-34 font-bold">Tahun Pelajaran</span>
            <span>: {metadata?.tahunPelajaran || '2025 / 2026'}</span>
          </div>
          <div className="flex">
            <span className="w-34 font-bold">Penyusun</span>
            <span>: {metadata?.penyusun || '-'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[26%_74%] min-h-155">
        <div className="border-r border-black">
          {labelData.map(({ label, value }) => (
            <div key={label} className="border-b border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">{label}</div>
              <div className="h-20.5 p-1 text-[10px] overflow-hidden">{value}</div>
            </div>
          ))}
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-[28%_72%] gap-2">
            <div className="border border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">No.Soal</div>
              <div className="bg-[#8eb7df] text-center py-1 font-bold">{question.number}</div>
            </div>

            <div className="border border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">Rumusan Butir Soal</div>
              <div className="bg-[#8eb7df] p-2 min-h-47.5 align-top whitespace-pre-wrap wrap-break-word space-y-2">
                {question.stimulus && (
                  <div className="pb-2 border-b border-black/30">
                    {renderTextWithImages(question.stimulus, images)}
                  </div>
                )}
                <div>{renderTextWithImages(question.text, images)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[28%_72%] gap-2">
            <div className="border border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">Kunci Pasangan</div>
              <div className="bg-[#fff200] p-2 text-center min-h-38.5 flex flex-col items-center justify-center font-bold text-[13px] space-y-1">
                {question.matchingPairs && question.matchingPairs.length > 0 ? (
                  <div className="grid grid-cols-1 gap-1 text-center w-full">
                    {question.matchingPairs.map(p => (
                      <div key={p.subNumber} className="text-[12px]">
                        <span className="font-semibold">No. {p.subNumber}</span> &rarr; <span className="font-bold text-[13px]">{p.answer || '-'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[16px]">{answerDisplay}</span>
                )}
              </div>
            </div>

            <div className="border border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">Pilihan Pasangan Jawaban</div>
              <div className="bg-[#fff200] p-2 min-h-38.5 space-y-1">
                {optionEntries.length > 0 ? (
                  optionEntries.map(([key, val]) => (
                    <div key={key} className="whitespace-pre-wrap wrap-break-word">
                      <span className="font-bold uppercase">{key}.</span> {renderTextWithImages(val || '', images)}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-600 italic">(Daftar pilihan pasangan di soal)</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
