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
    
    // 각 Seq별 이전 상태 저장 (초기값 undefined)
    const lastStateMap = new Map<number, number>();

    data.forEach(row => {
      if (row.alarmSeq === 0) return;

      const currentCodeSum = row.alarmCode1 + row.alarmCode2;
      const lastCodeSum = lastStateMap.get(row.alarmSeq);

      // 1. 이전 상태 기록이 있고(undefined 아님),
      // 2. 현재 상태가 이전 상태와 다를 때만 push
      if (lastCodeSum !== undefined && lastCodeSum !== currentCodeSum) {
        uniqueAlarms.push(row);
      }

      // 현재 상태를 Map에 업데이트 (다음 비교를 위해)
      lastStateMap.set(row.alarmSeq, currentCodeSum);
    });

    // 시간순 정렬
    return uniqueAlarms.sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);

  return (
    <div className="bg-white border border-gray-200 rounded-[2rem] p-6 shadow-sm w-full">
      <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
        <h3 className="text-red-600 font-black text-xs uppercase tracking-[0.2em] leading-none">[ ALARM LOG ]</h3>
      </div>
      
      <div className="font-mono text-[13px] space-y-1">
        {/* 헤더 섹션 */}
        <div className="grid grid-cols-4 text-gray-400 font-black border-b border-gray-100 py-1 mb-1 px-3">
          <span>TIME</span>
          <span>SEQ</span>
          <span>CODE1</span>
          <span>CODE2</span>
        </div>
        
        {/* 리스트 섹션: max-h를 늘리거나 제거하여 전체를 볼 수 있게 조정 가능 */}
        <div className="max-h-[120px] overflow-y-auto space-y-[3px] custom-scrollbar pr-1">
          {alarms.length > 0 ? (
            alarms.map((row, i) => {
              const isCleared = row.alarmCode1 === 0 && row.alarmCode2 === 0;
              
              return (	
                <button 
                  key={`${row.timestamp}-${row.alarmSeq}-${i}`} 
                  onClick={() => onAlarmClick(row.timestamp)}
                  className={`grid grid-cols-4 w-full text-left font-bold border-b border-gray-50 py-1 hover:bg-gray-50 transition-all rounded-xl px-3 active:scale-95 group ${
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
