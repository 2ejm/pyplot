
import React, { useState, useCallback, memo, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer, Tooltip
} from 'recharts';
import { LogEntry, ChartVisibility } from '../types';

interface LogChartProps {
  data: LogEntry[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  React.useEffect(() => {
    if (active && payload && payload.length) {
      window.dispatchEvent(new CustomEvent('chart-hover', { detail: payload[0].payload }));
    } else {
      window.dispatchEvent(new CustomEvent('chart-hover', { detail: null }));
    }
  }, [active, payload]);

  return null;
};

// Initial Constants
// For Channel L: Min = Offset, Max = Scale + Offset
const INIT_LEFT_OFFSET = 25;   // V-POS (Starting Min)
const INIT_LEFT_SCALE = 20;    // V-SCALE (Range from Min)
// For Channel R: Min = Center - Span, Max = Center + Span
const INIT_RIGHT_CENTER = 50;
const INIT_RIGHT_SPAN = 50.0;

const LogChart: React.FC<LogChartProps> = memo(({ data }) => {
  const [visibility, setVisibility] = useState<ChartVisibility>({
    airTemp: true,
    skin1Temp: true,
    skin2Temp: true,
    humidity: true,
    oxygen: true,
    airHtLvl: true,
    warmHtLvl: true,
    airHtPt100: true,
    humiHtPt100: true,
  });

  // LEFT AXIS (Temperature / Oxygen)
  const [leftOffset, setLeftOffset] = useState(INIT_LEFT_OFFSET);
  const [leftScale, setLeftScale] = useState(INIT_LEFT_SCALE);

  // RIGHT AXIS (Humidity / Power)
  const [rightCenter, setRightCenter] = useState(INIT_RIGHT_CENTER);
  const [rightSpan, setRightSpan] = useState(INIT_RIGHT_SPAN);

  // Precision Rounding Helper to prevent 0.30000000000000004 issues
  const p = (val: number) => Math.round(val * 100) / 100;

  // Dynamic Step for Channel L
  const leftStep = useMemo(() => (leftScale <= 1.0 ? 0.1 : 1.0), [leftScale]);

  // Computed Domains
  // L-CH: [Offset, Scale + Offset]
  const leftDomain = useMemo<[number, number]>(() => [p(leftOffset), p(leftScale + leftOffset)], [leftOffset, leftScale]);
  // R-CH: [Center - Span, Center + Span]
  const rightDomain = useMemo<[number, number]>(() => [p(rightCenter - rightSpan), p(rightCenter + rightSpan)], [rightCenter, rightSpan]);

  const toggleVisibility = useCallback((dataKey: string) => {
    setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  }, []);

  const resetLeft = () => {
    setLeftOffset(INIT_LEFT_OFFSET);
    setLeftScale(INIT_LEFT_SCALE);
  };

  const resetRight = () => {
    setRightCenter(INIT_RIGHT_CENTER);
    setRightSpan(INIT_RIGHT_SPAN);
  };

  const lineProps = {
    isAnimationActive: false,
    dot: false,
    connectNulls: true,
    strokeWidth: 1.5,
    activeDot: { r: 4, strokeWidth: 1, fill: '#fff', stroke: '#4f46e5' },
  };

  const formatXAxis = (tickItem: string) => tickItem.split(' ')[0];

  // Button-based Step Control with precision rounding and minimum limit
  const OscBtnControl = ({ 
    label, value, step, onChange, colorClass, icon, minLimit = -500
  }: { 
    label: string, value: number, step: number, onChange: (v: number) => void, colorClass: string, icon: React.ReactNode, minLimit?: number
  }) => (
    <div className="flex flex-col items-center gap-1 group">
      <div className={`p-1 rounded bg-gray-50 border border-gray-100 ${colorClass} shadow-sm mb-1`}>
        {icon}
      </div>
      <button 
        onClick={() => onChange(p(value + step))}
        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-t-lg hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
      </button>
      <div className="w-12 h-10 flex flex-col items-center justify-center bg-gray-50 border-x border-gray-200 py-1">
        <span className="text-[5px] font-black text-gray-400 uppercase tracking-tighter leading-none mb-0.5">{label}</span>
        <span className={`text-[8px] font-mono font-black ${colorClass} leading-none`}>
          {value.toFixed(2)}
        </span>
      </div>
      <button 
        onClick={() => onChange(p(Math.max(minLimit, value - step)))}
        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 rounded-b-lg hover:bg-gray-50 active:bg-gray-100 text-gray-600 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
      </button>
    </div>
  );

  return (
    <div className="w-full h-full bg-white flex flex-col p-1 overflow-hidden">
      <div className="flex-1 flex gap-3 min-h-0">
        
        {/* LEFT CHANNEL PANEL (L-CH) */}
        <div className="flex flex-col items-center justify-center gap-3 px-2 py-3 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm min-w-[76px]">
          <div className="text-[7px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 uppercase tracking-tighter mb-1">CH-L</div>
          
          <OscBtnControl 
            label="SCALE" 
            step={leftStep} 
            value={leftScale} 
            onChange={setLeftScale} 
            colorClass="text-indigo-600"
            minLimit={0.1}
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>}
          />
          
          <OscBtnControl 
            label="OFFSET" 
            step={leftStep} 
            value={leftOffset} 
            onChange={setLeftOffset} 
            colorClass="text-red-500"
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
          />

          <button 
            onClick={resetLeft}
            className="mt-2 w-14 py-1 bg-gray-200 hover:bg-red-500 hover:text-white text-gray-500 rounded text-[7px] font-black uppercase transition-all shadow-sm border border-transparent hover:border-red-600"
          >
            RESET
          </button>
        </div>

        {/* MAIN CRT DISPLAY */}
        <div className="flex-1 min-w-0 bg-white relative rounded-xl overflow-hidden border border-gray-100 shadow-inner">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={data} 
              margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={true} />
              <XAxis 
                dataKey="time" 
                tickFormatter={formatXAxis}
                tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 'bold' }}
                interval="preserveStartEnd"
                minTickGap={60}
                stroke="#f1f5f9"
              />
              <YAxis 
                yAxisId="left" 
                domain={leftDomain} 
                allowDataOverflow={true}
                tick={{ fontSize: 9, fill: '#ef4444', fontWeight: 'bold' }}
                stroke="#ef4444"
                strokeWidth={0.5}
                width={65}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                domain={rightDomain} 
                allowDataOverflow={true}
                tick={{ fontSize: 9, fill: '#3b82f6', fontWeight: 'bold' }}
                stroke="#3b82f6"
                strokeWidth={0.5}
                width={65}
              />
              
