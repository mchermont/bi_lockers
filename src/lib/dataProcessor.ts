import { parse, differenceInHours, differenceInMinutes, differenceInMilliseconds, startOfDay, format, isAfter, isBefore, addMinutes, differenceInDays } from 'date-fns';

export interface RawEvent {
  Locker: string;
  'Código de referência': string;
  Até: string;
  Porta: string;
  Tamanho: string;
  Status: string;
  Data: string;
}

export interface PackageData {
  code: string;
  recipient: string;
  door: string;
  size: string;
  deliveredAt: Date;
  retrievedAt: Date | null;
  status: 'Aguardando Retirada' | 'Retirada' | 'Cancelado';
  waitTimeHours: number;
}

export interface ProcessedData {
  condominiumName: string;
  totalDoors: number;
  totalProcessed: number;
  totalDays: number;
  dailyAvgDeliveries: number;
  top5Days: { date: string; deliveries: number }[];
  top5Recipients: { recipient: string; count: number }[];
  weekdayRanking: { weekday: string; deliveries: number }[];
  totalRetrieved: number;
  retrievalRate: number;
  maxDate: Date;
  minDate: Date;
  packages: PackageData[];
  
  // Occupancy metrics
  avgOccupancy: number;
  maxOccupancy: number;
  blockageEvents: { date: string; duration: number }[]; // 100% capacity
  nearLimitCount: number; // > 95% capacity
  occupancyHistory: { date: Date; occupancy: number }[];
  dailyBalance: { date: string; deliveries: number; retrievals: number; balance: number }[];
  
  // SLA
  avgWaitTimeHours: number;
  highEfficiencyCount: number; // < 4h
  retentionBottleneckCount: number; // > 17h
  retrievalByHours: { range: string; count: number; cumulative: number }[];
  avgWaitTimeByDay: { date: string; avgWait: number }[];
  
  // Op Clock
  cadenceByHour: { hour: string; deliveries: number; retrievals: number }[];
  
  // Infractions
  delays24h: number; // 24-48h
  delays48h: number; // 48-72h
  delays72h: number; // 72-96h
  delays96h: number; // >96h
  
  // Intervention
  pendingAlerts: PackageData[]; // Currently pending > 1h
  repeatOffenders: { recipient: string; delays24h: number; delays48h: number; delays72h: number; delays96h: number; total: number }[];
}

