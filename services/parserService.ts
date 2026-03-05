import { LogEntry } from '../types';

/**
 * BCD 바이트를 float로 변환
 */
export const bcdToFloat = (bytes: number[], decimalPlaces: number = 2): number => {
  if (!bytes || bytes.length === 0) return 0;
  let val = 0;
  for (const b of bytes) {
    const digit = (Math.floor(b / 16) * 10) + (b % 16);
    val = val * 100 + digit;
  }
  const result = val / Math.pow(10, decimalPlaces);
  return isNaN(result) ? 0 : result;
};

/**
 * 특정 타임스탬프를 기준으로 모든 값이 0인 LogEntry 객체 생성
 */
const createEmptyEntry = (targetTimestamp: number): LogEntry => {
  const date = new Date(targetTimestamp);
  
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  
  return {
    time: `${h}:${m}:${s}`,
    timestamp: targetTimestamp,
    airTemp: 0,
    humidity: 0,
    skin1Temp: 0,
    skin2Temp: 0,
    oxygen: 0,
    airHtLvl: 0,
    warmHtLvl: 0,
    humiHtLvl: 0,
    airHtPt100: 0,
    humiHtPt100: 0,
    warmHtPt100: 0,
    waterLvl: 0,
    alarmSeq: 0,
    alarmCode1: 0,
    alarmCode2: 0,
  };
};

export const parsePacket = (hexList: number[], timeStr: string): LogEntry | null => {
  try {
    if (!hexList || hexList.length < 40 || !timeStr) return null;

    const timeParts = timeStr.split(':').map(Number);
    if (timeParts.some(isNaN) || timeParts.length < 2) return null;
    
    const [h, m, s = 0] = timeParts;
    const date = new Date(2022, 1, 21, h, m, s);
    const ts = date.getTime();

    if (isNaN(ts)) return null;

    return {
      time: timeStr,
      timestamp: ts,
      airTemp: bcdToFloat(hexList.slice(5, 7), 2),
      humidity: bcdToFloat(hexList.slice(7, 9), 2),
      skin1Temp: bcdToFloat(hexList.slice(9, 11), 2),
      skin2Temp: bcdToFloat(hexList.slice(11, 13), 2),
      oxygen: bcdToFloat(hexList.slice(13, 15), 2),
      airHtLvl: hexList[17] || 0,
      warmHtLvl: hexList[18] || 0,
      humiHtLvl: hexList[36] || 0,
      airHtPt100: bcdToFloat(hexList.slice(20, 22), 1),
      humiHtPt100: bcdToFloat(hexList.slice(22, 24), 1),
      warmHtPt100: bcdToFloat(hexList.slice(26, 28), 1),
      waterLvl: hexList[19] || 0,
      alarmSeq: hexList[33] || 0,
      alarmCode1: hexList[34] || 0,
      alarmCode2: hexList[35] || 0,
    };
  } catch (e) {
    return null;
  }
};

export const parseLogFile = (content: string, sampleRate: number = 3): LogEntry[] => {
  if (!content) return [];
  const lines = content.split('\n');
  const results: LogEntry[] = [];
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(',"')) return;

    try {
      const parts = trimmed.split(',"');
      const timeStr = parts[0];
      let rawData = parts[1].trim();

      if (rawData.endsWith('"')) rawData = rawData.slice(0, -1);
      if (rawData.endsWith(',03')) rawData = rawData.slice(0, -3);

      const hexBytes = rawData
        .split(',')
        .filter(h => h.trim() !== '')
        .map(h => parseInt(h, 16));

      const entry = parsePacket(hexBytes, timeStr);
      
      if (entry && !isNaN(entry.timestamp)) {
        // --- 누락된 모든 시간 채우기 로직 ---
        if (results.length > 0) {
          let lastEntry = results[results.length - 1];
          
          // 현재 데이터와 마지막 데이터 사이의 간격이 2000ms(2초) 이상인 동안 반복
          // 2초 간격으로 빈 데이터를 계속 채워 넣음
          while (entry.timestamp - lastEntry.timestamp >= 2000) {
            const nextGapTimestamp = lastEntry.timestamp + 2000;
            
            // 만약 새로 생성할 빈 데이터의 시간이 현재 데이터와 같아지면 중단
            if (nextGapTimestamp >= entry.timestamp) break;
            
            const gapEntry = createEmptyEntry(nextGapTimestamp);
            results.push(gapEntry);
            lastEntry = gapEntry; // 마지막 데이터를 방금 넣은 데이터로 갱신하여 루프 지속
          }
        }
        // ---------------------------------
        
        results.push(entry);
      }
    } catch (e) {
      // 오류 라인 건너뜀
    }
  });

  // 샘플링 비율 적용
  if (sampleRate > 1) {
    return results.filter((_, idx) => idx % sampleRate === 0);
  }
  return results;
};

export const toHexString = (val: number) => {
  const n = typeof val === 'number' ? val : 0;
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
};