              <Tooltip 
                content={<CustomTooltip />} 
                isAnimationActive={false}
                cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              
              <Legend 
                onClick={(e) => toggleVisibility(e.dataKey as string)}
                wrapperStyle={{ cursor: 'pointer', fontSize: '9px', fontWeight: '900', paddingTop: '10px' }}
              />

              <Line yAxisId="left" type="monotone" dataKey="airTemp" name="AIR" stroke="#ef4444" {...lineProps} hide={!visibility.airTemp} />
              <Line yAxisId="left" type="monotone" dataKey="skin1Temp" name="SKIN1" stroke="#f97316" {...lineProps} hide={!visibility.skin1Temp} />
              <Line yAxisId="left" type="monotone" dataKey="skin2Temp" name="SKIN2" stroke="#eab308" {...lineProps} hide={!visibility.skin2Temp} />
              <Line yAxisId="left" type="monotone" dataKey="oxygen" name="O2" stroke="#22c55e" {...lineProps} hide={!visibility.oxygen} />

              <Line yAxisId="right" type="monotone" dataKey="airHtPt100" name="HT-A" stroke="#d946ef" {...lineProps} strokeWidth={1} hide={!visibility.airHtPt100} />
              <Line yAxisId="right" type="monotone" dataKey="humiHtPt100" name="HT-H" stroke="#a855f7" {...lineProps} strokeWidth={1} hide={!visibility.humiHtPt100} />
              <Line yAxisId="right" type="monotone" dataKey="humidity" name="HUM" stroke="#3b82f6" {...lineProps} hide={!visibility.humidity} />
              <Line yAxisId="right" type="monotone" dataKey="airHtLvl" name="LVL-A" stroke="#0ea5e9" {...lineProps} strokeWidth={1} hide={!visibility.airHtLvl} />
              <Line yAxisId="right" type="monotone" dataKey="warmHtLvl" name="LVL-W" stroke="#64748b" {...lineProps} strokeWidth={1} hide={!visibility.warmHtLvl} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* RIGHT CHANNEL PANEL (R-CH) */}
        <div className="flex flex-col items-center justify-center gap-3 px-2 py-3 bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm min-w-[76px]">
          <div className="text-[7px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tighter mb-1">CH-R</div>
          
          <OscBtnControl 
            label="SCALE" step={5.0} value={rightSpan} 
            onChange={setRightSpan} colorClass="text-indigo-600"
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8l8-8 8 8M4 16l8 8 8-8" /></svg>}
          />
          
          <OscBtnControl 
            label="OFFSET" step={1.0} value={rightCenter} 
            onChange={setRightCenter} colorClass="text-blue-500"
            icon={<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>}
          />

          <button 
            onClick={resetRight}
            className="mt-2 w-14 py-1 bg-gray-200 hover:bg-blue-500 hover:text-white text-gray-500 rounded text-[7px] font-black uppercase transition-all shadow-sm border border-transparent hover:border-blue-600"
          >
            RESET
          </button>
        </div>
      </div>
      
      {/* Footer Info */}
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
         <p className="text-[7px] font-bold text-gray-300 uppercase tracking-[0.3em]">CH-L: Dynamic Unit (0.1 if Scale &le; 1) • Linked Offset Step</p>
      </div>
    </div>
  );
});

export default LogChart;
