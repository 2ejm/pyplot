import React from 'react';
import { LogEntry } from '../types';
import { toHexString } from '../services/parserService';

interface AlarmSummaryProps {
  data: LogEntry[];
  onAlarmClick: (timestamp: number) => void;
}

const AlarmSummary: React.FC<AlarmSummaryProps> = ({ data, onAlarmClick }) => {
  const alarms = React.useMemo(() => {
    const uniqueAlarms: LogEntry[] = [];
    
    // 각 Seq(1, 2, 3...)별로 마지막 상태(Code 합계)를 추적하기 위한 Map
    // key: alarmSeq, value: lastCodeSum
    const lastStateMap = new Map<number, number>();

    data.forEach(row => {
      if (row.alarmSeq === 0) return; // 0번 시퀀스는 무시

      const currentCodeSum = row.alarmCode1 + row.alarmCode2;
      const lastCodeSum = lastStateMap.get(row.alarmSeq);

      // 해당 Seq의 상태가 이전과 달라졌을 때만 기록 (발생 또는 릴리즈)
      if (lastCodeSum !== currentCodeSum) {
        uniqueAlarms.push(row);
        lastStateMap.set(row.alarmSeq, currentCodeSum);
      }
    });

    // 최신 알람 12개만 유지
    return uniqueAlarms.slice(-12);
  }, [data]);

  return (
    <div className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm w-full">
      <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
        <h3 className="text-red-600 font-black text-xs uppercase tracking-[0.2em] leading-none">[ ALARM LOG ]</h3>
        <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest font-mono">Real-time Feed</span>
      </div>
      
      <div className="font-mono text-[13px] space-y-2">
        <div className="grid grid-cols-4 text-gray-400 font-black border-b border-gray-100 pb-3 mb-3 px-3">
          <span>TIME</span>
          <span>SEQ</span>
          <span>CODE1</span>
          <span>CODE2</span>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto space-y-1 custom-scrollbar pr-1">
          {alarms.length > 0 ? (
            // 최신 기록이 위로 오도록 역순 출력
            [...alarms].reverse().map((row, i) => {
              const isCleared = row.alarmCode1 === 0 && row.alarmCode2 === 0;
              
              return (
                <button 
                  key={`${row.timestamp}-${row.alarmSeq}-${i}`} 
                  onClick={() => onAlarmClick(row.timestamp)}
                  className={`grid grid-cols-4 w-full text-left font-bold border-b border-gray-50 py-3 hover:bg-gray-50 transition-all rounded-xl px-3 active:scale-95 group ${
                    isCleared ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  <span className="group-hover:translate-x-1 transition-transform text-gray-400 font-medium">
                    {row.time}
                  </span>
                  <span>{toHexString(row.alarmSeq)}</span>
                  <span>{toHexString(row.alarmCode1)}</span>
                  <span>{toHexString(row.alarmCode2)}</span>
                </button>
              );
            })
          ) : (
            <div className="py-12 text-center text-gray-300 italic font-black uppercase tracking-widest text-[10px]">
              System Nominal
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlarmSummary;
