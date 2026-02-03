
import { LogEntry } from '../types';

/**
 * Converts BCD bytes to float
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
        results.push(entry);
      }
    } catch (e) {
      // Skip malformed lines
    }
  });

  if (sampleRate > 1) {
    return results.filter((_, idx) => idx % sampleRate === 0);
  }
  return results;
};

export const toHexString = (val: number) => {
  const n = typeof val === 'number' ? val : 0;
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
};
