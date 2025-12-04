import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, Activity } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProposalView } from '@/services/crm/proposal-analytics';

interface ViewsTimelineChartProps {
  views: ProposalView[];
  viewTimeline: { date: string; views: number }[];
}

export function ViewsTimelineChart({ views, viewTimeline }: ViewsTimelineChartProps) {
  // Prepare data for last 14 days
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    return format(date, 'yyyy-MM-dd');
  });

  const chartData = last14Days.map(date => {
    const existing = viewTimeline.find(v => v.date === date);
    const dayViews = views.filter(v => v.viewed_at.startsWith(date));
    const avgDuration = dayViews.length > 0 
      ? dayViews.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / dayViews.length 
      : 0;
    
    return {
      date,
      dateLabel: format(parseISO(date), 'dd/MM', { locale: ptBR }),
      views: existing?.views || 0,
      avgDuration: Math.round(avgDuration / 60), // in minutes
    };
  });

  // Find peak day
  const peakDay = chartData.reduce((max, day) => day.views > max.views ? day : max, chartData[0]);
  const totalViewsInPeriod = chartData.reduce((sum, day) => sum + day.views, 0);
  
  // Calculate trend (last 7 days vs previous 7 days)
  const last7Days = chartData.slice(-7);
  const previous7Days = chartData.slice(0, 7);
  const last7Total = last7Days.reduce((sum, day) => sum + day.views, 0);
  const prev7Total = previous7Days.reduce((sum, day) => sum + day.views, 0);
  const trendPercent = prev7Total > 0 
    ? Math.round(((last7Total - prev7Total) / prev7Total) * 100) 
    : last7Total > 0 ? 100 : 0;

  if (totalViewsInPeriod === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Timeline de Visualizações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma visualização nos últimos 14 dias.
          </p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
          <p className="font-medium mb-1">{format(parseISO(data.date), "dd 'de' MMMM", { locale: ptBR })}</p>
          <p className="text-primary">
            {data.views} {data.views === 1 ? 'visualização' : 'visualizações'}
          </p>
          {data.avgDuration > 0 && (
            <p className="text-muted-foreground text-xs mt-1">
              Tempo médio: {data.avgDuration}min
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Timeline de Visualizações
          </CardTitle>
          <div className="flex items-center gap-2">
            {trendPercent !== 0 && (
              <Badge 
                variant={trendPercent > 0 ? 'default' : 'secondary'}
                className={trendPercent > 0 ? 'bg-green-500/10 text-green-600 border-green-500/20' : ''}
              >
                <TrendingUp className={`h-3 w-3 mr-1 ${trendPercent < 0 ? 'rotate-180' : ''}`} />
                {trendPercent > 0 ? '+' : ''}{trendPercent}%
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {totalViewsInPeriod} em 14 dias
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="dateLabel" 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 10 }} 
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                className="fill-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="views"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorViews)"
                dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Peak indicator */}
        {peakDay.views > 0 && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
            <span className="text-muted-foreground">
              Pico de engajamento
            </span>
            <span className="font-medium">
              {format(parseISO(peakDay.date), "dd/MM", { locale: ptBR })} • {peakDay.views} {peakDay.views === 1 ? 'visualização' : 'visualizações'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
