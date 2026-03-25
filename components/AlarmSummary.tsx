import React from 'react';
import { LogEntry } from '../types';

interface AlarmSummaryProps {
  data: LogEntry[];
  onAlarmClick: (timestamp: number) => void;
}

/**
 * LSB 기반 비트 위치 계산 (MSB->LSB 순서로 1~8번 부여)
 * 알람 번호 오프셋 적용: (alarmSeq - 1) * 16
 */
const getActiveBits = (code1: number, code2: number, alarmSeq: number): number[] => {
  const activeBits: number[] = [];
  const offset = (alarmSeq - 1) * 16;
  
  // Code1 (Bit 1 ~ 8) + Offset
  for (let i = 7; i >= 0; i--) {
    if ((code1 >> i) & 1) activeBits.push((8 - i) + offset);
  }
  
  // Code2 (Bit 9 ~ 16) + Offset
  for (let i = 7; i >= 0; i--) {
    if ((code2 >> i) & 1) activeBits.push((16 - i) + offset);
  }
  
  return activeBits;
};

const AlarmSummary: React.FC<AlarmSummaryProps> = ({ data, onAlarmClick }) => {
  const alarms = React.useMemo(() => {
    const uniqueAlarms: LogEntry[] = [];
    const lastStateMap = new Map<number, number>();

    data.forEach(row => {
      if (row.alarmSeq === 0) return;
      const currentCombined = (row.alarmCode1 << 8) | row.alarmCode2;
      const lastCombined = lastStateMap.get(row.alarmSeq);

      if (lastCombined !== undefined && lastCombined !== currentCombined) {
        uniqueAlarms.push(row);
      }
      lastStateMap.set(row.alarmSeq, currentCombined);
    });

    return uniqueAlarms.sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm w-full">
      <div className="mb-2 pb-1 border-b border-gray-100">
        <h3 className="text-indigo-600 font-black text-[13px] uppercase tracking-tighter">
          [ ALARM LOGS ]
        </h3>
      </div>
      
      <div className="font-mono text-[13px]">
        <div className="max-h-[200px] overflow-y-auto space-y-0.5 custom-scrollbar">
          {alarms.length > 0 ? (
            alarms.map((row, i) => {
              const isCleared = row.alarmCode1 === 0 && row.alarmCode2 === 0;
              const activeBits = getActiveBits(row.alarmCode1, row.alarmCode2, row.alarmSeq);
              
              return (	
                <button 
                  key={`${row.timestamp}-${row.alarmSeq}-${i}`} 
                  onClick={() => onAlarmClick(row.timestamp)}
                  className="group flex items-center w-full py-1.5 px-2 rounded hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                >
                  {/* 시간 영역 */}
                  <span className="text-gray-400 font-medium w-20 shrink-0">
                    {row.time}
                  </span>

                  {/* 알람 번호 영역 */}
                  <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                    {isCleared ? (
                      <span className="text-green-500 text-[11px] font-bold">
                        [ ALARM CLEAR ]
                      </span>
                    ) : (
                      <span className="text-red-500 font-bold">
                        {activeBits.map(bit => `#${bit}`).join(', ')}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-gray-300 italic text-[11px]">
              NO RECORDS
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AlarmSummary;
