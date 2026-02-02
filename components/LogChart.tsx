
import React, { useState, useCallback, memo, useMemo, useEffect, useRef } from 'react';
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

const cleanLabel = (label: string) => {
  if (label && label.includes('_')) return label.split('_')[1];
  return label || '';
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

// Ref-based hook for stable continuous action intervals
const useContinuousPress = (callback: () => void, onStart?: () => void) => {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);

  // Update ref so interval always has the latest callback without re-binding
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const stop = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    window.removeEventListener('mouseup', stop);
    window.removeEventListener('touchend', stop);
  }, []);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (onStart) onStart();
    callbackRef.current(); // Immediate action

    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);

    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        callbackRef.current();
      }, 500); // 2Hz frequency
    }, 500);
  }, [stop, onStart]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    onMouseDown: start,
    onTouchStart: start,
    onMouseLeave: stop,
  };
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

  const [focusContext, setFocusContext] = useState<{ channel: 'left' | 'right', param: 'scale' | 'offset' }>({
    channel: 'left',
    param: 'scale'
  });

  const p = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return 0;
    return Math.round(val * 100) / 100;
  };

  const leftStep = useMemo(() => (leftScale <= 1.0 ? 0.1 : 1.0), [leftScale]);

  // Defensive domain calculation
  const leftDomain = useMemo<[number, number]>(() => {
    const min = p(leftOffset);
    const max = p(leftScale + leftOffset);
    return [min, max];
  }, [leftOffset, leftScale]);

  const rightDomain = useMemo<[number, number]>(() => {
    const min = p(rightCenter - rightSpan);
    const max = p(rightCenter + rightSpan);
    return [min, max];
  }, [rightCenter, rightSpan]);

  const toggleVisibility = useCallback((dataKey: string) => {
    setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  }, []);

  const resetLeft = () => { 
    setLeftOffset(INIT_LEFT_OFFSET); 
    setLeftScale(INIT_LEFT_SCALE); 
    setFocusContext({ channel: 'left', param: 'scale' });
  };
  const resetRight = () => { 
    setRightCenter(INIT_RIGHT_CENTER); 
    setRightSpan(INIT_RIGHT_SPAN); 
    setFocusContext({ channel: 'right', param: 'scale' });
  };

  const adjustValue = useCallback((channel: 'left' | 'right', param: 'scale' | 'offset', direction: 1 | -1) => {
    if (channel === 'left') {
      const step = leftScale <= 1.0 ? 0.1 : 1.0;
      if (param === 'scale') {
        setLeftScale(prev => p(Math.max(0.1, prev + (direction * step))));
      } else {
        setLeftOffset(prev => p(prev + (direction * step)));
      }
    } else {
      if (param === 'scale') {
        setRightSpan(prev => p(Math.max(1, prev + (direction * 5.0))));
      } else {
        setRightCenter(prev => p(prev + (direction * 1.0)));
      }
    }
  }, [leftScale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        adjustValue(focusContext.channel, focusContext.param, 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        adjustValue(focusContext.channel, focusContext.param, -1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusContext, adjustValue]);

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

  const formatXAxis = (tickItem: string) => (tickItem ? tickItem.split(' ')[0] : '');

  const OscBtnControl = ({ label, value, channel, param, colorClass, icon }: any) => {
    const isActive = focusContext.channel === channel && focusContext.param === param;
    const onAction = useCallback((dir: 1 | -1) => adjustValue(channel, param, dir), [channel, param, adjustValue]);
    const setFocus = useCallback(() => setFocusContext({ channel, param }), [channel, param]);

    const pressUp = useContinuousPress(() => onAction(1), setFocus);
    const pressDown = useContinuousPress(() => onAction(-1), setFocus);

    return (
      <div className={`flex flex-col items-center gap-1 group rounded-xl p-1 transition-all ${isActive ? 'ring-2 ring-indigo-400 bg-indigo-50/50 shadow-lg' : ''}`}>
        <div className={`p-1 rounded bg-gray-50 border border-gray-100 ${colorClass} shadow-sm mb-1`}>{icon}</div>
        <button 
          {...pressUp}
          className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-t-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm active:bg-gray-200 outline-none select-none touch-none"
        >
          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        </button>
        <div className="w-12 h-10 flex flex-col items-center justify-center bg-gray-50 border-x border-gray-200 py-1">
          <span className="text-[5px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-0.5">{label}</span>
          <span className={`text-[8px] font-mono font-black ${colorClass} leading-none`}>{typeof value === 'number' ? value.toFixed(2) : '0.00'}</span>
        </div>
        <button 
          {...pressDown}
          className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-b-lg hover:bg-gray-50 text-gray-600 transition-colors shadow-sm active:bg-gray-200 outline-none select-none touch-none"
        >
          <svg className="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-white flex flex-col p-1 overflow-hidden">
      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex flex-col items-center justify-center gap-3 px-2 py-3 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm min-w-[76px]">
          <div className="text-[7px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-tighter mb-1">CH-L</div>
          <OscBtnControl 
            label="SCALE" 
            value={leftScale} 
            channel="left" 
            param="scale" 
            colorClass="text-indigo-600" 
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} 
          />
          <OscBtnControl 
            label="OFFSET" 
            value={leftOffset} 
            channel="left" 
            param="offset" 
            colorClass="text-red-500" 
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} 
          />
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
                  isAnimationActive={false}
                  dot={false}
                  connectNulls={true}
                  strokeWidth={item.yAxisId === 'right' && item.dataKey.includes('Ht') ? 1 : 1.5}
                  activeDot={{ r: 4, strokeWidth: 1, fill: '#fff', stroke: '#4f46e5' }}
                  hide={!visibility[item.dataKey]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 px-2 py-3 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm min-w-[76px]">
          <div className="text-[7px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tighter mb-1">CH-R</div>
          <OscBtnControl 
            label="SCALE" 
            value={rightSpan} 
            channel="right" 
            param="scale" 
            colorClass="text-indigo-600" 
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} 
          />
          <OscBtnControl 
            label="OFFSET" 
            value={rightCenter} 
            channel="right" 
            param="offset" 
            colorClass="text-blue-500" 
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} 
          />
          <button onClick={resetRight} className="mt-2 w-14 py-1 bg-gray-200 hover:bg-blue-500 hover:text-white text-gray-500 rounded text-[7px] font-black uppercase transition-all shadow-sm border border-transparent hover:border-blue-600">RESET</button>
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between px-4">
         <div className="flex flex-col gap-1">
            <div className="flex gap-4">
               <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse" />
                  <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">
                    L-CH: Range [{leftDomain[0].toFixed(2)} to {leftDomain[1].toFixed(2)}]
                  </span>
               </div>
               <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)] animate-pulse" />
                  <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none">
                    R-CH: Range [{rightDomain[0].toFixed(1)} to {rightDomain[1].toFixed(1)}]
                  </span>
               </div>
            </div>
            <p className="text-[7px] font-black text-indigo-500/60 uppercase tracking-widest animate-pulse">
               Keyboard Active: {focusContext.channel.toUpperCase()} CH {focusContext.param.toUpperCase()} (Up/Down Arrows)
            </p>
         </div>
         <p className="text-[7px] font-bold text-gray-300 uppercase tracking-[0.3em]">MED-ANALYZER BCD Matrix (12 Modalities) • High-Contrast Grey Grid</p>
      </div>
    </div>
  );
});

export default LogChart;
