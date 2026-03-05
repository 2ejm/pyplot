import React, { useState, useCallback, memo, useMemo, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip, ReferenceLine
} from 'recharts';
import { LogEntry, ChartVisibility } from '../types';

interface LogChartProps {
  data: LogEntry[];
  highlightedTime?: number | null;
  leftOffset: number;
  leftScale: number;
  rightOffset: number;
  rightScale: number;
  onSettingsChange: (settings: { leftOffset?: number, leftScale?: number, rightOffset?: number, rightScale?: number }) => void;
}

// --- 보조 컴포넌트: CustomTooltip ---
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

// --- 보조 컴포넌트: RenderCustomLegend (수정됨) ---
const RenderCustomLegend = (props: any) => {
  const { payload, onClick, visibility, onToggleAll } = props;
  if (!payload) return null;
  
  return (
    <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-4 pt-6 px-8">
      {/* 일괄 선택/해제 컨트롤 그룹 */}
      <div className="flex items-center gap-2 pr-6 border-r border-slate-200">
        <button 
          onClick={() => onToggleAll(true)}
          className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter bg-indigo-50 px-2 py-1 rounded"
        >
          Show All
        </button>
        <button 
          onClick={() => onToggleAll(false)}
          className="text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-tighter bg-slate-50 px-2 py-1 rounded"
        >
          Hide All
        </button>
      </div>

      {/* 개별 범례 아이템 */}
      {payload.map((entry: any, index: number) => {
        const isVisible = visibility[entry.dataKey];
        const displayName = cleanLabel(entry.value);
        
        return (
          <div 
            key={`item-${index}`} 
            className="flex items-center gap-3 cursor-pointer group select-none"
            onClick={() => onClick(entry.dataKey)}
          >
            <div 
              className="w-5 h-1.5 rounded-full transition-all" 
              style={{ 
                backgroundColor: isVisible ? entry.color : '#e2e8f0',
                opacity: isVisible ? 1 : 0.3
              }} 
            />
            <span 
              className={`text-[13px] font-black uppercase tracking-tight transition-all ${
                isVisible ? '' : 'text-slate-300 line-through'
              } group-hover:brightness-75`}
              style={{ color: isVisible ? entry.color : undefined }}
            >
              {displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// --- Custom Hook: useContinuousPress ---
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

const STEP = 5;

// --- 메인 컴포넌트: LogChart ---
const LogChart: React.FC<LogChartProps> = memo(({ 
  data, 
  highlightedTime, 
  leftOffset, 
  leftScale, 
  rightOffset, 
  rightScale, 
  onSettingsChange 
}) => {
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

  // --- 추가된 기능: 전체 선택/해제 ---
  const toggleAllVisibility = useCallback((show: boolean) => {
    setVisibility(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key as keyof ChartVisibility] = show;
      });
      return next;
    });
  }, []);

  const resetLeft = () => { 
    onSettingsChange({ leftOffset: 0, leftScale: 120 });
    setFocusContext({ channel: 'left', param: 'scale' });
  };
  const resetRight = () => { 
    onSettingsChange({ rightOffset: 0, rightScale: 120 });
    setFocusContext({ channel: 'right', param: 'scale' });
  };

  const adjustValue = useCallback((channel: 'left' | 'right', param: 'scale' | 'offset', direction: 1 | -1) => {
    const step = STEP;
    if (channel === 'left') {
      if (param === 'scale') {
        onSettingsChange({ leftScale: p(Math.max(5, leftScale + (direction * step))) });
      } else {
        onSettingsChange({ leftOffset: p(leftOffset + (direction * step)) });
      }
    } else {
      if (param === 'scale') {
        onSettingsChange({ rightScale: p(Math.max(5, rightScale + (direction * step))) });
      } else {
        onSettingsChange({ rightOffset: p(rightOffset + (direction * step)) });
      }
    }
  }, [leftOffset, leftScale, rightOffset, rightScale, onSettingsChange]);

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
    { dataKey: 'airTemp', name: 'A_◂ AIR', color: '#ef4444', yAxisId: 'left' },
    { dataKey: 'airHtLvl', name: 'B_AIR-PWR ▸', color: '#0ea5e9', yAxisId: 'right' },
    { dataKey: 'airHtPt100', name: 'C_AIR-PT ▸', color: '#d946ef', yAxisId: 'right' },
    { dataKey: 'humidity', name: 'D_HUMI ▸', color: '#3b82f6', yAxisId: 'right' },
    { dataKey: 'humiHtLvl', name: 'E_HUMI-PWR ▸', color: '#06b6d4', yAxisId: 'right' },
    { dataKey: 'humiHtPt100', name: 'F_HUMI-PT ▸', color: '#a855f7', yAxisId: 'right' },
    { dataKey: 'warmHtLvl', name: 'G_WARM-PWR ▸', color: '#64748b', yAxisId: 'right' },
    { dataKey: 'warmHtPt100', name: 'H_WARM-PT ▸', color: '#475569', yAxisId: 'right' },
    { dataKey: 'oxygen', name: 'I_◂ O2', color: '#22c55e', yAxisId: 'left' },
    { dataKey: 'skin1Temp', name: 'J_◂ SKIN1', color: '#f97316', yAxisId: 'left' },
    { dataKey: 'skin2Temp', name: 'K_◂ SKIN2', color: '#eab308', yAxisId: 'left' },
    { dataKey: 'waterLvl', name: 'L_WATER-LVL ▸', color: '#10b981', yAxisId: 'right' },
  ], []);

  const legendPayload = useMemo(() => legendItems.map(item => ({
    dataKey: item.dataKey,
    value: item.name,
    type: 'line' as const,
    color: item.color,
  })), [legendItems]);

  const formatXAxis = (ts: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-GB', { hour12: false });
  };

  const OscBtnControl = ({ label, value, channel, param, colorClass, icon }: any) => {
    const isActive = focusContext.channel === channel && focusContext.param === param;
    const onAction = useCallback((dir: 1 | -1) => adjustValue(channel, param, dir), [channel, param, adjustValue]);
    const setFocus = useCallback(() => setFocusContext({ channel, param }), [channel, param]);

    const pressUp = useContinuousPress(() => onAction(1), setFocus);
    const pressDown = useContinuousPress(() => onAction(-1), setFocus);

    return (
      <div className={`flex flex-col items-center gap-2 group rounded-[2rem] p-3 transition-all ${isActive ? 'ring-8 ring-indigo-500/5 bg-indigo-50/50 shadow-md' : ''}`}>
        <div className={`p-2 rounded-xl bg-white border border-gray-100 ${colorClass} shadow-sm mb-1`}>{icon}</div>
        <button 
          {...pressUp}
          className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-t-2xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm active:bg-gray-100 outline-none select-none touch-none"
        >
          <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
        </button>
        <div className="w-20 h-16 flex flex-col items-center justify-center bg-gray-50 border-x border-gray-200 py-1">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1.5">{label}</span>
          <span className={`text-[15px] font-mono font-black ${colorClass} leading-none`}>{Math.round(value)}</span>
        </div>
        <button 
          {...pressDown}
          className="w-12 h-12 flex items-center justify-center bg-white border border-gray-200 rounded-b-2xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm active:bg-gray-100 outline-none select-none touch-none"
        >
          <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>
    );
  };

  return (
    <div className="w-full h-full bg-white flex flex-col p-2 overflow-hidden">
      <div className="flex-1 flex gap-5 min-h-0">
        {/* CH-L Controls */}
        <div className="flex flex-col items-center justify-center gap-5 px-4 py-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 shadow-sm min-w-[110px]">
          <div className="text-[10px] font-black text-red-600 bg-red-100 px-4 py-2 rounded-xl border border-red-200 uppercase tracking-widest mb-1 shadow-sm">CH-L</div>
          <OscBtnControl 
            label="SCALE" 
            value={leftScale} 
            channel="left" 
            param="scale" 
            colorClass="text-red-600" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} 
          />
          <OscBtnControl 
            label="OFFSET" 
            value={leftOffset} 
            channel="left" 
            param="offset" 
            colorClass="text-red-500" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} 
          />
          <button onClick={resetLeft} className="mt-2 w-20 py-2 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-500 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95">RESET</button>
        </div>

        {/* Chart Area */}
        <div className="flex-1 min-w-0 bg-white relative rounded-[2.5rem] overflow-hidden border border-gray-100 shadow-inner flex flex-col">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 40, right: 20, left: 20, bottom: 15 }}>
              <XAxis 
                type="number"
                dataKey="timestamp" 
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatXAxis} 
                tick={{ fontSize: 13, fill: '#64748b', fontWeight: 'bold' }} 
                stroke="#cbd5e1"
              />
              <YAxis yAxisId="left" domain={leftDomain} allowDataOverflow={true} tickCount={11} tick={{ fontSize: 14, fill: '#ef4444', fontWeight: 'bold' }} stroke="#ef4444" strokeWidth={2} width={75} />
              <YAxis yAxisId="right" orientation="right" domain={rightDomain} allowDataOverflow={true} tickCount={11} tick={{ fontSize: 14, fill: '#3b82f6', fontWeight: 'bold' }} stroke="#3b82f6" strokeWidth={2} width={75} />
              <CartesianGrid  yAxisId="left"  strokeDasharray="3 3" stroke="#e2e8f0" vertical={true} horizontal={true} strokeOpacity={0.8} />
              <Tooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ stroke: '#6366f1', strokeWidth: 2.5, strokeDasharray: '6 6' }} />
              
              {/* 범례에 onToggleAll 전달 */}
              <Legend 
                content={<RenderCustomLegend visibility={visibility} onClick={toggleVisibility} onToggleAll={toggleAllVisibility} />} 
                {...({ payload: legendPayload } as any)} 
              />

              {highlightedTime && (
                <ReferenceLine 
                  yAxisId="left" 
                  x={highlightedTime} 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  strokeDasharray="8 4"
                  label={{ position: 'top', value: 'ALARM', fill: '#ef4444', fontSize: 14, fontWeight: '900' }} 
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
                  connectNulls={false}
                  strokeWidth={item.yAxisId === 'right' && item.dataKey.includes('Ht') ? 2 : 2.5}
                  activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#4f46e5' }}
                  hide={!visibility[item.dataKey as keyof ChartVisibility]}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* CH-R Controls */}
        <div className="flex flex-col items-center justify-center gap-5 px-4 py-8 bg-gray-50/50 rounded-[2.5rem] border border-gray-100 shadow-sm min-w-[110px]">
          <div className="text-[10px] font-black text-blue-600 bg-blue-100 px-4 py-2 rounded-xl border border-blue-200 uppercase tracking-widest mb-1 shadow-sm">CH-R</div>
          <OscBtnControl 
            label="SCALE" 
            value={rightScale} 
            channel="right" 
            param="scale" 
            colorClass="text-blue-600" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>} 
          />
          <OscBtnControl 
            label="OFFSET" 
            value={rightOffset} 
            channel="right" 
            param="offset" 
            colorClass="text-blue-500" 
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>} 
          />
          <button onClick={resetRight} className="mt-2 w-20 py-2 bg-gray-200 hover:bg-blue-500 hover:text-white text-gray-500 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95">RESET</button>
        </div>
      </div>
    </div>
  );
});

export default LogChart;
