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
    tempSetting: 0,
    humiSetting: 0,
  };
};

/**
 * TX 데이터 파싱
 */
const parseTX = (hexBytes: number[]) => {
  // 인덱스 6,7: 온도 / 인덱스 9,10: 습도 (전달해주신 로직 기준)
  const tempSetting = bcdToFloat(hexBytes.slice(6, 8), 2);
  const humiSetting = bcdToFloat(hexBytes.slice(9, 11), 2);
  
  // [DEBUG] TX 파싱 상세 결과 확인
  console.debug(`[TX Parser] Raw: ${hexBytes.slice(6, 11).join(', ')} -> Temp: ${tempSetting}, Humi: ${humiSetting}`);
  
  return { tempSetting, humiSetting };
};

export const parsePacket = (
  hexList: number[], 
  timeStr: string, 
  recentTemp: number, 
  recentHumi: number
): LogEntry | null => {
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
      tempSetting: recentTemp,
      humiSetting: recentHumi,
    };
  } catch (e) {
    return null;
  }
};

export const parseLogFile = (content: string, sampleRate: number = 3): LogEntry[] => {
  if (!content) return [];
  const lines = content.split('\n');
  const results: LogEntry[] = [];
  
  // 상태 유지를 위한 변수 초기화
  let recentSetTemp = 0;
  let recentSetHumi = 0;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      // --- TX 데이터 처리 영역 ---
      if (trimmed.includes('TX: "')) {
        const parts = trimmed.split('TX: "');
        const timeStr = parts[0].replace(',', '').trim();
        let rawData = parts[1].split('"')[0];
        const hexBytes = rawData.split(',').map(h => parseInt(h, 16));
        
        const settings = parseTX(hexBytes);
        recentSetTemp = settings.tempSetting;
        recentSetHumi = settings.humiSetting;
        
        // [DEBUG] TX 업데이트 로그
        console.log(`[Line ${index}] Setting Updated at ${timeStr} -> T: ${recentSetTemp}, H: ${recentSetHumi}`);
        return; 
      }
      // -----------------------

      if (!trimmed.includes(',"')) return;

      const parts = trimmed.split(',"');
      const timeStr = parts[0];
      let rawData = parts[1].trim();

      if (rawData.endsWith('"')) rawData = rawData.slice(0, -1);
      if (rawData.endsWith(',03')) rawData = rawData.slice(0, -3);

      const hexBytes = rawData
        .split(',')
        .filter(h => h.trim() !== '')
        .map(h => parseInt(h, 16));

      const entry = parsePacket(hexBytes, timeStr, recentSetTemp, recentSetHumi);
      
      if (entry && !isNaN(entry.timestamp)) {
        if (results.length > 0) {
          let lastEntry = results[results.length - 1];
          while (entry.timestamp - lastEntry.timestamp >= 2000) {
            const nextGapTimestamp = lastEntry.timestamp + 2000;
            if (nextGapTimestamp >= entry.timestamp) break;
            
            const gapEntry = createEmptyEntry(nextGapTimestamp);
            // 빈 데이터 채울 때도 최신 설정값 유지
            gapEntry.tempSetting = recentSetTemp;
            gapEntry.humiSetting = recentSetHumi;
            
            results.push(gapEntry);
            lastEntry = gapEntry;
          }
        }
        results.push(entry);
      }
    } catch (e) {
      console.error(`Error parsing line ${index}:`, e);
    }
  });

  if (sampleRate > 1) {
    return results.filter((_, idx) => idx % sampleRate === 0);
  }
  return results;
};
