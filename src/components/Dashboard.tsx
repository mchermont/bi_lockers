import React, { useRef, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ComposedChart, Line
} from 'recharts';
import { Download, Loader2 } from 'lucide-react';
import domtoimage from 'dom-to-image-more';
import jsPDF from 'jspdf';
import { ProcessedData } from '../lib/dataProcessor';
import { ReportObjective } from '../App';

interface DashboardProps {
  data: ProcessedData;
  objective: ReportObjective;
  onReset: () => void;
}

const COLORS = ['#22C55E', '#F59E0B', '#F97316', '#EF4444', '#3B82F6'];

export default function Dashboard({ data, objective, onReset }: DashboardProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const fileName = `Relatorio_Locker-${data.condominiumName.replace(/[^a-z0-9]/gi, '_')}-${format(data.minDate, 'dd-MM-yyyy')}_ate_${format(data.maxDate, 'dd-MM-yyyy')}.pdf`;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      let currentY = 0;
      const margin = 10;
      const effectivePageHeight = pageHeight - (margin * 2);
      
      // Get all sections to process individually
      const sections = Array.from(printRef.current.children) as HTMLElement[];
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        // Skip hidden elements or scripts
        if (section.nodeName === 'SCRIPT' || section.style.display === 'none') continue;
        
        const scale = 2; // High resolution
        const imgData = await domtoimage.toPng(section, {
          quality: 1,
          width: section.clientWidth * scale,
          height: section.clientHeight * scale,
          style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: `${section.clientWidth}px`,
            height: `${section.clientHeight}px`,
            margin: '0' // Reset margin for capture
          }
        });
        
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (section.clientHeight * imgWidth) / section.clientWidth;
        
        // If it's not the first element and it doesn't fit the page, add new page
        if (currentY > 0 && (currentY + imgHeight > effectivePageHeight)) {
          pdf.addPage();
          currentY = 0;
        }
        
        // If a single image is larger than the page (very rare for these sections but possible),
        // we just have to add it and let it overflow or scale it down. We'll add it normally.
        pdf.addImage(imgData, 'PNG', margin, margin + currentY, imgWidth, imgHeight);
        currentY += imgHeight + 5; // Add a small 5mm gap between sections
      }
      
      pdf.save(fileName);
      
    } catch (err: any) {
      console.error('Erro ao gerar PDF', err);
      alert(`Houve um erro ao gerar o PDF. Detalhes: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const pieData = [
    { name: 'Retiradas', value: data.totalRetrieved },
    { name: 'Aguardando Retirada', value: data.totalProcessed - data.totalRetrieved }
  ];

  const showVisaoGeral = objective === 'visao-geral' || objective === 'completo';
  const showCapacidade = objective === 'capacidade' || objective === 'completo';
  const showInfracoes = objective === 'infracoes' || objective === 'completo';

  return (
    <div className="bg-gray-100 min-h-screen pb-10">
      <div className="max-w-5xl mx-auto pt-6 px-4 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 print:hidden">
        <button onClick={onReset} className="text-gray-500 hover:text-gray-900 border border-gray-300 px-4 py-2 rounded-md bg-white w-full sm:w-auto">
          &larr; Novo Arquivo
        </button>
        <div className="flex gap-3 w-full sm:w-auto">
          <button 
            onClick={handleDownloadPdf} 
            disabled={isGeneratingPdf}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#2D3E4F] text-white px-6 py-2 rounded-md font-medium hover:bg-[#1f2c38] transition-colors min-w-[150px] disabled:opacity-70 disabled:cursor-not-allowed"
            title="Abre o menu onde você pode salvar como PDF"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <Download size={18} />
                <span>Baixar PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div ref={printRef} className="max-w-5xl mx-auto mt-6 bg-white shadow-xl min-h-screen p-8 print:p-0 print:shadow-none">
        
        {/* Header Section */}
        <div className="bg-[#2D3E4F] text-white rounded-lg p-8 mb-8 print:rounded-none">
          <h1 className="text-3xl font-bold mb-4">RELATÓRIO EXECUTIVO DE PERFORMANCE: LOCKER</h1>
          <div className="flex flex-col gap-2 text-gray-300 text-sm">
            <span>Condomínio: <b className="text-white text-base">{data.condominiumName}</b></span>
            <span>Período: <b className="text-white">Desde {format(data.minDate, 'dd/MM/yyyy')} até {format(data.maxDate, 'dd/MM/yyyy')}</b></span>
          </div>
        </div>

        {showVisaoGeral && (
          <>
            {/* 1. Termômetro Geral */}
            <section className="mb-12 break-inside-avoid">
          <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">1. Termômetro Geral da Operação</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            A operação logística mantém um monitoramento contínuo da sua performance. No período consolidado, o equipamento processou um total de <strong className="text-gray-900">{data.totalProcessed} encomendas</strong>, das quais <strong className="text-gray-900">{data.totalRetrieved} já foram devidamente retiradas</strong>, consolidando uma <strong>Taxa de Retirada de {data.retrievalRate.toFixed(1)}%</strong>.
          </p>
          
          <div className="h-[300px] w-full max-w-lg mx-auto border border-gray-100 rounded-xl p-4 bg-gray-50/50">
            <h3 className="text-center text-sm font-semibold text-gray-700 mb-2">Termômetro Geral: Status Atual das Encomendas</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  <Cell fill="#22C55E" />
                  <Cell fill="#F97316" />
                </Pie>
                <RechartsTooltip formatter={(value: number) => [value, 'Encomendas']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <p className="text-gray-600 mt-6 leading-relaxed">
            A alta taxa reflete o engajamento dos moradores com o sistema e ajuda a organizar a dinâmica de recebimentos no cotidiano.
          </p>
        </section>
          </>
        )}

        {showCapacidade && (
          <>
        {/* 2. Risco Físico e Picos de Lotação */}
        <section className="mb-12 break-inside-avoid">
          <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">2. O Risco Físico e os Picos de Lotação ({data.totalDoors} Portas)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-gray-600 mb-4 leading-relaxed">
                O equipamento possui {data.totalDoors} portas de capacidade física total, operando com uma <strong>Média de Ocupação Simultânea de {data.avgOccupancy.toFixed(1)} gavetas</strong>.
              </p>
              <ul className="list-disc pl-5 mb-4 text-gray-600 space-y-1">
                <li>Episódios de bloqueio (100%): <strong>{data.blockageEvents.length}</strong></li>
                <li>Episódios de 'Quase Lotação' ({'>'}95%): <strong>{data.nearLimitCount}</strong></li>
              </ul>
              
              <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Capacidade vs Utilização Real</h3>
                <p className="text-sm text-gray-600">Utilização média: <strong>{((data.dailyAvgDeliveries / data.totalDoors) * 100).toFixed(1)}% da capacidade nominal</strong></p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2 mb-4">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, (data.dailyAvgDeliveries / data.totalDoors) * 100)}%` }}></div>
                </div>
                <p className="text-sm text-gray-500 italic">Considerando a rotatividade atual, o sistema {((data.dailyAvgDeliveries / data.totalDoors) * 100) > 80 ? 'está operando sob forte pressão' : 'opera com folga na média'}.</p>
              </div>
            </div>

            <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 5 Dias com Maior Volume</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-200 border-b border-gray-300">
                    <tr>
                      <th scope="col" className="px-4 py-2 rounded-tl-lg">Data</th>
                      <th scope="col" className="px-4 py-2 rounded-tr-lg">Entregas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top5Days.map((d, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0 bg-white">
                        <td className="px-4 py-2 font-medium text-gray-900">{d.date}</td>
                        <td className="px-4 py-2 font-bold text-blue-600">{d.deliveries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="h-[350px] w-full border border-gray-100 rounded-xl p-4 bg-gray-50/50">
             <h3 className="text-center text-sm font-semibold text-gray-700 mb-4">Balanço Diário (Entregas x Retiradas) e Saldo Acumulado</h3>
             <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.dailyBalance} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{fontSize: 12}} />
                <YAxis yAxisId="left" tick={{fontSize: 12}} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize: 12}} hide />
                <RechartsTooltip />
                <Legend wrapperStyle={{fontSize: '12px'}} />
                <Bar yAxisId="left" dataKey="deliveries" name="Entregas" fill="#3B82F6" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Bar yAxisId="left" dataKey="retrievals" name="Retiradas" fill="#F59E0B" radius={[2, 2, 0, 0]} maxBarSize={40} />
                <Line yAxisId="right" type="monotone" dataKey="balance" name="Saldo Acumulado" stroke="#EF4444" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
          </>
        )}

        {showVisaoGeral && (
          <>
            <section className="mb-12 break-inside-avoid">
              <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">Volume e Hábitos de Recebimento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Média Diária de Encomendas</h3>
                    <p className="text-3xl font-bold text-blue-600">{data.dailyAvgDeliveries.toFixed(1)} <span className="text-base font-normal text-gray-500">encomendas/dia</span></p>
                  </div>
                  
                  <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Top 5 Moradores (Maiores Recebedores)</h3>
                    <ul className="space-y-2">
                      {data.top5Recipients.map((r, i) => (
                        <li key={i} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                          <span className="font-medium text-gray-800">{i+1}. {r.recipient}</span>
                          <span className="bg-gray-200 text-gray-700 py-0.5 px-2 rounded-full font-bold">{r.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-gray-50/50 border border-gray-100 p-4 rounded-xl h-[300px]">
                   <h3 className="text-center text-sm font-semibold text-gray-700 mb-4">Ranking de Dias da Semana</h3>
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={data.weekdayRanking} margin={{ top: 0, right: 20, left: 40, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                        <XAxis type="number" tick={{fontSize: 10}} />
                        <YAxis dataKey="weekday" type="category" tick={{fontSize: 11}} width={80} />
                        <RechartsTooltip cursor={{fill: '#F3F4F6'}} />
                        <Bar dataKey="deliveries" name="Entregas" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* 3. SLA */}
            <section className="mb-12 break-inside-avoid">
          <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">3. O Comportamento da Comunidade (SLA)</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            O tempo médio de espera global (SLA) fechou em <strong>{data.avgWaitTimeHours.toFixed(1)} horas</strong>. A performance de retirada divide-se em perfis distintos:
          </p>
          <ul className="list-disc pl-5 mb-6 text-gray-600 space-y-2">
            <li><strong>Alta Eficiência:</strong> Grande parte das caixas é retirada de forma muito rápida, em menos de 4 horas ({data.highEfficiencyCount} pacotes).</li>
            <li><strong>O Gargalo de Retenção:</strong> Um percentual preocupante pernoita no armário por mais de 17 horas ({data.retentionBottleneckCount} pacotes).</li>
          </ul>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="h-[300px] w-full border border-gray-100 rounded-xl p-4 bg-gray-50/50">
               <h3 className="text-center text-sm font-semibold text-gray-700 mb-4">Velocidade: Taxa de Retiradas por Horas</h3>
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.retrievalByHours} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" angle={-45} textAnchor="end" tick={{fontSize: 10}} />
                    <YAxis yAxisId="left" label={{ value: '% no Período', angle: -90, position: 'insideLeft', style: {fontSize: 10} }} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v)=>`${v}%`} />
                    <RechartsTooltip />
                    <Bar yAxisId="left" dataKey="count" name="% no Período" fill="#22C55E" />
                    <Line yAxisId="right" type="monotone" dataKey="cumulative" name="% Acumulada" stroke="#EF4444" strokeWidth={2} />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
            
            <div className="h-[300px] w-full border border-gray-100 rounded-xl p-4 bg-gray-50/50">
               <h3 className="text-center text-sm font-semibold text-gray-700 mb-4">SLA: Tempo Médio de Espera (Horas) por Dia</h3>
               <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.avgWaitTimeByDay} margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" angle={-45} textAnchor="end" tick={{fontSize: 10}} />
                    <YAxis label={{ value: 'Horas', angle: -90, position: 'insideLeft', style: {fontSize: 10} }} />
                    <RechartsTooltip />
                    <Bar dataKey="avgWait" name="Média do Dia" fill="#CBD5E1" />
                    <Line type="monotone" dataKey="avgWait" name="Média Global" stroke="#1E293B" strokeWidth={2} />
                  </ComposedChart>
               </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* 4. Relógio Operacional */}
        <section className="mb-12 break-inside-avoid">
          <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">4. O Relógio Operacional (Picos de Fluxo)</h2>
          <div className="h-[300px] w-full border border-gray-100 rounded-xl p-4 bg-gray-50/50">
             <h3 className="text-center text-sm font-semibold text-gray-700 mb-4">Relógio Operacional: Entregas x Retiradas por Hora do Dia</h3>
             <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.cadenceByHour} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tick={{fontSize: 12}} />
                  <YAxis tick={{fontSize: 12}} />
                  <RechartsTooltip />
                  <Legend wrapperStyle={{fontSize: '12px'}} />
                  <Line type="monotone" dataKey="deliveries" name="Entregas" stroke="#3B82F6" strokeWidth={2} />
                  <Line type="monotone" dataKey="retrievals" name="Retiradas" stroke="#F59E0B" strokeWidth={2} />
                </ComposedChart>
             </ResponsiveContainer>
          </div>
            </section>
          </>
        )}

        {showInfracoes && (
          <>
            {/* 5. Infrações */}
            <section className="mb-12 break-inside-avoid">
          <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">5. Categorização de Infrações e Retenções Prolongadas</h2>
          <p className="text-gray-600 mb-4">Para assegurar o giro da máquina, classificamos as ocupações irregulares (acima de 24h):</p>
          <ul className="list-disc pl-5 mb-4 text-gray-600 space-y-2">
            <li><strong>Mais de 24h (entre 24h e 48h):</strong> Identificamos {data.delays24h} ocorrências.</li>
            <li><strong>Mais de 48h (entre 48h e 72h):</strong> Registraram-se {data.delays48h} ocorrências.</li>
            <li><strong>Mais de 72h (entre 72h e 96h):</strong> Tivemos {data.delays72h} situações de reincidência alta.</li>
            <li><strong>Mais de 4 dias (mais de 96h):</strong> Identificamos {data.delays96h} situações críticas.</li>
          </ul>
        </section>

        {/* 6. Painel de Intervenção */}
        <section className="mb-12 break-inside-avoid">
          <h2 className="text-xl font-bold text-gray-800 border-b border-gray-200 pb-2 mb-4">6. Painel de Intervenção: Ofensores a Notificar</h2>
          
          <div className="mb-8">
            <h3 className="font-bold text-red-600 mb-3">Alerta em Tempo Real (Retendo portas NESTE MOMENTO):</h3>
            {data.pendingAlerts.length > 0 ? (
              <ul className="list-disc pl-5 text-gray-700 space-y-1">
                {data.pendingAlerts.map((p, i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <span className="font-bold">{p.recipient}</span> 
                    <span className="text-gray-500 text-sm">(Porta {p.door})</span>
                    <span className="text-red-500 font-medium">
                      — Em espera há {Math.floor(p.waitTimeHours / 24)} dias e {Math.floor(p.waitTimeHours % 24)} horas.
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">Não há encomendas em estado crítico aguardando retirada neste momento.</p>
            )}
          </div>

          <div>
            <h3 className="font-bold text-gray-700 mb-3">Moradores Reincidentes (Detalhamento de Atrasos {'>'} 24h):</h3>
            {data.repeatOffenders.length > 0 ? (
              <div className="overflow-x-auto w-full border border-gray-200 rounded-xl bg-white shadow-sm mt-4">
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th scope="col" className="px-6 py-4 font-semibold">Morador / Apartamento</th>
                      <th scope="col" className="px-4 py-4 text-center">Atrasos Totais</th>
                      <th scope="col" className="px-4 py-4 text-center text-yellow-600">{'>'} 24h</th>
                      <th scope="col" className="px-4 py-4 text-center text-orange-600">{'>'} 48h</th>
                      <th scope="col" className="px-4 py-4 text-center text-red-500">{'>'} 72h</th>
                      <th scope="col" className="px-4 py-4 text-center text-red-700">{'>'} 4 dias</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.repeatOffenders.map((ro, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0">
                        <td className="px-6 py-3 font-medium text-gray-900">{ro.recipient}</td>
                        <td className="px-4 py-3 text-center font-bold bg-gray-50">{ro.total}</td>
                        <td className="px-4 py-3 text-center">{ro.delays24h > 0 ? ro.delays24h : '-'}</td>
                        <td className="px-4 py-3 text-center">{ro.delays48h > 0 ? ro.delays48h : '-'}</td>
                        <td className="px-4 py-3 text-center">{ro.delays72h > 0 ? ro.delays72h : '-'}</td>
                        <td className="px-4 py-3 text-center font-semibold text-red-600">{ro.delays96h > 0 ? ro.delays96h : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
               <p className="text-gray-500 italic">Não há reincidência de atrasos prolongados no período.</p>
            )}
          </div>
        </section>

        {/* 7. Recomendação */}
        <section className="bg-red-50 p-6 rounded-lg border-l-4 border-red-500 break-inside-avoid">
          <p className="text-red-900 leading-relaxed">
            <strong>Ação Recomendada para o Síndico:</strong> Dado o impacto desproporcional das retenções, 
            é altamente recomendada a comunicação com os maiores reincidentes e ofensores atuais, 
            reforçando a importância da retirada diária. O equipamento não deve ser utilizado como depósito, 
            para garantir que as portas estejam sempre prontas para atender novas logísticas da comunidade.
          </p>
        </section>
          </>
        )}

      </div>
    </div>
  );
}
