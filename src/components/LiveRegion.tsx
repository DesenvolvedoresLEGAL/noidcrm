import { useEffect, useState } from 'react';

interface LiveRegionProps {
  message: string;
  politeness?: 'polite' | 'assertive';
  clearAfter?: number;
}

/**
 * Accessible live region for announcing dynamic content to screen readers
 * Use for form errors, loading states, success messages, etc.
 */
export function LiveRegion({ 
  message, 
  politeness = 'polite',
  clearAfter = 5000 
}: LiveRegionProps) {
  const [announcement, setAnnouncement] = useState(message);

  useEffect(() => {
    setAnnouncement(message);
    
    if (clearAfter > 0 && message) {
      const timer = setTimeout(() => setAnnouncement(''), clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

/**
 * Hook for managing screen reader announcements
 */
export function useAnnouncement() {
  const [message, setMessage] = useState('');
  const [politeness, setPoliteness] = useState<'polite' | 'assertive'>('polite');

  const announce = (newMessage: string, priority: 'polite' | 'assertive' = 'polite') => {
    setPoliteness(priority);
    // Clear first to ensure re-announcement
    setMessage('');
    requestAnimationFrame(() => setMessage(newMessage));
  };

  return {
    message,
    politeness,
    announce,
    AnnouncementRegion: () => <LiveRegion message={message} politeness={politeness} />
  };
}
