'use client';

import { useState, useRef } from 'react';
import { parseKisiKisiExcel, KisiKisiData } from '@/lib/kisi-parser';

interface KisiKisiUploadProps {
  onParsed: (data: KisiKisiData) => void;
}

export default function KisiKisiUpload({ onParsed }: KisiKisiUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setIsLoading(true);
    setError(null);

    try {
      const data = await parseKisiKisiExcel(file);
      
      if (data.items.length === 0) {
        throw new Error('Tidak ada data kisi-kisi yang valid ditemukan');
      }
      
      setLoadedFile(file.name);
      onParsed(data);
    } catch (err) {
      console.error('[KISI] Parse error:', err);
      setError(err instanceof Error ? err.message : 'Gagal membaca file kisi-kisi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
      <div className="text-center">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Upload Kisi-Kisi (Opsional)
        </h3>
        
        <p className="text-xs text-gray-600 mb-3">
          Upload file Excel dengan sheet KISI_MASTER untuk mengisi CP, TP, ATP, Indikator
        </p>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".xlsx,.xlsm,.xls"
          className="hidden"
        />

        {loadedFile ? (
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-green-600 text-sm">✓ {loadedFile}</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:underline"
              disabled={isLoading}
            >
              Ganti file
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Memproses...' : 'Pilih File Excel'}
          </button>
        )}

        {error && (
          <p className="text-red-600 text-xs mt-2">{error}</p>
        )}

        <p className="text-xs text-gray-500 mt-2">
          Format: .xlsx, .xlsm, .xls
        </p>
      </div>
    </div>
  );
}
