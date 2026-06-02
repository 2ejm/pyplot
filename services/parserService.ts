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
const createEmptyEntry = (targetTimestamp: number, tempSetting: number = 0, humiSetting: number = 0): LogEntry => {
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
    tempSetting,
    humiSetting,
  };
};

/**
 * TX 데이터 파싱
 */
const parseTX = (hexBytes: number[]) => {
  const tempSetting = bcdToFloat(hexBytes.slice(6, 8), 2);
  const humiSetting = bcdToFloat(hexBytes.slice(9, 11), 2);
  
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
    // 기준 날짜 고정 (기존 코드 유지)
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
  
  // 1. 로그 내부에서 실제 생성된 데이터들을 먼저 Map에 수집 (중복 시간은 마지막 데이터 기준)
  const parsedMap = new Map<number, LogEntry>();
  
  let recentSetTemp = 0;
  let recentSetHumi = 0;

  // TX 설정값의 시간에 따른 변화를 추적하기 위한 타임라인 배열
  const txTimeline: { timestamp: number; temp: number; humi: number }[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      // --- TX 데이터 처리 영역 ---
      if (trimmed.includes('TX: "')) {
        const parts = trimmed.split('TX: "');
        const timeStr = parts[0].replace(',', '').trim();
        const timeParts = timeStr.split(':').map(Number);
        if (timeParts.some(isNaN)) return;
        
        const [h, m, s = 0] = timeParts;
        const txTs = new Date(2022, 1, 21, h, m, s).getTime();

        let rawData = parts[1].split('"')[0];
        const hexBytes = rawData.split(',').map(h => parseInt(h, 16));
        
        const settings = parseTX(hexBytes);
        recentSetTemp = settings.tempSetting;
        recentSetHumi = settings.humiSetting;
        
        txTimeline.push({ timestamp: txTs, temp: recentSetTemp, humi: recentSetHumi });
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

      // 파싱 시점의 실시간 설정값 적용
      const entry = parsePacket(hexBytes, timeStr, recentSetTemp, recentSetHumi);
      
      if (entry && !isNaN(entry.timestamp)) {
        // 초 단위 이하(밀리초) 단차를 없애기 위해 2초 단위 정렬 타임스탬프 계산
        const roundedTs = Math.floor(entry.timestamp / 2000) * 2000;
        entry.timestamp = roundedTs;
        parsedMap.set(roundedTs, entry);
      }
    } catch (e) {
      console.error(`Error parsing line ${index}:`, e);
    }
  });

  // 2. 00:00:00 부터 23:59:58 까지 2초 간격 전체 풀 타임라인 플랫 배열 생성
  const fullResults: LogEntry[] = [];
  const startTs = new Date(2022, 1, 21, 0, 0, 0).getTime();
  const endTs = new Date(2022, 1, 21, 23, 59, 58).getTime();
  const INTERVAL = 2000; // 2초 (2000ms)

  // 빈 데이터를 채울 때 사용할 유효 TX 세팅 추적용 index
  let currentTxIdx = 0;
  let currentEmptyTemp = 0;
  let currentEmptyHumi = 0;

  for (let currentTs = startTs; currentTs <= endTs; currentTs += INTERVAL) {
    // 해당 시간에 맞는 TX 세팅 동기화
    while (
      currentTxIdx < txTimeline.length && 
      txTimeline[currentTxIdx].timestamp <= currentTs
    ) {
      currentEmptyTemp = txTimeline[currentTxIdx].temp;
      currentEmptyHumi = txTimeline[currentTxIdx].humi;
      currentTxIdx++;
    }

    if (parsedMap.has(currentTs)) {
      // 실제 데이터가 존재하면 삽입 (설정값은 파싱 당시의 값이 이미 들어있음)
      fullResults.push(parsedMap.get(currentTs)!);
    } else {
      // 데이터가 없는 구간은 0으로 채워진 데이터 삽입 (최신 설정값은 유지)
      fullResults.push(createEmptyEntry(currentTs, currentEmptyTemp, currentEmptyHumi));
    }
  }

  // 3. 샘플링 레이트 적용 (기존 필터 로직 유지)
  if (sampleRate > 1) {
    return fullResults.filter((_, idx) => idx % sampleRate === 0);
  }
  
  return fullResults;
};