export function processRawData(rawEvents: any[]): ProcessedData {
  const packageMap = new Map<string, any>();
  const lockNamesFreq = new Map<string, number>();
  const uniqueDoors = new Set<string>();

  let maxDate = new Date(0);
  let minDate = new Date(8640000000000000);

  // Parse and group events
  rawEvents.forEach((row) => {
    // Normalize keys in case of spaces/cases
    const keys = Object.keys(row);
    const getVal = (possibleNames: string[]) => {
      const key = keys.find(k => possibleNames.some(p => k.toLowerCase().includes(p.toLowerCase())));
      return key ? row[key] : '';
    };

    const codeRaw = getVal(['Código', 'codigo', 'reference', 'referência']);
    const code = codeRaw ? String(codeRaw).trim() : '';
    if (!code) return; // Skip invalid rows

    const dateVal = getVal(['Data', 'date']);
    if (!dateVal) return;
    const dateStr = String(dateVal).trim();
    let parsedDate: Date;
    try {
      parsedDate = parse(dateStr, 'dd/MM/yyyy HH:mm', new Date());
      // Handle fallback if format is different (e.g. excel number or other string)
      if (isNaN(parsedDate.getTime())) {
         parsedDate = new Date(dateStr); // Try standard parsing
      }
    } catch (e) {
      console.error("Invalid date", dateStr);
      return;
    }

    if (isNaN(parsedDate.getTime())) return;

    if (isAfter(parsedDate, maxDate)) maxDate = parsedDate;
    if (isBefore(parsedDate, minDate)) minDate = parsedDate;

    const statusVal = getVal(['Status', 'status']);
    const status = statusVal ? String(statusVal).trim().toLowerCase() : '';

    const doorVal = getVal(['Porta', 'door', 'porta']);
    const door = doorVal ? String(doorVal).trim() : '';
    if (door && door !== '-') uniqueDoors.add(door);

    const lockerVal = getVal(['Locker', 'locker', 'armario', 'armário']);
    if (lockerVal) {
      const lockName = String(lockerVal).trim();
      lockNamesFreq.set(lockName, (lockNamesFreq.get(lockName) || 0) + 1);
    }

    if (!packageMap.has(code)) {
      packageMap.set(code, {
        code,
        recipient: getVal(['Até', 'ate', 'recipient', 'morador']),
        door: door,
        size: getVal(['Tamanho', 'size', 'tamanho']),
        events: []
      });
    }

    packageMap.get(code).events.push({ status, date: parsedDate });
  });

  const packages: PackageData[] = [];

  if (packageMap.size === 0) {
    maxDate = new Date();
    minDate = new Date();
  }

  packageMap.forEach((pkg) => {
    // Sort events by date
    pkg.events.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
    
    // Find Entregue as the start, Retirado as end
    const entregueEvent = pkg.events.find((e: any) => e.status.includes('entregue') || e.status.includes('depositado'));
    const retiradoEvent = pkg.events.find((e: any) => e.status.includes('retirado') || e.status.includes('removido'));
    const canceladoEvent = pkg.events.find((e: any) => e.status.includes('cancelado'));

    if (!entregueEvent) return; // Ignore if we don't have a delivery event

    const deliveredAt = entregueEvent.date;
    let retrievedAt = null;
    let status: 'Aguardando Retirada' | 'Retirada' | 'Cancelado' = 'Aguardando Retirada';

    if (canceladoEvent) {
      status = 'Cancelado';
      retrievedAt = canceladoEvent.date;
    } else if (retiradoEvent) {
      status = 'Retirada';
      retrievedAt = retiradoEvent.date;
    }

    const endTime = retrievedAt || maxDate;
    const waitTimeHours = differenceInMilliseconds(endTime, deliveredAt) / 3600000;

    packages.push({
      code: pkg.code,
      recipient: pkg.recipient,
      door: pkg.door,
      size: pkg.size,
      deliveredAt,
      retrievedAt,
      status,
      waitTimeHours: Math.max(0, waitTimeHours)
    });
  });

  const totalProcessed = packages.length;
  const totalRetrieved = packages.filter(p => p.status === 'Retirada').length;
  const retrievalRate = totalProcessed > 0 ? (totalRetrieved / totalProcessed) * 100 : 0;

  // Timeline / Occupancy simulation
  // Discretize time every minute between minDate and maxDate to build history
  // For performance, we can just track events and keep a running sum
  type OccEvent = { t: number, diff: number };
  const occEvents: OccEvent[] = [];
  packages.forEach(p => {
    occEvents.push({ t: p.deliveredAt.getTime(), diff: 1 });
    if (p.retrievedAt) {
      occEvents.push({ t: p.retrievedAt.getTime(), diff: -1 });
    }
  });

  occEvents.sort((a, b) => a.t - b.t);

  let currentOcc = 0;
  let maxOccupancy = 0;
  let sumOccTime = 0;
  let countOccUpdates = 0;
  
  const occupancyHistory: { date: Date; occupancy: number }[] = [];
  let nearLimitCount = 0;
  let blockageEvents: { date: string; duration: number }[] = [];
  
  const MAX_LIMIT = 74;
  const NEAR_LIMIT = 70; // 95% of 74 is 70.3
  
  let blockageStart: number | null = null;
  let nearLimitStart: number | null = null;
  let lastT = occEvents.length > 0 ? occEvents[0].t : 0;

  occEvents.forEach(e => {
    const duration = e.t - lastT;
    
    // Track 100% capacity
    if (currentOcc >= MAX_LIMIT && duration > 0) {
       // It was at capacity for `duration` ms
       if (!blockageStart) blockageStart = lastT;
    } else if (currentOcc < MAX_LIMIT && blockageStart) {
       const blockageDur = (lastT - blockageStart) / 60000; // in minutes
       if (blockageDur >= 1) { // Only count if >= 1 min
         blockageEvents.push({ date: format(new Date(blockageStart), 'dd/MM/yyyy HH:mm'), duration: Math.round(blockageDur) });
       }
       blockageStart = null;
    }

    // Track 95% capacity episodes
    if (currentOcc >= NEAR_LIMIT && duration > 0) {
        if (!nearLimitStart) {
            nearLimitStart = lastT;
            nearLimitCount++;
        }
    } else if (currentOcc < NEAR_LIMIT && nearLimitStart) {
        nearLimitStart = null;
    }

    sumOccTime += currentOcc * duration;
    
    // Sample for chart (reduce density by only taking points when necessary, or every X hours)
    // We'll sample every significant change for an Area chart, but we can thin it later
    occupancyHistory.push({ date: new Date(e.t), occupancy: currentOcc });

    currentOcc += e.diff;
    if (currentOcc > maxOccupancy) maxOccupancy = currentOcc;
    
    lastT = e.t;
  });

  const totalTimeInterval = maxDate.getTime() - minDate.getTime();
  const avgOccupancy = totalTimeInterval > 0 ? sumOccTime / totalTimeInterval : 0;

  // Daily balance
  const dateMap = new Map<string, { deliveries: number; retrievals: number; balance: number }>();
  let currentBalanceDay = 0;

  // To build daily balance, we iterate day by day
  if (totalTimeInterval > 0) {
      let d = startOfDay(minDate);
      const endD = startOfDay(maxDate);
      while (d <= endD) {
          dateMap.set(format(d, 'dd/MM'), { deliveries: 0, retrievals: 0, balance: 0 });
          d = new Date(d.getTime() + 86400000);
      }
      packages.forEach(p => {
          const dStr = format(p.deliveredAt, 'dd/MM');
          if (dateMap.has(dStr)) {
              dateMap.get(dStr)!.deliveries++;
          }
          if (p.retrievedAt) {
              const rStr = format(p.retrievedAt, 'dd/MM');
              if (dateMap.has(rStr)) {
                  dateMap.get(rStr)!.retrievals++;
              }
          }
      });
      // running balance
      Array.from(dateMap.keys()).forEach(k => {
          const val = dateMap.get(k)!;
          currentBalanceDay += val.deliveries - val.retrievals;
          val.balance = currentBalanceDay;
      });
  }
  
  const dailyBalance = Array.from(dateMap.entries()).map(([k, v]) => ({ date: k, ...v }));

  const totalDays = dateMap.size > 0 ? dateMap.size : 1;
  const dailyAvgDeliveries = totalProcessed / totalDays;

  const top5Days = [...dailyBalance]
    .sort((a, b) => b.deliveries - a.deliveries)
    .slice(0, 5)
    .map(d => ({ date: d.date, deliveries: d.deliveries }));

  // SLA
  let highEfficiencyCount = 0;
  let retentionBottleneckCount = 0;
  let waitTimeSum = 0;
  let retrievedCount = 0;
  
  let h_0_2 = 0; let h_2_4 = 0; let h_4_6 = 0; let h_6_8 = 0; let h_8_10 = 0; let h_10_12 = 0; 
  let h_12_14 = 0; let h_14_16 = 0; let h_16_17 = 0; let h_more_17 = 0;

  const waitTimeByDayMap = new Map<string, { sum: number; count: number }>();

  packages.filter(p => p.status === 'Retirada').forEach(p => {
      const waitH = p.waitTimeHours;
      waitTimeSum += waitH;
      retrievedCount++;
      
      if (waitH < 4) highEfficiencyCount++;
      if (waitH > 17) retentionBottleneckCount++;
      
      if (waitH <= 2) h_0_2++;
      else if (waitH <= 4) h_2_4++;
      else if (waitH <= 6) h_4_6++;
      else if (waitH <= 8) h_6_8++;
      else if (waitH <= 10) h_8_10++;
      else if (waitH <= 12) h_10_12++;
      else if (waitH <= 14) h_12_14++;
      else if (waitH <= 16) h_14_16++;
      else if (waitH <= 17) h_16_17++;
      else h_more_17++;

      const dStr = format(p.retrievedAt!, 'dd/MM');
      if (!waitTimeByDayMap.has(dStr)) waitTimeByDayMap.set(dStr, { sum: 0, count: 0 });
      waitTimeByDayMap.get(dStr)!.sum += waitH;
      waitTimeByDayMap.get(dStr)!.count++;
  });

  const avgWaitTimeHours = retrievedCount > 0 ? waitTimeSum / retrievedCount : 0;
  
  let cum = 0;
  const getCum = (v: number) => { cum += v; return (cum / retrievedCount) * 100 || 0; };
  const getPct = (v: number) => (v / retrievedCount) * 100 || 0;
  
  const retrievalByHours = [
      { range: 'Até 2h', count: getPct(h_0_2), cumulative: getCum(h_0_2) },
      { range: '02h - 04h', count: getPct(h_2_4), cumulative: getCum(h_2_4) },
      { range: '04h - 06h', count: getPct(h_4_6), cumulative: getCum(h_4_6) },
      { range: '06h - 08h', count: getPct(h_6_8), cumulative: getCum(h_6_8) },
      { range: '08h - 10h', count: getPct(h_8_10), cumulative: getCum(h_8_10) },
      { range: '10h - 12h', count: getPct(h_10_12), cumulative: getCum(h_10_12) },
      { range: '12h - 14h', count: getPct(h_12_14), cumulative: getCum(h_12_14) },
      { range: '14h - 16h', count: getPct(h_14_16), cumulative: getCum(h_14_16) },
      { range: '16h - 17h', count: getPct(h_16_17), cumulative: getCum(h_16_17) },
      { range: 'Mais de 17h', count: getPct(h_more_17), cumulative: getCum(h_more_17) },
  ];

  const waitTimeByDayArr = Array.from(waitTimeByDayMap.entries()).map(([k, v]) => ({
      date: k,
      avgWait: (v.sum / v.count)
  }));
  // Because they might be out of order, sort them using the sequential keys from dateMap
  const avgWaitTimeByDay = Array.from(dateMap.keys())
    .filter(k => waitTimeByDayMap.has(k))
    .map(k => {
      const v = waitTimeByDayMap.get(k)!;
      return { date: k, avgWait: v.sum / v.count };
    });

  // Op Clock
  const hrDeliveries = new Array(24).fill(0);
  const hrRetrievals = new Array(24).fill(0);
  const weekdayCounts = new Array(7).fill(0);
  const weekdayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

  const recipientCounts = new Map<string, number>();

  packages.forEach(p => {
      hrDeliveries[p.deliveredAt.getHours()]++;
      if (p.retrievedAt) {
          hrRetrievals[p.retrievedAt.getHours()]++;
      }
      weekdayCounts[p.deliveredAt.getDay()]++;
      
      if (p.recipient) {
         recipientCounts.set(p.recipient, (recipientCounts.get(p.recipient) || 0) + 1);
      }
  });
  
  const cadenceByHour = hrDeliveries.map((v, i) => ({
      hour: String(i),
      deliveries: v,
      retrievals: hrRetrievals[i]
  }));

  const weekdayRanking = weekdayNames.map((name, i) => ({
      weekday: name,
      deliveries: weekdayCounts[i]
  })).sort((a, b) => b.deliveries - a.deliveries);

  const top5Recipients = Array.from(recipientCounts.entries())
      .map(([recipient, count]) => ({ recipient, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

  // Infractions
  let delays24h = 0;
  let delays48h = 0;
  let delays72h = 0;
  let delays96h = 0;

  const repeatOffendersMap = new Map<string, {recipient: string; delays24h: number; delays48h: number; delays72h: number; delays96h: number; total: number}>();

  packages.forEach(p => {
      const waitH = p.waitTimeHours;
      if (waitH > 24) {
          let s = 0, sev = 0, c = 0, e = 0;
          if (waitH <= 48) { delays24h++; s=1; }
          else if (waitH <= 72) { delays48h++; sev=1; }
          else if (waitH <= 96) { delays72h++; c=1; }
          else { delays96h++; e=1; }

          if (!repeatOffendersMap.has(p.recipient)) {
              repeatOffendersMap.set(p.recipient, { recipient: p.recipient, delays24h: 0, delays48h: 0, delays72h: 0, delays96h: 0, total: 0 });
          }
          const ofn = repeatOffendersMap.get(p.recipient)!;
          ofn.delays24h += s;
          ofn.delays48h += sev;
          ofn.delays72h += c;
          ofn.delays96h += e;
          ofn.total += 1;
      }
  });

  const repeatOffenders = Array.from(repeatOffendersMap.values())
      .filter(o => o.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10); // Top 10

  const pendingAlerts = packages
      .filter(p => p.status === 'Aguardando Retirada' && p.waitTimeHours >= 24)
      .sort((a, b) => b.waitTimeHours - a.waitTimeHours)
      .slice(0, 10); // Show worst 10

  // Optional: refine occupancy layout to avoid huge data sets
  // Just sample every X minutes for charting. Or let recharts handle it.
  const thinnedOccupancy = [];
  if (occupancyHistory.length > 500) {
      const step = Math.ceil(occupancyHistory.length / 500);
      for(let i=0; i<occupancyHistory.length; i+=step) {
          thinnedOccupancy.push(occupancyHistory[i]);
      }
  } else {
      thinnedOccupancy.push(...occupancyHistory);
  }

  let condominiumName = 'Não Identificado';
  let maxFreq = 0;
  lockNamesFreq.forEach((freq, name) => {
    if (freq > maxFreq) {
      maxFreq = freq;
      condominiumName = name;
    }
  });

  const totalDoors = uniqueDoors.size > 0 ? uniqueDoors.size : 74; // Fallback to 74 if none found

  return {
      condominiumName,
      totalDoors,
      totalProcessed,
      totalDays,
      dailyAvgDeliveries,
      top5Days,
      top5Recipients,
      weekdayRanking,
      totalRetrieved,
      retrievalRate,
      maxDate,
      minDate,
      packages,
      avgOccupancy,
      maxOccupancy,
      blockageEvents,
      nearLimitCount,
      occupancyHistory: thinnedOccupancy,
      dailyBalance,
      avgWaitTimeHours,
      highEfficiencyCount,
      retentionBottleneckCount,
      retrievalByHours,
      avgWaitTimeByDay,
      cadenceByHour,
      delays24h,
      delays48h,
      delays72h,
      delays96h,
      pendingAlerts,
      repeatOffenders
  };
}
