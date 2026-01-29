
import { LogEntry } from '../types';

/**
 * Converts BCD bytes to float
 */
export const bcdToFloat = (bytes: number[], decimalPlaces: number = 2): number => {
  if (!bytes || bytes.length === 0) return 0;
  let val = 0;
  for (const b of bytes) {
    // b >> 4 is high nibble, b & 0x0F is low nibble
    const digit = (Math.floor(b / 16) * 10) + (b % 16);
    val = val * 100 + digit;
  }
  return val / Math.pow(10, decimalPlaces);
};

export const parsePacket = (hexList: number[], timeStr: string): LogEntry | null => {
  try {
    if (hexList.length < 40) return null;

    // Use a fixed date to replicate Python's datetime.replace behavior
    const [h, m, s] = timeStr.split(':').map(Number);
    const date = new Date(2022, 1, 21, h, m, s);

    return {
      time: timeStr,
      timestamp: date.getTime(),
      airTemp: bcdToFloat(hexList.slice(5, 7), 2),
      humidity: bcdToFloat(hexList.slice(7, 9), 2),
      skin1Temp: bcdToFloat(hexList.slice(9, 11), 2),
      skin2Temp: bcdToFloat(hexList.slice(11, 13), 2),
      oxygen: bcdToFloat(hexList.slice(13, 15), 2),
      airHtLvl: hexList[17],
      warmHtLvl: hexList[18],
      airHtPt100: bcdToFloat(hexList.slice(20, 22), 1),
      humiHtPt100: bcdToFloat(hexList.slice(22, 24), 1),
      alarmSeq: hexList[33],
      alarmCode1: hexList[34],
      alarmCode2: hexList[35],
    };
  } catch (e) {
    return null;
  }
};

export const parseLogFile = (content: string, sampleRate: number = 3): LogEntry[] => {
  const lines = content.split('\n');
  const results: LogEntry[] = [];
  
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes(',"')) return;

    try {
      const parts = trimmed.split(',"');
      const timeStr = parts[0];
      let rawData = parts[1].trim();

      // Remove trailing " and ETX (,03)
      if (rawData.endsWith('"')) rawData = rawData.slice(0, -1);
      if (rawData.endsWith(',03')) rawData = rawData.slice(0, -3);

      const hexBytes = rawData
        .split(',')
        .filter(h => h.trim() !== '')
        .map(h => parseInt(h, 16));

      const entry = parsePacket(hexBytes, timeStr);
      if (entry) {
        results.push(entry);
      }
    } catch (e) {
      // Skip malformed lines
    }
  });

  // Apply sampling rate
  if (sampleRate > 1) {
    return results.filter((_, idx) => idx % sampleRate === 0);
  }
  return results;
};

export const toHexString = (val: number) => `0x${val.toString(16).toUpperCase().padStart(2, '0')}`;
