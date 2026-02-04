
import React from 'react';
import { LogEntry } from '../types';
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
    <div className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm w-full">
      <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
        <h3 className="text-red-600 font-black text-xs uppercase tracking-[0.2em] leading-none">[ ALARM LOG ]</h3>
        <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Jump</span>
      </div>
      <div className="font-mono text-[13px] space-y-2">
        <div className="grid grid-cols-4 text-gray-400 font-black border-b border-gray-100 pb-3 mb-3 px-3">
          <span>TIME</span>
          <span>SEQ</span>
          <span>CODE1</span>
          <span>CODE2</span>
        </div>
        <div className="max-h-[250px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
          {alarms.length > 0 ? (
            alarms.map((row, i) => (
              <button 
                key={i} 
                onClick={() => onAlarmClick(row.timestamp)}
                className="grid grid-cols-4 w-full text-left text-red-500 font-bold border-b border-gray-50 py-3 hover:bg-red-50/50 transition-all rounded-xl px-3 active:scale-95 group"
              >
                <span className="group-hover:translate-x-1 transition-transform">{row.time}</span>
                <span>{toHexString(row.alarmSeq)}</span>
                <span>{toHexString(row.alarmCode1)}</span>
                <span>{toHexString(row.alarmCode2)}</span>
              </button>
            ))
          ) : (
            <div className="py-12 text-center text-gray-300 italic font-black uppercase tracking-widest text-[10px]">System Nominal</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlarmSummary;
