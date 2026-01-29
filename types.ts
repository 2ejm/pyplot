
export interface LogEntry {
  time: string; // ISO or HH:mm:ss for internal use
  timestamp: number;
  airTemp: number;
  humidity: number;
  skin1Temp: number;
  skin2Temp: number;
  oxygen: number;
  airHtLvl: number;
  warmHtLvl: number;
  airHtPt100: number;
  humiHtPt100: number;
  alarmSeq: number;
  alarmCode1: number;
  alarmCode2: number;
}

export interface AlarmLog {
  time: string;
  seq: string;
  c1: string;
  c2: string;
}

export interface ChartVisibility {
  [key: string]: boolean;
}
