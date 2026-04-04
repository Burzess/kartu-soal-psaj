'use client';

import { useState } from 'react';
import { parseRTF, parseTextToQuestions, ExtractedImage } from '@/lib/parser';
import { convertWmfEmfToPng, hasWmfEmfImages } from '@/lib/wmf-converter';

export default function DebugRTF() {
  const [plainText, setPlainText] = useState('');
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [parseResult, setParseResult] = useState<any>(null);
  const [isConverting, setIsConverting] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const text = await file.text();
    const rtfResult = parseRTF(text);
    setPlainText(rtfResult.text);
    
    let finalImages = rtfResult.images;
    
    // Convert WMF/EMF to PNG
    if (hasWmfEmfImages(finalImages)) {
      setIsConverting(true);
      try {
        finalImages = await convertWmfEmfToPng(finalImages);
      } catch (e) {
        console.warn('WMF/EMF conversion failed:', e);
      } finally {
        setIsConverting(false);
      }
    }
    
    setImages(finalImages);
    
    const result = parseTextToQuestions(rtfResult.text);
    result.images = finalImages;
    setParseResult(result);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">🔍 RTF Parser Debugger</h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900">Upload RTF File</h2>
          <input
            type="file"
            accept=".rtf"
            onChange={handleFileSelect}
            disabled={isConverting}
            className="block w-full text-base text-gray-900 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer disabled:opacity-50"
          />
          {isConverting && (
            <p className="mt-3 text-blue-700 font-semibold">⏳ Mengkonversi gambar WMF/EMF ke PNG...</p>
          )}
        </div>

        {plainText && (
          <>
            {/* Image Debug Section */}
            {images.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold mb-4 text-gray-900">📷 Extracted Images ({images.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {images.map((img) => (
                    <div key={img.id} className="border-2 border-gray-300 rounded-lg p-2">
                      <p className="text-sm font-bold text-gray-700 mb-1">{img.id} ({img.format})</p>
                      {img.format === 'png' || img.format === 'jpeg' ? (
                        <img src={img.data} alt={img.id} className="max-w-full max-h-32 object-contain" />
                      ) : (
                        <div className="bg-gray-200 p-4 text-center text-gray-600 text-sm">
                          Format {img.format} tidak bisa ditampilkan di browser
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Parsed Text</h2>
              <div className="mb-3 text-base font-semibold text-gray-800">
                Length: {plainText.length} | Lines: {plainText.split('\n').length} | Images: {images.length}
              </div>
              <pre className="bg-gray-100 p-4 rounded text-base whitespace-pre-wrap max-h-96 overflow-auto text-gray-900 border-2 border-gray-300">
                {plainText.substring(0, 2000)}
              </pre>
            </div>

            {parseResult && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className={`p-4 rounded mb-4 ${parseResult.questions.length > 0 ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'}`}>
                  <p className="font-bold text-lg text-gray-900">Questions: {parseResult.questions.length}</p>
                  <p className="font-bold text-lg text-red-700">Errors: {parseResult.errors.length}</p>
                  <p className="font-bold text-lg text-blue-700">Images: {images.length}</p>
                </div>

                <div className="bg-yellow-50 p-4 rounded border-2 border-yellow-400">
                  <h3 className="font-bold mb-2 text-lg text-gray-900">First 30 Lines:</h3>
                  <pre className="text-sm whitespace-pre-wrap text-gray-900 font-mono">
                    {plainText.split('\n').slice(0, 30).map((line, i) => 
                      `${(i+1).toString().padStart(2, '0')}: "${line}"`
                    ).join('\n')}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}