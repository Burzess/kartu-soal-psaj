'use client';

import { useState, useRef } from 'react';
import { parseTextToQuestions, parseRTF, ParseResult, ExtractedImage } from '@/lib/parser';
import { convertWmfEmfToPng, hasWmfEmfImages } from '@/lib/wmf-converter';

interface FileUploadProps {
  onParsed: (result: ParseResult) => void;
}

export default function FileUpload({ onParsed }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      
      // Check if RTF format
      let plainText = text;
      let images: ExtractedImage[] = [];
      
      if (text.startsWith('{\\rtf')) {
        const rtfResult = parseRTF(text);
        plainText = rtfResult.text;
        images = rtfResult.images;
        
        // Convert WMF/EMF images to PNG if any
        if (hasWmfEmfImages(images)) {
          setIsConverting(true);
          try {
            images = await convertWmfEmfToPng(images);
          } catch (e) {
            console.warn('WMF/EMF conversion failed:', e);
          } finally {
            setIsConverting(false);
          }
        }
      }
      
      const result = parseTextToQuestions(plainText);
      // Attach images to result
      result.images = images;
      
      if (result.errors.length > 0) {
        console.error('[DEBUG][PARSE][FILE] Parse menghasilkan error', {
          fileName: file.name,
          totalErrors: result.errors.length,
          errors: result.errors
        });
      }
      onParsed(result);
    } catch (error) {
      console.error('[DEBUG][PARSE][FILE] Gagal memproses file', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error
      });
    }
  };

  const handlePaste = () => {
    try {
      const result = parseTextToQuestions(pasteText);
      if (result.errors.length > 0) {
        console.error('[DEBUG][PARSE][PASTE] Parse menghasilkan error', {
          totalErrors: result.errors.length,
          errors: result.errors
        });
      }
      onParsed(result);
    } catch (error) {
      console.error('[DEBUG][PARSE][PASTE] Gagal parse teks paste', {
        textLength: pasteText.length,
        error
      });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Converting indicator */}
      {isConverting && (
        <div className="bg-blue-100 border-2 border-blue-400 rounded-lg p-4 text-center">
          <p className="text-blue-800 font-semibold">
            ⏳ Mengkonversi gambar WMF/EMF ke PNG...
          </p>
        </div>
      )}
      
      {/* Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${isConverting ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          id="soal-file"
          name="soalFile"
          ref={fileInputRef}
          type="file"
          accept=".txt,.rtf,.doc"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        
        <p className="mt-4 text-lg font-semibold text-gray-900">
          Drop file soal disini atau klik untuk pilih file
        </p>
        <p className="mt-2 text-base font-medium text-gray-700">
          Support: .txt, .rtf, .doc (max 10MB)
        </p>
      </div>

      {/* OR Divider */}
      {/* <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">ATAU</span>
        </div>
      </div> */}

      {/* Paste Text Area */}
      {/* <div className="space-y-3">
        <label htmlFor="paste-soal" className="block text-base font-semibold text-gray-900">
          Paste Teks Soal Langsung
        </label>
        <textarea
          id="paste-soal"
          name="pasteSoal"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Contoh:&#10;1. Apa ibu kota Indonesia?&#10;a. Bandung&#10;b. Jakarta&#10;c. Surabaya&#10;d. Medan&#10;ANS: B"
          className="w-full h-64 px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm text-gray-900 bg-white placeholder-gray-500"
        />
        <button
          onClick={handlePaste}
          disabled={!pasteText.trim()}
          className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-md"
        >
          📄 Parse Soal
        </button>
      </div> */}
    </div>
  );
}
