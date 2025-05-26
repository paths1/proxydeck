import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { formatTraffic } from '../../utils';
import { DownloadIcon, UploadIcon } from '../../components/shared/icons';

const chartConfig = {
  download: {
    title: 'Download',
    totalKey: 'download_total',
    totalColor: '#A0A0A0',
    icon: DownloadIcon
  },
  upload: {
    title: 'Upload',
    totalKey: 'upload_total', 
    totalColor: '#A0A0A0',
    icon: UploadIcon
  }
};

const TrafficCharts = ({ 
  type, 
  data = [], 
  proxies = [], 
  hasPerProxyData = false, 
  windowSize = '1min',
  lastUpdate,
  stats = {}
}) => {
  const [chartData, setChartData] = useState([]);
  const [hoveredData, setHoveredData] = useState(null);
  const config = chartConfig[type];
  const updateTimeoutRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);

  // Memoize color calculations for performance with stable color conversion
  const proxyColors = useMemo(() => {
    const colorMap = new Map();
    const defaultColors = [
      '#6366F1', // Indigo
      '#EC4899', // Pink  
      '#22C55E', // Green
      '#FB923C', // Orange
      '#9333EA'  // Purple
    ];
    
    // Memoized rgba to hex converter
    const rgbaToHex = (rgba) => {
      if (!rgba.startsWith('rgba')) return rgba;
      const values = rgba.match(/\d+/g);
      if (!values || values.length < 3) return rgba;
      const [r, g, b] = values.map(v => parseInt(v));
      return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    };
    
    (proxies || []).forEach((proxy, index) => {
      let color = proxy.color;
      if (color && color.startsWith('rgba')) {
        color = rgbaToHex(color);
      }
      if (!color) {
        color = defaultColors[index % defaultColors.length];
      }
      colorMap.set(proxy.id, color);
    });
    
    return colorMap;
  }, [proxies]);

  const getProxyColor = useCallback((proxyId) => {
    return proxyColors.get(proxyId) || '#6366F1';
  }, [proxyColors]);

  // Optimized timestamp formatting without problematic caching
  const formatTimestamp = useCallback((timestamp) => {
    const now = Date.now();
    const secondsAgo = Math.floor((now - timestamp) / 1000);
    
    if (secondsAgo <= 2) return 'Now';
    if (secondsAgo < 60) return `${secondsAgo}s`;
    
    const minutesAgo = Math.floor(secondsAgo / 60);
    if (minutesAgo < 60) {
      const remainingSeconds = secondsAgo % 60;
      return `${minutesAgo}m ${remainingSeconds}s`;
    }
    
    const hoursAgo = Math.floor(minutesAgo / 60);
    return `${hoursAgo}h`;
  }, []);

  const formatTooltipTimestamp = useCallback((timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }, []);

  const formatTooltipValue = useCallback((value, name) => {
    return [formatTraffic(value, 1), name];
  }, []);

  const formatYAxisTick = useCallback((value) => {
    return formatTraffic(value, 0);
  }, []);

  const visibleDataKeys = useMemo(() => {
    const keys = [config.totalKey];
    
    if (hasPerProxyData && proxies.length > 0) {
      // Remove total key for per-proxy view and add proxy keys
      keys.splice(0, 1);
      proxies.forEach(proxy => {
        keys.push(`${type}_${proxy.id}`);
      });
    }
    
    return keys;
  }, [config.totalKey, hasPerProxyData, proxies, type]);

  const updateChartData = useCallback(() => {
    if (!data || data.length === 0) {
      setChartData([]);
      return;
    }

    // Transform the data for Recharts
    const transformedData = data.map((point, index) => ({
      timestamp: point.timestamp,
      formattedTime: formatTimestamp(point.timestamp),
      index, // For brush component
      ...point
    }));

    setChartData(transformedData);
  }, [data, formatTimestamp]);

  // Debounced update effect
  useEffect(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      updateChartData();
    }, 100); // 100ms debounce

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [data, lastUpdate]);

  // Optimized real-time update effect
  useEffect(() => {
    if (data.length === 0) {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      return;
    }

    // Only update if we have recent data (within last 5 minutes)
    const hasRecentData = data.some(point => (Date.now() - point.timestamp) < 300000);
    if (!hasRecentData) return;

    timeUpdateIntervalRef.current = setInterval(() => {
      // Only update formattedTime for performance
      setChartData(prevData => {
        if (prevData.length === 0) return prevData;
        return prevData.map(point => ({
          ...point,
          formattedTime: formatTimestamp(point.timestamp)
        }));
      });
    }, 10000); // Reduced frequency to 10 seconds

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
  }, [data.length, formatTimestamp]);

  // Cleanup effect for intervals and timeouts
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  const renderAreas = () => {
    if (hasPerProxyData && proxies.length > 0) {
      // Render stacked areas for each proxy (including special ones like direct/unmatched)
      return proxies.map((proxy) => {
        const dataKey = `${type}_${proxy.id}`;
        const color = getProxyColor(proxy.id);
        
        return (
          <Area
            key={dataKey}
            type="monotone"
            dataKey={dataKey}
            name={proxy.name || `Proxy ${proxy.id}`}
            stackId="1"
            stroke={color}
            fill={color}
            fillOpacity={0.4}
            strokeWidth={2}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 6, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        );
      });
    } else {
      // Render single area for total
      return (
        <Area
          type="monotone"
          dataKey={config.totalKey}
          name={config.title}
          stroke={config.totalColor}
          fill={config.totalColor}
          fillOpacity={0.4}
          strokeWidth={2}
          connectNulls={false}
          dot={false}
          activeDot={{ r: 6, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      );
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      // Get timestamp from the first payload item
      const timestamp = payload[0]?.payload?.timestamp;
      const timeString = timestamp ? formatTooltipTimestamp(timestamp) : label;
      
      return (
        <div className="bg-background/95 border rounded-lg shadow-lg p-3 backdrop-blur-sm">
          <p className="text-sm font-medium mb-2">{timeString}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium">{entry.name}:</span>
              <span className="text-muted-foreground">
                {formatTraffic(entry.value, 1)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Create legend configuration for Recharts
  const legendPayload = useMemo(() => {
    if (hasPerProxyData && proxies.length > 0) {
      // Add all proxies (including special ones like direct/unmatched)
      return proxies.map(proxy => ({
        value: proxy.name || `Proxy ${proxy.id}`,
        type: 'rect',
        color: getProxyColor(proxy.id),
        dataKey: `${type}_${proxy.id}`
      }));
    } else {
      return [{
        value: config.title,
        type: 'rect', 
        color: config.totalColor,
        dataKey: config.totalKey
      }];
    }
  }, [hasPerProxyData, proxies, type, config, getProxyColor]);



  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <config.icon className="text-xl" />
            {config.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {stats[type] && (
              <>
                <Badge variant="default" className="font-mono text-sm font-semibold">
                  {formatTraffic(stats[type].current || 0, 1)}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  Peak: {formatTraffic(stats[type].peak || 0, 1)}
                </Badge>
                <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                  Total: {formatTraffic(stats[type].total || 0, 1)}
                </Badge>
              </>
            )}
          </div>
        </div>
        {(hasPerProxyData && proxies.length > 0) && (
          <div className="flex flex-wrap gap-3 mt-3 text-sm">
            {legendPayload.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-muted-foreground font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        <div style={{ width: '100%', height: '280px' }}>
          <ResponsiveContainer>
            <AreaChart
              data={chartData}
              isAnimationActive={false}
              margin={{
                top: 5,
                right: 20,
                left: 10,
                bottom: 20
              }}
              onMouseMove={useCallback((e) => {
                if (e && e.activePayload) {
                  setHoveredData(e.activePayload[0]?.payload);
                }
              }, [])}
              onMouseLeave={useCallback(() => setHoveredData(null), [])}
            >
              <CartesianGrid 
                strokeDasharray="3 3" 
                opacity={0.3}
                vertical={false}
              />
              <XAxis
                dataKey="formattedTime"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11 }}
                interval={Math.max(0, Math.floor(chartData.length / 8))}
                angle={-35}
                textAnchor="end"
                height={40}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={formatYAxisTick}
                domain={[0, 'dataMax + 1000']}
              />
              <Tooltip
                content={<CustomTooltip />}
                animationDuration={200}
                cursor={{ strokeDasharray: '3 3' }}
              />
              {renderAreas()}
              {hoveredData && (
                <ReferenceLine
                  x={hoveredData.formattedTime}
                  stroke="#666"
                  strokeDasharray="3 3"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TrafficCharts;