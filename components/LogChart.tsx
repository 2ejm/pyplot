
import React, { useState, useCallback, memo } from 'react';
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

  const toggleVisibility = useCallback((dataKey: string) => {
    setVisibility(prev => ({ ...prev, [dataKey]: !prev[dataKey] }));
  }, []);

  const lineProps = {
    isAnimationActive: false,
    dot: false,
    connectNulls: true,
    strokeWidth: 1.5,
    activeDot: { r: 4, strokeWidth: 1, fill: '#fff', stroke: '#4f46e5' },
  };

  // 24h format helper for axis
  const formatXAxis = (tickItem: string) => {
    // If the input is already HH:mm:ss, just ensure it doesn't have AM/PM
    return tickItem.split(' ')[0];
  };

  return (
    <div className="w-full h-full bg-white overflow-hidden cursor-crosshair">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data} 
          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis 
            dataKey="time" 
            tickFormatter={formatXAxis}
            tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 'bold' }}
            interval="preserveStartEnd"
            minTickGap={60}
            stroke="#e2e8f0"
          />
          <YAxis 
            yAxisId="left" 
            domain={[20, 50]} 
            tick={{ fontSize: 8, fill: '#ef4444', fontWeight: 'bold' }}
            stroke="#f1f5f9"
            width={40}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right" 
            domain={[0, 110]} 
            tick={{ fontSize: 8, fill: '#3b82f6', fontWeight: 'bold' }}
            stroke="#f1f5f9"
            width={40}
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
  );
});

export default LogChart;
