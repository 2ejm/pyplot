
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
      <div className="bg-white border border-gray-200 rounded-xl p-10 shadow-sm w-full min-h-[300px] flex flex-col items-center justify-center border-dashed">
        <p className="text-gray-300 text-sm font-black uppercase tracking-[0.3em] italic">Probe Inactive</p>
      </div>
    );
  }

  const Row = ({ label, value, unit = "", color = "text-gray-900" }: { label: string, value: number | string, unit?: string, color?: string }) => (
    <div className="flex justify-between items-center gap-8 py-1.5 border-b border-gray-50 last:border-0 transition-colors">
      <span className={`text-[13px] font-black uppercase tracking-widest leading-none ${color}`}>{label}</span>
      <span className={`text-[16px] font-mono font-bold ${color}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </span>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 p-3 rounded-xl w-full transition-all">
      <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-100">
        <span className="text-[14px] font-black text-indigo-600 uppercase tracking-[0.2em] leading-none">[ READOUT ]</span>
        <span className="text-[14px] font-black font-bold text-gray-600">
          {new Date(data.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>
      <div className="flex flex-col gap-y-0">
        <Row label="AIR TEMPERATURE" value={data.airTemp} unit="℃" color="text-red-600" />
        <Row label="AIR HEATER POWER" value={data.airHtLvl} color="text-sky-600" />
        <Row label="AIR HEATER PT100" value={data.airHtPt100} unit="℃" color="text-fuchsia-600" />
        
        <Row label="HUMIDITY" value={data.humidity} unit="%" color="text-blue-600" />
        <Row label="HUMIDITY HEATER POWER" value={data.humiHtLvl} color="text-cyan-600" />
        <Row label="HUMIDITY HEATER PT100" value={data.humiHtPt100} unit="℃" color="text-purple-600" />
        
        <Row label="WARMER HEATER POWER" value={data.warmHtLvl} color="text-slate-600" />
        <Row label="WARMER HEATER PT100" value={data.warmHtPt100} unit="℃" color="text-slate-800" />
        
        <Row label="OXYGEN" value={data.oxygen} unit="%" color="text-emerald-600" />
        <Row label="TEMP. SENSOR #1" value={data.skin1Temp} unit="℃" color="text-orange-600" />
        <Row label="TEMP. SENSOR #2" value={data.skin2Temp} unit="℃" color="text-amber-600" />
        <Row label="WATER LEVEL" value={data.waterLvl} color="text-green-700" />
      </div>
    </div>
  );
};

export default memo(FixedAnnotation);
