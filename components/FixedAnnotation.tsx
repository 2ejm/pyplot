
import React, { useState, useEffect, memo } from 'react';
import { LogEntry } from '../types';

const FixedAnnotation: React.FC = () => {
  const [data, setData] = useState<LogEntry | null>(null);

  useEffect(() => {
    const handleHover = (e: any) => {
      setData(e.detail);
    };
    window.addEventListener('chart-hover', handleHover);
    return () => window.removeEventListener('chart-hover', handleHover);
  }, []);

  if (!data) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm w-full min-h-[160px] flex flex-col items-center justify-center border-dashed">
        <p className="text-gray-300 text-[9px] font-black uppercase tracking-[0.2em] italic">Probe Inactive</p>
      </div>
    );
  }

  const Row = ({ label, value, unit = "", color = "text-gray-900" }: { label: string, value: number | string, unit?: string, color?: string }) => (
    <div className="flex justify-between items-center gap-4 py-0.5 border-b border-gray-50 last:border-0">
      <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter leading-none">{label}</span>
      <span className={`text-[9.5px] font-mono font-bold ${color}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </span>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm w-full border-l-4 border-l-indigo-600 transition-all">
      <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-gray-100">
        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">[ PROBE READOUT ]</span>
        <span className="text-[9px] font-mono font-bold text-gray-600">
          {new Date(data.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>
      <div className="space-y-0">
        {/* STRICT REQUESTED READOUT SEQUENCE & LABELS */}
        <Row label="AIR TEMPERATURE" value={data.airTemp} unit="℃" color="text-red-500" />
        <Row label="AIR HEATER POWER" value={data.airHtLvl} color="text-sky-500" />
        <Row label="AIR HEATER PT100" value={data.airHtPt100} unit="℃" color="text-fuchsia-500" />
        
        <Row label="HUMIDITY" value={data.humidity} unit="%" color="text-blue-500" />
        <Row label="HUMIDITY HEATER POWER" value={data.humiHtLvl} color="text-cyan-500" />
        <Row label="HUMIDITY HEATER PT100" value={data.humiHtPt100} unit="℃" color="text-purple-500" />
        
        <Row label="WARMER HEATER POWER" value={data.warmHtLvl} color="text-slate-500" />
        <Row label="WARMER HEATER PT100" value={data.warmHtPt100} unit="℃" color="text-slate-700" />
        
        <Row label="OXYGEN" value={data.oxygen} unit="%" color="text-emerald-500" />
        <Row label="TEMP. SENSOR #1" value={data.skin1Temp} unit="℃" color="text-orange-500" />
        <Row label="TEMP. SENSOR #2" value={data.skin2Temp} unit="℃" color="text-amber-500" />
        <Row label="WATER LEVEL" value={data.waterLvl} color="text-green-600" />
      </div>
    </div>
  );
};

export default memo(FixedAnnotation);
