import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { RawEvent } from '../lib/dataProcessor';

interface FileUploadProps {
  onDataLoaded: (data: RawEvent[]) => void;
}

export default function FileUpload({ onDataLoaded }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setError(null);
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          onDataLoaded(results.data as RawEvent[]);
        },
        error: (err: any) => {
          setError('Erro ao ler CSV: ' + err.message);
        }
      });
    } else if (file.name.endsWith('.xlsx')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = xlsx.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = xlsx.utils.sheet_to_json(worksheet, { raw: false });
          onDataLoaded(json as RawEvent[]);
        } catch (err: any) {
          setError('Erro ao ler Excel: ' + err.message);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      setError('Formato não suportado. Por favor, envie .csv ou .xlsx');
    }
  }, [onDataLoaded]);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div 
        className={`w-full max-w-2xl p-12 mt-10 border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
          <UploadCloud className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Importar Relatório Golocker</h2>
        <p className="text-gray-500 mb-6 text-center max-w-md">
          Arraste e solte o arquivo do sistema (exportação em CSV ou Excel) ou clique para selecionar.
        </p>
        <label className="bg-[#2D3E4F] hover:bg-[#2D3E4F]/90 text-white px-6 py-2 rounded-lg cursor-pointer transition-colors flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Selecionar Arquivo
          <input 
            type="file" 
            className="hidden" 
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
          />
        </label>
        {error && <p className="mt-4 text-red-500 text-sm font-medium">{error}</p>}
      </div>
    </div>
  );
}
