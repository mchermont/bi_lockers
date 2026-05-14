/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LayoutDashboard, Maximize, AlertCircle, FileSpreadsheet } from 'lucide-react';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { RawEvent, ProcessedData, processRawData } from './lib/dataProcessor';

export type ReportObjective = 'visao-geral' | 'capacidade' | 'infracoes' | 'completo';

export default function App() {
  const [data, setData] = useState<ProcessedData | null>(null);
  const [objective, setObjective] = useState<ReportObjective | null>(null);

  const handleDataLoaded = (rawEvents: RawEvent[]) => {
    const processed = processRawData(rawEvents);
    setData(processed);
  };

  const handleReset = () => {
    setData(null);
    setObjective(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      {!data ? (
        <FileUpload onDataLoaded={handleDataLoaded} />
      ) : !objective ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-4xl">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Relatório Carregado com Sucesso</h1>
              <p className="text-gray-600 text-lg">Selecione o objetivo da sua análise para gerarmos o dashboard ideal:</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button 
                onClick={() => setObjective('visao-geral')}
                className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-left flex flex-col h-full"
              >
                <div className="bg-blue-100 p-3 rounded-full w-fit mb-4 text-blue-600">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Relatório Mensal Padrão</h3>
                <p className="text-gray-600 flex-1">Foco na eficiência, tempo de espera e saúde geral da operação (SLA). Ideal para envio periódico a síndicos e gestores.</p>
              </button>

              <button 
                onClick={() => setObjective('capacidade')}
                className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:green-400 transition-all text-left flex flex-col h-full"
              >
                <div className="bg-green-100 p-3 rounded-full w-fit mb-4 text-green-600">
                  <Maximize size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Avaliação de Oportunidade de Expansão</h3>
                <p className="text-gray-600 flex-1">Foco nos picos de ocupação, momentos de estresse do equipamento e avaliação para instalação de módulos adicionais.</p>
              </button>

              <button 
                onClick={() => setObjective('infracoes')}
                className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:red-400 transition-all text-left flex flex-col h-full"
              >
                <div className="bg-red-100 p-3 rounded-full w-fit mb-4 text-red-600">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Identificar Gargalos e Intervenção</h3>
                <p className="text-gray-600 flex-1">Foco absoluto nos atrasos, moradores reincidentes e painel de ação imediata para notificação de pacotes travados.</p>
              </button>

              <button 
                onClick={() => setObjective('completo')}
                className="bg-[#2D3E4F] p-6 rounded-xl border border-transparent shadow-sm hover:shadow-md hover:bg-[#1E293B] transition-all text-left flex flex-col h-full text-white group"
              >
                <div className="bg-white/20 p-3 rounded-full w-fit mb-4 text-white">
                  <FileSpreadsheet size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Relatório Analítico Completo</h3>
                <p className="text-blue-100 flex-1">Consolida todas as informações: geral, expansão e infrações em um documento extenso para os gestores da operação.</p>
              </button>
            </div>
            
            <div className="mt-8 text-center">
               <button onClick={handleReset} className="text-gray-500 hover:text-gray-900 underline">
                 Voltar e enviar outro arquivo
               </button>
            </div>
          </div>
        </div>
      ) : (
        <Dashboard data={data} objective={objective} onReset={handleReset} />
      )}
    </div>
  );
}
