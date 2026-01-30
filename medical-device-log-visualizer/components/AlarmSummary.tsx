
import React from 'react';
import { LogEntry, AlarmLog } from '../types';
import { toHexString } from '../services/parserService';

interface AlarmSummaryProps {
  data: LogEntry[];
  onAlarmClick: (timestamp: number) => void;
}

const AlarmSummary: React.FC<AlarmSummaryProps> = ({ data, onAlarmClick }) => {
  const alarms = React.useMemo(() => {
    const alarmRows = data.filter(d => d.alarmSeq === 0 || d.alarmCode1 !== 0 || d.alarmCode2 !== 0);
    const uniqueAlarms: LogEntry[] = [];
    let lastKey = "";

    alarmRows.forEach(row => {
      const key = `${row.alarmSeq}-${row.alarmCode1}-${row.alarmCode2}`;
      if (key !== lastKey) {
        uniqueAlarms.push(row);
        lastKey = key;
      }
    });

    return uniqueAlarms.slice(-12);
  }, [data]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-red-600 font-black text-[10px] uppercase tracking-widest">[ ALARM MONITOR ]</h3>
        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Click to Jump</span>
      </div>
      <div className="font-mono text-[9px] space-y-1">
        <div className="grid grid-cols-4 text-gray-400 font-black border-b border-gray-100 pb-1 mb-1">
          <span>TIME</span>
          <span>SEQ</span>
          <span>C1</span>
          <span>C2</span>
        </div>
        <div className="max-h-[140px] overflow-y-auto space-y-1">
          {alarms.length > 0 ? (
            alarms.map((row, i) => (
              <button 
                key={i} 
                onClick={() => onAlarmClick(row.timestamp)}
                className="grid grid-cols-4 w-full text-left text-red-500 font-bold border-b border-gray-50 py-1 hover:bg-red-50 transition-colors rounded px-0.5 active:scale-[0.98]"
              >
                <span>{row.time}</span>
                <span>{toHexString(row.alarmSeq)}</span>
                <span>{toHexString(row.alarmCode1)}</span>
                <span>{toHexString(row.alarmCode2)}</span>
              </button>
            ))
          ) : (
            <div className="py-4 text-center text-gray-300 italic font-bold">STATUS NOMINAL</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlarmSummary;
