import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TimerProps {
  startTime: Date;
  durationMinutes: number;
  onExpire?: () => void;
}

export function Timer({ startTime, durationMinutes, onExpire }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const start = new Date(startTime).getTime();
      const end = start + (durationMinutes * 60 * 1000);
      const remaining = Math.max(0, end - now);
      
      setTimeLeft(remaining);
      setProgress((remaining / (durationMinutes * 60 * 1000)) * 100);

      if (remaining === 0 && onExpire) {
        onExpire();
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [startTime, durationMinutes, onExpire]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  const getColorClass = () => {
    if (progress > 50) return 'text-success';
    if (progress > 20) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="flex items-center gap-3 bg-card p-3 rounded-lg border">
      <Clock className={`h-5 w-5 ${getColorClass()}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium">Tempo restante</span>
          <span className={`text-lg font-bold ${getColorClass()}`}>
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}