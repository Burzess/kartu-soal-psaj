'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import KisiKisiUpload from '@/components/KisiKisiUpload';
import KartuSoal from '@/components/KartuSoal';
import KartuSoalEssay from '@/components/KartuSoalEssay';
import { ParseResult } from '@/lib/parser';
import { KisiKisiData, KisiKisiItem } from '@/lib/kisi-parser';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Home() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [kisiKisiData, setKisiKisiData] = useState<KisiKisiData | null>(null);
  const [metadata, setMetadata] = useState({
    namaSekolah: 'SMK 45 Surabaya',
    mataPelajaran: '',
    kurikulum: 'Merdeka',
    kelasUjian: '',
    penyusun: '',
    tahunPelajaran: '2025 / 2026'
  });
  const [isExporting, setIsExporting] = useState(false);

  // Helper to get kisi-kisi for a specific question number
  const getKisiKisi = (questionNumber: number): KisiKisiItem | undefined => {
    if (!kisiKisiData) return undefined;
    return kisiKisiData.items.find(item => item.nomorSoal === questionNumber);
  };

  const buildPdfBlob = async () => {
    if (!parseResult || parseResult.questions.length === 0) {
      throw new Error('Tidak ada soal untuk diexport');
    }

    // Landscape orientation: 'l' for landscape
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = 297;  // A4 landscape width
    const pageHeight = 210; // A4 landscape height
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const cards = document.querySelectorAll('.kartu-soal-card');

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] as HTMLElement;

      try {
        // One card -> one PDF page is more stable than slicing large canvases.
        const canvas = await html2canvas(card, {
          scale: 1.5,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          foreignObjectRendering: false,
          removeContainer: true,
          imageTimeout: 15000
        });

        if (i > 0) {
          pdf.addPage();
        }

        const widthRatio = usableWidth / canvas.width;
        const heightRatio = usableHeight / canvas.height;
        const ratio = Math.min(widthRatio, heightRatio);

        const renderWidth = canvas.width * ratio;
        const renderHeight = canvas.height * ratio;
        const offsetX = margin + (usableWidth - renderWidth) / 2;
        const offsetY = margin + (usableHeight - renderHeight) / 2;

        // Convert canvas to data URL first to avoid issues
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(
          imgData,
          'JPEG',
          offsetX,
          offsetY,
          renderWidth,
          renderHeight
        );
      } catch (cardError) {
        console.error('[DEBUG][PDF] Gagal render kartu ke PDF', {
          cardIndex: i,
          cardError: cardError instanceof Error ? cardError.message : String(cardError),
          cardHTML: card.innerHTML.substring(0, 200)
        });
        // Skip this card and continue with others instead of failing entirely
        continue;
      }
    }

    // Check if at least one page was successfully added
    if (pdf.getNumberOfPages() === 0 || (cards.length > 0 && pdf.getNumberOfPages() === 1)) {
      // jsPDF starts with 1 page, so we need at least content on it
      const firstCanvas = document.querySelector('.kartu-soal-card');
      if (!firstCanvas) {
        throw new Error('Tidak ada kartu soal yang berhasil di-render');
      }
    }

    return pdf.output('blob');
  };

  const handleParsed = (result: ParseResult) => {
    if (result.errors.length > 0) {
      console.error('[DEBUG][PARSE][RESULT] Ditemukan error setelah parse', {
        totalQuestions: result.questions.length,
        totalErrors: result.errors.length,
        errors: result.errors
      });
    }
    setParseResult(result);
  };

  const handleExportPDF = async () => {
    if (!parseResult || parseResult.questions.length === 0) return;

    setIsExporting(true);
    
    try {
      const pdfBlob = await buildPdfBlob();

      const safeSubject = (metadata.mataPelajaran || 'PSAJ')
        .replace(/[^a-zA-Z0-9-_ ]/g, '_')
        .trim()
        .replace(/\s+/g, '_');
      const fileName = `Kartu_Soal_${safeSubject}_${new Date().getTime()}.pdf`;

      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.error('[DEBUG][PDF] Export berhasil', {
        fileName,
        sizeBytes: pdfBlob.size,
        totalCards: parseResult.questions.length
      });

      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 15000);
    } catch (error) {
      console.error('[DEBUG][PDF] Gagal generate PDF', {
        totalCards: parseResult.questions.length,
        metadata,
        error
      });
      alert('Gagal membuat PDF. Coba gunakan Print (Ctrl+P) sebagai alternatif.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePreviewPDF = async () => {
    if (!parseResult || parseResult.questions.length === 0) return;

    setIsExporting(true);

    try {
      const pdfBlob = await buildPdfBlob();
      const blobUrl = URL.createObjectURL(pdfBlob);
      const previewWindow = window.open(blobUrl, '_blank');

      if (!previewWindow) {
        URL.revokeObjectURL(blobUrl);
        alert('Preview diblokir browser. Izinkan pop-up lalu coba lagi.');
        return;
      }

      console.error('[DEBUG][PDF] Preview berhasil dibuka', {
        sizeBytes: pdfBlob.size,
        totalCards: parseResult.questions.length
      });

      window.setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error) {
      console.error('[DEBUG][PDF] Gagal preview PDF', {
        totalCards: parseResult.questions.length,
        metadata,
        error
      });
      alert('Gagal preview PDF. Coba lagi atau gunakan Print (Ctrl+P).');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setParseResult(null);
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Generator Kartu Soal PSAJ
          </h1>
          <p className="text-gray-600">
            Upload file soal atau paste langsung untuk membuat kartu soal
          </p>
        </div>

        {/* Main Content */}
        {!parseResult ? (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <FileUpload onParsed={handleParsed} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metadata Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 print:hidden">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Informasi Kartu Soal</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  id="nama-sekolah"
                  name="namaSekolah"
                  type="text"
                  placeholder="Nama Sekolah"
                  value={metadata.namaSekolah}
                  onChange={(e) => setMetadata({ ...metadata, namaSekolah: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-500 bg-white"
                />
                <input
                  id="mata-pelajaran"
                  name="mataPelajaran"
                  type="text"
                  placeholder="Mata Pelajaran"
                  value={metadata.mataPelajaran}
                  onChange={(e) => setMetadata({ ...metadata, mataPelajaran: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-500 bg-white"
                />
                <input
                  id="kurikulum"
                  name="kurikulum"
                  type="text"
                  placeholder="Kurikulum"
                  value={metadata.kurikulum}
                  onChange={(e) => setMetadata({ ...metadata, kurikulum: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-500 bg-white"
                />
                <input
                  id="kelas-ujian"
                  name="kelasUjian"
                  type="text"
                  placeholder="Kelas / Ujian (contoh: XII / PSAJ)"
                  value={metadata.kelasUjian}
                  onChange={(e) => setMetadata({ ...metadata, kelasUjian: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-500 bg-white"
                />
                <input
                  id="penyusun"
                  name="penyusun"
                  type="text"
                  placeholder="Penyusun"
                  value={metadata.penyusun}
                  onChange={(e) => setMetadata({ ...metadata, penyusun: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-500 bg-white"
                />
                <input
                  id="tahun-pelajaran"
                  name="tahunPelajaran"
                  type="text"
                  placeholder="Tahun Pelajaran"
                  value={metadata.tahunPelajaran}
                  onChange={(e) => setMetadata({ ...metadata, tahunPelajaran: e.target.value })}
                  className="px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-medium placeholder-gray-500 bg-white"
                />
              </div>
            </div>

            {/* Status & Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6 print:hidden">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-xl font-bold text-green-700">
                    ✅ Berhasil parse {parseResult.questions.length} soal
                  </p>
                  {parseResult.errors.length > 0 && (
                    <p className="text-base font-semibold text-red-700 mt-1">
                      ⚠️ {parseResult.errors.length} error
                    </p>
                  )}
                </div>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors shadow-md"
                  >
                    Upload Lagi
                  </button>
                  {/* <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-md"
                  >
                    Print
                  </button> */}
                  <button
                    onClick={handleExportPDF}
                    disabled={isExporting}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
                  >
                    {isExporting ? 'Membuat PDF...' : 'Export PDF'}
                  </button>
                  <button
                    onClick={handlePreviewPDF}
                    disabled={isExporting}
                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
                  >
                    Preview PDF
                  </button>
                </div>
              </div>

              {/* Upload Kisi-Kisi */}
              <div className="mt-4">
                <KisiKisiUpload onParsed={setKisiKisiData} />
                {kisiKisiData && (
                  <p className="text-green-600 text-sm mt-2">
                    ✓ {kisiKisiData.items.length} data kisi-kisi berhasil dimuat
                  </p>
                )}
              </div>
            </div>

            {/* Preview Kartu Soal */}
            <div className="space-y-6">
              {parseResult.questions.map((question, index) => (
                <div key={index} className="kartu-soal-card">
                  {question.type === 'URAIAN' ? (
                    <KartuSoalEssay 
                      question={question} 
                      metadata={metadata} 
                      images={parseResult.images}
                      kisiKisi={getKisiKisi(question.number)}
                    />
                  ) : (
                    <KartuSoal 
                      question={question} 
                      metadata={metadata} 
                      images={parseResult.images}
                      kisiKisi={getKisiKisi(question.number)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:break-after-page {
            page-break-after: always;
          }
        }
      `}</style>
    </main>
  );
}
