
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
      <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">{label}</span>
      <span className={`text-[10px] font-mono font-bold ${color}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </span>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 p-3 rounded-xl shadow-sm w-full border-l-4 border-l-indigo-600 transition-all">
      <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-gray-100">
        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">[ PROBE READOUT ]</span>
        <span className="text-[9px] font-mono font-bold text-gray-600">
          {/* Ensure 24h format for Probe time */}
          {new Date(data.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
        </span>
      </div>
      <div className="space-y-0">
        <Row label="Air Temp" value={data.airTemp} unit="℃" color="text-red-500" />
        <Row label="Skin 1" value={data.skin1Temp} unit="℃" color="text-orange-500" />
        <Row label="Skin 2" value={data.skin2Temp} unit="℃" color="text-amber-500" />
        <Row label="Humidity" value={data.humidity} unit="%" color="text-blue-500" />
        <Row label="Oxygen" value={data.oxygen} unit="%" color="text-emerald-500" />
        <Row label="HT-A PT100" value={data.airHtPt100} color="text-fuchsia-500" />
        <Row label="HT-H PT100" value={data.humiHtPt100} color="text-purple-500" />
      </div>
    </div>
  );
};

export default memo(FixedAnnotation);
