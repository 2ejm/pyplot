
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
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 pt-5 px-6">
      {payload.map((entry: any, index: number) => {
        const isVisible = visibility[entry.dataKey];
        const displayName = cleanLabel(entry.value);
        
        return (
          <div 
            key={`item-${index}`} 
            className="flex items-center gap-2 cursor-pointer group select-none"
            onClick={() => onClick(entry.dataKey)}
          >
            <div 
              className="w-4 h-1 rounded-full transition-all" 
              style={{ 
                backgroundColor: isVisible ? entry.color : '#e2e8f0',
                opacity: isVisible ? 1 : 0.3
              }} 
            />
            <span 
              className={`text-[11px] font-black uppercase tracking-tighter transition-all ${
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

const useContinuousPress = (callback: () => void, onStart?: () => void) => {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const callbackRef = useRef(callback);

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
    callbackRef.current(); 

    window.addEventListener('mouseup', stop);
    window.addEventListener('touchend', stop);

    timeoutRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        callbackRef.current();
      }, 200); 
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

const INIT_LEFT_OFFSET = 0;   
const INIT_LEFT_SCALE = 120;    
const INIT_RIGHT_OFFSET = 0;
const INIT_RIGHT_SCALE = 120;
const STEP = 5;

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
  const [rightOffset, setRightOffset] = useState(INIT_RIGHT_OFFSET);
  const [rightScale, setRightScale] = useState(INIT_RIGHT_SCALE);

  const [focusContext, setFocusContext] = useState<{ channel: 'left' | 'right', param: 'scale' | 'offset' }>({
    channel: 'left',
    param: 'scale'
  });

  const p = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return 0;
    return Math.round(val * 100) / 100;
  };

  const leftDomain = useMemo<[number, number]>(() => {
    const min = p(leftOffset);
    const max = p(leftScale + leftOffset);
    return [min, max];
  }, [leftOffset, leftScale]);

  const rightDomain = useMemo<[number, number]>(() => {
    const min = p(rightOffset);
    const max = p(rightScale + rightOffset);
    return [min, max];
  }, [rightOffset, rightScale]);

  const toggleVisibility = useCallback((dataKey: string) => {
    setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  }, []);

  const resetLeft = () => { 
    setLeftOffset(INIT_LEFT_OFFSET); 
    setLeftScale(INIT_LEFT_SCALE); 
    setFocusContext({ channel: 'left', param: 'scale' });
  };
  const resetRight = () => { 
    setRightOffset(INIT_RIGHT_OFFSET); 
    setRightScale(INIT_RIGHT_SCALE); 
    setFocusContext({ channel: 'right', param: 'scale' });
  };

  const adjustValue = useCallback((channel: 'left' | 'right', param: 'scale' | 'offset', direction: 1 | -1) => {
    const step = STEP;
    if (channel === 'left') {
      if (param === 'scale') {
        setLeftScale(prev => p(Math.max(5, prev + (direction * step))));
      } else {
        setLeftOffset(prev => p(prev + (direction * step)));
      }
    } else {
      if (param === 'scale') {
        setRightScale(prev => p(Math.max(5, prev + (direction * step))));
      } else {
        setRightOffset(prev => p(prev + (direction * step)));
      }
    }
  }, []);

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
      <div className={`flex flex-col items-center gap-1.5 group rounded-2xl p-2 transition-all ${isActive ? 'ring-4 ring-indigo-500/10 bg-indigo-50/50 shadow-md' : ''}`}>
        <div className={`p-1.5 rounded-lg bg-gray-50 border border-gray-100 ${colorClass} shadow-sm mb-1`}>{icon}</div>
        <button 
          {...pressUp}
          className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-t-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm active:bg-gray-100 outline-none select-none touch-none"
        >
          <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        </button>
        <div className="w-16 h-12 flex flex-col items-center justify-center bg-gray-50 border-x border-gray-200 py-1">
          <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</span>
          <span className={`text-[11px] font-mono font-black ${colorClass} leading-none`}>{Math.round(value)}</span>
        </div>
        <button 
          {...pressDown}
          className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-b-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm active:bg-gray-100 outline-none select-none touch-none"
        >
          <svg className="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-white flex flex-col p-2 overflow-hidden">
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex flex-col items-center justify-center gap-4 px-3 py-4 bg-gray-50/50 rounded-3xl border border-gray-100 shadow-sm min-w-[90px]">
          <div className="text-[9px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-lg border border-red-100 uppercase tracking-widest mb-1">CH-L</div>
          <OscBtnControl 
            label="SCALE" 
            value={leftScale} 
            channel="left" 
            param="scale" 
            colorClass="text-red-600" 
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} 
          />
          <OscBtnControl 
            label="OFFSET" 
            value={leftOffset} 
            channel="left" 
            param="offset" 
            colorClass="text-red-500" 
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} 
          />
          <button onClick={resetLeft} className="mt-2 w-16 py-1.5 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-500 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm border border-transparent">RESET</button>
        </div>

        <div className="flex-1 min-w-0 bg-white relative rounded-2xl overflow-hidden border border-gray-100 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 30, right: 15, left: 15, bottom: 10 }}>
              <XAxis dataKey="time" tickFormatter={formatXAxis} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} interval="preserveStartEnd" minTickGap={25} stroke="#cbd5e1" />
              <YAxis yAxisId="left" domain={leftDomain} allowDataOverflow={true} tickCount={11} tick={{ fontSize: 11, fill: '#ef4444', fontWeight: 'bold' }} stroke="#ef4444" strokeWidth={1.5} width={70} />
              <YAxis yAxisId="right" orientation="right" domain={rightDomain} allowDataOverflow={true} tickCount={11} tick={{ fontSize: 11, fill: '#3b82f6', fontWeight: 'bold' }} stroke="#3b82f6" strokeWidth={1.5} width={70} />
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} horizontal={true} strokeOpacity={0.8} />
              <Tooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 5' }} />
              <Legend content={<RenderCustomLegend visibility={visibility} onClick={toggleVisibility} />} {...({ payload: legendPayload } as any)} />

              {highlightedTimeString && (
                <ReferenceLine 
                  yAxisId="left" x={highlightedTimeString} stroke="#ef4444" strokeWidth={2.5} strokeDasharray="6 3"
                  label={{ position: 'top', value: 'ALARM', fill: '#ef4444', fontSize: 11, fontWeight: '900' }} 
                />
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
                  strokeWidth={item.yAxisId === 'right' && item.dataKey.includes('Ht') ? 1.5 : 2}
                  activeDot={{ r: 5, strokeWidth: 1.5, fill: '#fff', stroke: '#4f46e5' }}
                  hide={!visibility[item.dataKey]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 px-3 py-4 bg-gray-50/50 rounded-3xl border border-gray-100 shadow-sm min-w-[90px]">
          <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 uppercase tracking-widest mb-1">CH-R</div>
          <OscBtnControl 
            label="SCALE" 
            value={rightScale} 
            channel="right" 
            param="scale" 
            colorClass="text-blue-600" 
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} 
          />
          <OscBtnControl 
            label="OFFSET" 
            value={rightOffset} 
            channel="right" 
            param="offset" 
            colorClass="text-blue-500" 
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} 
          />
          <button onClick={resetRight} className="mt-2 w-16 py-1.5 bg-gray-200 hover:bg-blue-500 hover:text-white text-gray-500 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm border border-transparent">RESET</button>
        </div>
      </div>
    </div>
  );
});

export default LogChart;
