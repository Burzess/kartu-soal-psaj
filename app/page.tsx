'use client';

import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import KisiKisiUpload from '@/components/KisiKisiUpload';
import KartuSoal from '@/components/KartuSoal';
import KartuSoalEssay from '@/components/KartuSoalEssay';
import KunciJawaban from '@/components/KunciJawaban';
import { ParseResult } from '@/lib/parser';
import { KisiKisiData, KisiKisiItem } from '@/lib/kisi-parser';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type ExamType = 'PSAJ' | 'KAK' | 'PAS';

export default function Home() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [kisiKisiData, setKisiKisiData] = useState<KisiKisiData | null>(null);
  const [showKunciJawaban, setShowKunciJawaban] = useState(false);
  const [examType, setExamType] = useState<ExamType | ''>('');
  const [metadata, setMetadata] = useState({
    namaSekolah: 'SMK 45 Surabaya',
    mataPelajaran: '',
    kurikulum: 'Merdeka',
    kelasUjian: '',
    penyusun: '',
    tahunPelajaran: '2025 / 2026'
  });
  const [isExporting, setIsExporting] = useState(false);
  const examTypeOptions: ExamType[] = ['PSAJ', 'KAK', 'PAS'];
  const metadataLabels: Record<keyof typeof metadata, string> = {
    namaSekolah: 'Nama Sekolah',
    mataPelajaran: 'Mata Pelajaran',
    kurikulum: 'Kurikulum',
    kelasUjian: 'Kelas',
    penyusun: 'Penyusun',
    tahunPelajaran: 'Tahun Pelajaran'
  };
  const requiredMetadataFields = Object.keys(metadataLabels) as Array<keyof typeof metadata>;
  const missingMetadataFields = requiredMetadataFields.filter((field) => metadata[field].trim() === '');
  const isMetadataComplete = missingMetadataFields.length === 0;

  const ensureMetadataComplete = (downloadTarget: string) => {
    if (isMetadataComplete) return true;

    const missingFieldsText = missingMetadataFields
      .map((field) => `- ${metadataLabels[field]}`)
      .join('\n');
    alert(`Sebelum download ${downloadTarget}, lengkapi metadata berikut:\n${missingFieldsText}`);
    return false;
  };

  const ensureKisiKisiUploaded = (): boolean => {
    if (kisiKisiData !== null) return true;
    alert('Sebelum download kartu soal, upload kisi-kisi terlebih dahulu.');
    return false;
  };

  const metadataInputClass = (field: keyof typeof metadata) =>
    `px-4 py-3 border-2 rounded-lg text-gray-900 font-medium placeholder-gray-500 bg-white ${missingMetadataFields.includes(field)
      ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
      : 'border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
    }`;

  // Helper to get kisi-kisi for a specific question number
  const getKisiKisi = (questionNumber: number): KisiKisiItem | undefined => {
    if (!kisiKisiData) return undefined;
    return kisiKisiData.items.find(item => item.nomorSoal === questionNumber);
  };

  const buildPdfBlob = async () => {
    if (!parseResult || parseResult.questions.length === 0) {
      throw new Error('Tidak ada soal untuk diexport');
    }

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = 297;
    const pageHeight = 210;
    const horizontalMargin = 10;
    const topMargin = 10;
    const bottomMargin = 14;
    const usableWidth = pageWidth - horizontalMargin * 2;
    const usableHeight = pageHeight - topMargin - bottomMargin;
    const cards = document.querySelectorAll('.kartu-soal-card');

    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.top = '0';
    printContainer.style.left = '0';
    printContainer.style.width = '1000px';
    printContainer.style.opacity = '0';
    printContainer.style.pointerEvents = 'none';
    printContainer.style.zIndex = '-1000';
    document.body.appendChild(printContainer);

    let pageAdded = false;

    // Helper untuk mendeteksi dan menunggu seluruh gambar selesai dimuat
    const waitForImages = (element: HTMLElement) => {
      const images = Array.from(element.querySelectorAll('img'));
      return Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          // Tetap di-resolve meski error, agar eksekusi PDF tidak hang/berhenti jika ada 1 gambar rusak
          img.onerror = resolve;
        });
      }));
    };

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] as HTMLElement;
      let isolatedCard: HTMLElement | null = null;

      try {
        isolatedCard = card.cloneNode(true) as HTMLElement;
        isolatedCard.style.margin = '0';
        isolatedCard.style.width = '100%';
        printContainer.appendChild(isolatedCard);

        // WAJIB: Tunggu semua gambar dalam kartu soal ini selesai di-render browser
        await waitForImages(isolatedCard);

        // Ekstra jeda waktu agar browser sempat melakukan repainting layout setelah gambar muncul
        await new Promise(resolve => setTimeout(resolve, 150));

        const canvas = await html2canvas(isolatedCard, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1000,
          onclone: (clonedDoc) => {
            // SOLUSI LAB COLOR: Hapus class background gradient penyebab crash pada elemen main saat diclone
            const main = clonedDoc.querySelector('main');
            if (main) {
              main.style.background = '#ffffff';
              main.style.backgroundImage = 'none';
            }
          }
        });

        if (pageAdded) {
          pdf.addPage();
        }

        const widthRatio = usableWidth / canvas.width;
        const heightRatio = usableHeight / canvas.height;
        const ratio = Math.min(widthRatio, heightRatio);

        const safeRatio = ratio * 0.96;
        const renderWidth = canvas.width * safeRatio;
        const renderHeight = canvas.height * safeRatio;
        const offsetX = horizontalMargin + (usableWidth - renderWidth) / 2;
        const offsetY = topMargin;

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', offsetX, offsetY, renderWidth, renderHeight);

        pageAdded = true;

        canvas.width = 0;
        canvas.height = 0;
      } catch (cardError) {
        console.error(`[DEBUG][PDF] Gagal render kartu soal index ke-${i}`, cardError);
      } finally {
        if (isolatedCard && isolatedCard.parentNode) {
          isolatedCard.parentNode.removeChild(isolatedCard);
        }
      }
    }

    if (printContainer.parentNode) {
      document.body.removeChild(printContainer);
    }

    if (!pageAdded) {
      throw new Error('Tidak ada kartu soal yang berhasil di-render ke PDF');
    }

    return pdf.output('blob');
  };

  const handleParsed = (result: ParseResult) => {
    if (!examType) {
      alert('Pilih jenis ujian (PSAJ, KAK, atau PAS) sebelum upload file RTF.');
      return;
    }

    if (result.errors.length > 0) {
      console.error('[DEBUG][PARSE][RESULT] Ditemukan error setelah parse', {
        totalQuestions: result.questions.length,
        totalErrors: result.errors.length,
        errors: result.errors
      });
    }
    setParseResult(result);
  };

  const handleExportPDF = () => {
    if (!ensureKisiKisiUploaded()) return;
    if (!ensureMetadataComplete('kartu soal')) return;

    // Pastikan kita tidak di tampilan kunci jawaban
    if (showKunciJawaban) setShowKunciJawaban(false);

    // Beri jeda sedikit agar React selesai merender ulang UI sebelum print dialog muncul
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleExportKunciJawaban = () => {
    if (!ensureMetadataComplete('kunci jawaban')) return;

    // Pastikan kita berada di tampilan kunci jawaban
    if (!showKunciJawaban) setShowKunciJawaban(true);

    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handlePreviewPDF = async () => {
    if (!parseResult || parseResult.questions.length === 0) return;
    if (!ensureMetadataComplete('kartu soal')) return;

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

  const handleReset = () => {
    setParseResult(null);
    setShowKunciJawaban(false);
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 print:hidden">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Generator Kartu Soal dan Kunci Jawaban
          </h1>
          <p className="text-gray-600">
            Generate by <a href="https://limmm.my.id" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-semibold underline">Halim</a> | Untuk kebutuhan Perangkat Ujian SMK 45 Surabaya
          </p>
        </div>

        {/* Main Content */}
        {!parseResult ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6 print:hidden">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Pilih Jenis Generate Kartu Soal</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {examTypeOptions.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setExamType(type)}
                    className={`px-4 py-3 rounded-lg border-2 font-semibold transition-colors ${examType === type
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                      }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium text-gray-600">
                Guru wajib memilih jenis ujian terlebih dahulu sebelum upload file <span className="font-bold">.rtf</span>.
              </p>
            </div>

            <div className={`bg-white rounded-xl shadow-lg p-8 ${examType ? '' : 'opacity-60'}`}>
              {examType ? (
                <FileUpload onParsed={handleParsed} />
              ) : (
                <div className="py-10 text-center">
                  <p className="text-lg font-semibold text-gray-700">Pilih jenis ujian untuk membuka upload file RTF.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metadata Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 print:hidden">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Informasi Kartu Soal</h2>
              <p className="mb-6 text-sm font-semibold text-blue-700">
                Jenis Ujian: <span className="text-blue-900">{examType || '-'}</span>
              </p>

              {/* Jarak antar kolom grid diperlebar menjadi gap-6 untuk ruang bernapas yang lebih baik */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Form Group 1 */}
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="nama-sekolah" className="text-sm font-medium text-gray-700">Nama Sekolah</label>
                  <input
                    id="nama-sekolah"
                    name="namaSekolah"
                    type="text"
                    placeholder="Nama Sekolah"
                    value={metadata.namaSekolah}
                    onChange={(e) => setMetadata({ ...metadata, namaSekolah: e.target.value })}
                    className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${metadataInputClass('namaSekolah')}`}
                    required
                  />
                </div>

                {/* Form Group 2 */}
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="mata-pelajaran" className="text-sm font-medium text-gray-700">Mata Pelajaran</label>
                  <input
                    id="mata-pelajaran"
                    name="mataPelajaran"
                    type="text"
                    placeholder="Mata Pelajaran"
                    value={metadata.mataPelajaran}
                    onChange={(e) => setMetadata({ ...metadata, mataPelajaran: e.target.value })}
                    className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${metadataInputClass('mataPelajaran')}`}
                    required
                  />
                </div>

                {/* Form Group 3 */}
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="kurikulum" className="text-sm font-medium text-gray-700">Kurikulum</label>
                  <input
                    id="kurikulum"
                    name="kurikulum"
                    type="text"
                    placeholder="Kurikulum"
                    value={metadata.kurikulum}
                    onChange={(e) => setMetadata({ ...metadata, kurikulum: e.target.value })}
                    className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${metadataInputClass('kurikulum')}`}
                    required
                  />
                </div>

                {/* Form Group 4 */}
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="kelas-ujian" className="text-sm font-medium text-gray-700">Kelas</label>
                  <input
                    id="kelas-ujian"
                    name="kelasUjian"
                    type="text"
                    placeholder="Kelas (contoh: XII)"
                    value={metadata.kelasUjian}
                    onChange={(e) => setMetadata({ ...metadata, kelasUjian: e.target.value })}
                    className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${metadataInputClass('kelasUjian')}`}
                    required
                  />
                </div>

                {/* Form Group 5 */}
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="penyusun" className="text-sm font-medium text-gray-700">Penyusun</label>
                  <input
                    id="penyusun"
                    name="penyusun"
                    type="text"
                    placeholder="Penyusun (contoh: Mas Ibrahim Halim S.Kom)"
                    value={metadata.penyusun}
                    onChange={(e) => setMetadata({ ...metadata, penyusun: e.target.value })}
                    className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${metadataInputClass('penyusun')}`}
                    required
                  />
                </div>

                {/* Form Group 6 */}
                <div className="flex flex-col space-y-1.5">
                  <label htmlFor="tahun-pelajaran" className="text-sm font-medium text-gray-700">Tahun Pelajaran</label>
                  <input
                    id="tahun-pelajaran"
                    name="tahunPelajaran"
                    type="text"
                    placeholder="Tahun Pelajaran (contoh: 2023/2024)"
                    value={metadata.tahunPelajaran}
                    onChange={(e) => setMetadata({ ...metadata, tahunPelajaran: e.target.value })}
                    className={`px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${metadataInputClass('tahunPelajaran')}`}
                    required
                  />
                </div>
              </div>

              {!isMetadataComplete && (
                <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                  <p className="text-sm font-semibold text-red-700">
                    Lengkapi semua metadata terlebih dahulu sebelum mengunduh kartu soal atau kunci jawaban.
                  </p>
                </div>
              )}
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
                    Upload Ulang Soal
                  </button>
                  {/* <button
                    onClick={handlePrint}
                    className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-md"
                  >
                    Print
                  </button> */}
                  {!showKunciJawaban && (
                    <button
                      onClick={handleExportPDF}
                      disabled={isExporting}
                      className={`px-6 py-3 font-semibold rounded-lg transition-colors shadow-md ${kisiKisiData
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-blue-300 text-white cursor-not-allowed'
                        } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                      title={!kisiKisiData ? 'Upload kisi-kisi terlebih dahulu' : undefined}
                    >
                      {isExporting ? 'Membuat Kartu Soal...' : 'Download Kartu Soal'}
                    </button>
                  )}
                  {/* <button
                    onClick={handlePreviewPDF}
                    disabled={isExporting}
                    className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
                  >
                    Preview PDF
                  </button> */}
                  <button
                    onClick={() => setShowKunciJawaban(!showKunciJawaban)}
                    className="px-6 py-3 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 transition-colors shadow-md"
                  >
                    {showKunciJawaban ? 'Kartu Soal' : 'Kunci Jawaban'}
                  </button>
                  {showKunciJawaban && (
                    <button
                      onClick={handleExportKunciJawaban}
                      disabled={isExporting}
                      className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
                    >
                      Download Kunci Jawaban
                    </button>
                  )}
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

            {/* Preview Kunci Jawaban atau Kartu Soal */}
            {showKunciJawaban ? (
              <div className="kunci-jawaban-container">
                <KunciJawaban
                  questions={parseResult.questions}
                  metadata={metadata}
                  examType={examType || 'PSAJ'}
                  skorPerSoal={1.5}
                  images={parseResult.images}
                />
              </div>
            ) : (
              <div className="space-y-6">
                {parseResult.questions.map((question, index) => (
                  <div key={index} className="kartu-soal-card">
                    {question.type === 'URAIAN' ? (
                      <KartuSoalEssay
                        question={question}
                        metadata={metadata}
                        examType={examType || 'PSAJ'}
                        images={parseResult.images}
                        kisiKisi={getKisiKisi(question.number)}
                      />
                    ) : (
                      <KartuSoal
                        question={question}
                        metadata={metadata}
                        examType={examType || 'PSAJ'}
                        images={parseResult.images}
                        kisiKisi={getKisiKisi(question.number)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            /* DINAMIS: Otomatis A4 Landscape untuk Kartu Soal, Legal Portrait untuk Kunci Jawaban */
            size: ${showKunciJawaban ? 'legal portrait' : 'a4 landscape'};
            margin: 10mm; /* Otomatis mengatur Margin Minimum */
          }
          
          body {
            margin: 0;
            padding: 0;
            background: white !important;
            
            /* OTOMATIS AKTIFKAN OPSI "GRAFIS LATAR BELAKANG" / BACKGROUND GRAPHICS */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          main {
            /* Reset background warna-warni saat print */
            background: none !important;
            padding: 0 !important;
            
            /* OTOMATISKAN SKALA 80% (Zooming engine didukung penuh oleh browser Chromium / Edge) */
            zoom: 0.8; 
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .kartu-soal-card {
            page-break-after: always;
            break-after: page;
          }
          
          /* Mencegah tabel terpotong di tengah baris pada kunci jawaban */
          .kunci-jawaban-container table tr {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}
