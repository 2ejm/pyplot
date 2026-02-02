
import React, { useState, useCallback, memo, useMemo, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip, ReferenceLine
} from 'recharts';
import { LogEntry, ChartVisibility } from '../types';

interface LogChartProps {
  data: LogEntry[];
  highlightedTime?: number | null;
}

const CustomTooltip = ({ active, payload }: any) => {
  useEffect(() => {
    let isMounted = true;
    const timer = window.setTimeout(() => {
      if (!isMounted) return;
      try {
        if (active && payload && payload.length) {
          const detail = payload[0].payload;
          if (detail) {
            window.dispatchEvent(new CustomEvent('chart-hover', { detail }));
          }
        } else {
          window.dispatchEvent(new CustomEvent('chart-hover', { detail: null }));
        }
      } catch (e) {}
    }, 10);
    return () => {
      isMounted = false;
      window.clearTimeout(timer);
    };
  }, [active, payload]);
  return null;
};

/**
 * Strips the hidden sorting prefix (e.g., "A_", "B_") from the legend label
 */
const cleanLabel = (label: string) => {
  if (label.includes('_')) return label.split('_')[1];
  return label;
};

const RenderCustomLegend = (props: any) => {
  const { payload, onClick, visibility } = props;
  if (!payload) return null;
  
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-3 px-4">
      {payload.map((entry: any, index: number) => {
        const isVisible = visibility[entry.dataKey];
        const displayName = cleanLabel(entry.value);
        
        return (
          <div 
            key={`item-${index}`} 
            className="flex items-center gap-1.5 cursor-pointer group select-none"
            onClick={() => onClick(entry.dataKey)}
          >
            <div 
              className="w-3 h-0.5 rounded-full transition-all" 
              style={{ 
                backgroundColor: isVisible ? entry.color : '#e2e8f0',
                opacity: isVisible ? 1 : 0.3
              }} 
            />
            <span 
              className={`text-[9px] font-black uppercase tracking-tighter transition-all ${
                isVisible ? 'text-slate-600' : 'text-slate-300 line-through'
              } group-hover:text-indigo-600`}
            >
              {displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const INIT_LEFT_OFFSET = 25;   
const INIT_LEFT_SCALE = 20;    
const INIT_RIGHT_CENTER = 50;
const INIT_RIGHT_SPAN = 50.0;

const LogChart: React.FC<LogChartProps> = memo(({ data, highlightedTime }) => {
  const [visibility, setVisibility] = useState<ChartVisibility>({
    airTemp: true,
    airHtLvl: true,
    airHtPt100: true,
    humidity: true,
    humiHtLvl: true,
    humiHtPt100: true,
    warmHtLvl: true,
    warmHtPt100: true,
    oxygen: true,
    skin1Temp: true,
    skin2Temp: true,
    waterLvl: true,
  });

  const [leftOffset, setLeftOffset] = useState(INIT_LEFT_OFFSET);
  const [leftScale, setLeftScale] = useState(INIT_LEFT_SCALE);
  const [rightCenter, setRightCenter] = useState(INIT_RIGHT_CENTER);
  const [rightSpan, setRightSpan] = useState(INIT_RIGHT_SPAN);

  const p = (val: number) => Math.round(val * 100) / 100;
  const leftStep = useMemo(() => (leftScale <= 1.0 ? 0.1 : 1.0), [leftScale]);
  const leftDomain = useMemo<[number, number]>(() => [p(leftOffset), p(leftScale + leftOffset)], [leftOffset, leftScale]);
  const rightDomain = useMemo<[number, number]>(() => [p(rightCenter - rightSpan), p(rightCenter + rightSpan)], [rightCenter, rightSpan]);

  const toggleVisibility = useCallback((dataKey: string) => {
    setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  }, []);

  const resetLeft = () => { setLeftOffset(INIT_LEFT_OFFSET); setLeftScale(INIT_LEFT_SCALE); };
  const resetRight = () => { setRightCenter(INIT_RIGHT_CENTER); setRightSpan(INIT_RIGHT_SPAN); };

  const lineProps = {
    isAnimationActive: false,
    dot: false,
    connectNulls: true,
    strokeWidth: 1.5,
    activeDot: { r: 4, strokeWidth: 1, fill: '#fff', stroke: '#4f46e5' },
  };

  // STRICT ORDER WITH ALPHABETICAL PREFIXES TO FORCE SORTING
  const legendItems = useMemo(() => [
    { dataKey: 'airTemp', name: 'A_AIR', color: '#ef4444', yAxisId: 'left' },
    { dataKey: 'airHtLvl', name: 'B_AIR-PWR', color: '#0ea5e9', yAxisId: 'right' },
    { dataKey: 'airHtPt100', name: 'C_AIR-PT', color: '#d946ef', yAxisId: 'right' },
    { dataKey: 'humidity', name: 'D_HUMI', color: '#3b82f6', yAxisId: 'right' },
    { dataKey: 'humiHtLvl', name: 'E_HUMI-PWR', color: '#06b6d4', yAxisId: 'right' },
    { dataKey: 'humiHtPt100', name: 'F_HUMI-PT', color: '#a855f7', yAxisId: 'right' },
    { dataKey: 'warmHtLvl', name: 'G_WARM-PWR', color: '#64748b', yAxisId: 'right' },
    { dataKey: 'warmHtPt100', name: 'H_WARM-PT', color: '#475569', yAxisId: 'right' },
    { dataKey: 'oxygen', name: 'I_O2', color: '#22c55e', yAxisId: 'left' },
    { dataKey: 'skin1Temp', name: 'J_SKIN1', color: '#f97316', yAxisId: 'left' },
    { dataKey: 'skin2Temp', name: 'K_SKIN2', color: '#eab308', yAxisId: 'left' },
    { dataKey: 'waterLvl', name: 'L_WATER-LVL', color: '#10b981', yAxisId: 'right' },
  ], []);

  const legendPayload = useMemo(() => legendItems.map(item => ({
    dataKey: item.dataKey,
    value: item.name,
    type: 'line' as const,
    color: item.color,
  })), [legendItems]);

  const highlightedTimeString = useMemo(() => {
    if (!highlightedTime) return null;
    const entry = data.find(d => d.timestamp === highlightedTime);
    return entry ? entry.time : null;
  }, [highlightedTime, data]);

  const formatXAxis = (tickItem: string) => tickItem ? tickItem.split(' ')[0] : '';

  const OscBtnControl = ({ label, value, step, onChange, colorClass, icon, minLimit = -500 }: any) => (
    <div className="flex flex-col items-center gap-1 group">
      <div className={`p-1 rounded bg-gray-50 border border-gray-100 ${colorClass} shadow-sm mb-1`}>{icon}</div>
      <button onClick={() => onChange(p(value + step))} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-t-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
      </button>
      <div className="w-12 h-10 flex flex-col items-center justify-center bg-gray-50 border-x border-gray-200 py-1">
        <span className="text-[5px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-0.5">{label}</span>
        <span className={`text-[8px] font-mono font-black ${colorClass} leading-none`}>{value.toFixed(2)}</span>
      </div>
      <button onClick={() => onChange(p(Math.max(minLimit, value - step)))} className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-b-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  );

  return (
    <div className="w-full h-full bg-white flex flex-col p-1 overflow-hidden">
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex flex-col items-center justify-center gap-3 px-2 py-3 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm min-w-[76px]">
          <div className="text-[7px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-tighter mb-1">CH-L</div>
          <OscBtnControl label="SCALE" step={leftStep} value={leftScale} onChange={setLeftScale} colorClass="text-indigo-600" minLimit={0.1} icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} />
          <OscBtnControl label="OFFSET" step={leftStep} value={leftOffset} onChange={setLeftOffset} colorClass="text-red-500" icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} />
          <button onClick={resetLeft} className="mt-2 w-14 py-1 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-500 rounded text-[7px] font-black uppercase transition-all shadow-sm border border-transparent hover:border-red-600">RESET</button>
        </div>

        <div className="flex-1 min-w-0 bg-white relative rounded-xl overflow-hidden border border-gray-100 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="time" tickFormatter={formatXAxis} tick={{ fontSize: 8, fill: '#64748b', fontWeight: 'bold' }} interval="preserveStartEnd" minTickGap={20} stroke="#94a3b8" />
              <YAxis yAxisId="left" domain={leftDomain} allowDataOverflow={true} tickCount={11} tick={{ fontSize: 9, fill: '#ef4444', fontWeight: 'bold' }} stroke="#ef4444" strokeWidth={1} width={65} />
              <YAxis yAxisId="right" orientation="right" domain={rightDomain} allowDataOverflow={true} tickCount={11} tick={{ fontSize: 9, fill: '#3b82f6', fontWeight: 'bold' }} stroke="#3b82f6" strokeWidth={1} width={65} />
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={true} horizontal={true} strokeOpacity={1} />
              <Tooltip 
                content={<CustomTooltip />} 
                isAnimationActive={false} 
                cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 4' }} 
              />
              
              <Legend 
                content={<RenderCustomLegend visibility={visibility} onClick={toggleVisibility} />}
                {...({ payload: legendPayload } as any)}
              />

              {highlightedTimeString && (
                <ReferenceLine yAxisId="left" x={highlightedTimeString} stroke="#ef4444" strokeWidth={2} label={{ position: 'top', value: 'ALARM', fill: '#ef4444', fontSize: 10, fontWeight: '900' }} />
              )}

              {legendItems.map(item => (
                <Line
                  key={item.dataKey}
                  yAxisId={item.yAxisId}
                  type="monotone"
                  dataKey={item.dataKey}
                  name={item.name}
                  stroke={item.color}
                  {...lineProps}
                  strokeWidth={item.yAxisId === 'right' && item.dataKey.includes('Ht') ? 1 : 1.5}
                  hide={!visibility[item.dataKey]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 px-2 py-3 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm min-w-[76px]">
          <div className="text-[7px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tighter mb-1">CH-R</div>
          <OscBtnControl label="SCALE" step={5.0} value={rightSpan} onChange={setRightSpan} colorClass="text-indigo-600" icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} />
          <OscBtnControl label="OFFSET" step={1.0} value={rightCenter} onChange={setRightCenter} colorClass="text-blue-500" icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} />
          <button onClick={resetRight} className="mt-2 w-14 py-1 bg-gray-200 hover:bg-blue-500 hover:text-white text-gray-500 rounded text-[7px] font-black uppercase transition-all shadow-sm border border-transparent hover:border-blue-600">RESET</button>
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between px-4">
         <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse" />
               <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">L-CH: Range [{leftDomain[0].toFixed(2)} to {leftDomain[1].toFixed(2)}]</span>
            </div>
            <div className="flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] animate-pulse" />
               <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">R-CH: Range [{rightDomain[0].toFixed(1)} to {rightDomain[1].toFixed(1)}]</span>
            </div>
         </div>
         <p className="text-[7px] font-bold text-gray-300 uppercase tracking-[0.3em]">MED-ANALYZER BCD Matrix (12 Modalities) • High-Contrast Grey Grid</p>
      </div>
    </div>
  );
});

export default LogChart;
