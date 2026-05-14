'use client';

import React from 'react';
import { Question, ExtractedImage } from '@/lib/parser';
import { KisiKisiItem } from '@/lib/kisi-parser';
import Image from 'next/image';

type ExamType = 'PSAJ' | 'KAK' | 'PAS';

interface KartuSoalEssayProps {
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
}

// Helper to render text with image placeholders and preserve line breaks/lists
function renderTextWithImages(text: string, images?: ExtractedImage[]): React.ReactNode {
  // First, split by newlines to preserve formatting
  const lines = text.split('\n');
  
  const renderLine = (line: string, lineIndex: number): React.ReactNode => {
    // Check for [IMG_X] markers (extracted images) and [GAMBAR] (placeholder)
    const imgPattern = /\[(IMG_\d+)\]|\[GAMBAR\]/g;
    
    if (!imgPattern.test(line)) {
      return line;
    }
    
    // Reset regex
    imgPattern.lastIndex = 0;
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = imgPattern.exec(line)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }
      
      const imgId = match[1]; // IMG_1, IMG_2, etc.
      
      if (imgId && images) {
        // Find the actual image
        const img = images.find(i => i.id === imgId);
        if (img && (img.format === 'png' || img.format === 'jpeg')) {
          parts.push(
            <Image 
              key={`${imgId}-${match.index}-${lineIndex}`}
              src={img.data} 
              alt={`Gambar ${imgId}`}
              className="inline-block max-w-full max-h-32 my-1 border border-gray-300 rounded"
            />
          );
        } else {
          // WMF/EMF or unknown format - show placeholder
          parts.push(
            <span key={`${imgId}-${match.index}-${lineIndex}`} className="inline-block bg-gray-200 border border-dashed border-gray-400 px-2 py-1 mx-1 text-gray-600 text-[10px] rounded">
              📷 Gambar (format tidak didukung)
            </span>
          );
        }
      } else {
        // Generic [GAMBAR] placeholder
        parts.push(
          <span key={`gambar-${match.index}-${lineIndex}`} className="inline-block bg-gray-200 border border-dashed border-gray-400 px-2 py-1 mx-1 text-gray-600 text-[10px] rounded">
            📷 Gambar
          </span>
        );
      }
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }
    
    return <>{parts}</>;
  };

  // Render each line, checking for list items
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null;
        
        // Check if line is a list item (numbered or lettered)
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

export default function KartuSoalEssay({ question, metadata, images, kisiKisi, examType }: KartuSoalEssayProps) {
  // Labels and their corresponding kisi-kisi values
  const labelData = [
    { label: 'Capaian Pembelajaran', value: kisiKisi?.capaianPembelajaran || '' },
    { label: 'Tujuan Pembelajaran', value: kisiKisi?.tujuanPembelajaran || '' },
    { label: 'ATP', value: kisiKisi?.alurTujuanPembelajaran || '' },
    { label: 'Materi', value: kisiKisi?.materiBab || '' },
    { label: 'Indikator Soal', value: kisiKisi?.indikator || '' },
    { label: 'Level Kognitif', value: kisiKisi?.levelKognitif || '' }
  ];

  const jawabanText = question.answer || '(Belum ada jawaban)';
  const kelasDanUjian = metadata?.kelasUjian ? `${metadata.kelasUjian} / ${examType}` : '-';

  return (
    <div className="mt-10 w-full bg-white border-2 border-black print:border-black print:break-after-page text-black text-[12px] leading-normal" style={{ backgroundColor: '#ffffff' }}>
      <div className="bg-[#c8c8c8] border-b border-black text-center font-bold text-[24px] py-2 tracking-tight">
        KARTU SOAL BENTUK URAIAN
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
            <span>: Uraian</span>
          </div>
          <div className="flex">
            <span className="w-34 font-bold">Jumlah Soal</span>
            <span>: 5</span>
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

      <div className="grid grid-cols-[24%_76%] min-h-155">
        <div className="border-r border-black">
          {labelData.map(({ label, value }) => (
            <div key={label} className="border-b border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">{label}</div>
              <div className="h-20.5 p-1 text-[10px] overflow-hidden">{value}</div>
            </div>
          ))}
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-[26%_74%] gap-2">
            <div className="border border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">No.Soal</div>
              <div className="bg-[#8eb7df] text-center py-1">{question.number}</div>
            </div>

            <div className="border border-black">
              <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">Rumusan Butir Soal</div>
              <div className="bg-[#8eb7df] p-2 min-h-47.5 whitespace-pre-wrap wrap-break-word">{renderTextWithImages(question.text, images)}</div>
            </div>
          </div>

          <div className="border border-black">
            <div className="bg-[#c8c8c8] font-bold border-b border-black h-[28px] flex items-center justify-center">Uraian Jawaban</div>
            <div className="bg-[#fff200] p-2 min-h-47 whitespace-pre-wrap wrap-break-word">{renderTextWithImages(jawabanText, images)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
