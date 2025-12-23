import { useCallback, useEffect, useState } from 'react';

export interface DeviceFingerprint {
  browserHash: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screenResolution: string;
  timezone: string;
  language: string;
  canvasHash: string;
}

// Simple hash function for fingerprinting
async function simpleHash(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Get canvas fingerprint
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    
    canvas.width = 200;
    canvas.height = 50;
    
    // Draw text with specific styling
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('NOID CRM Fingerprint', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('NOID CRM Fingerprint', 4, 17);
    
    return canvas.toDataURL();
  } catch {
    return 'canvas-blocked';
  }
}

// Detect device type
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return 'tablet';
  }
  
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}

export function useDeviceFingerprint() {
  const [fingerprint, setFingerprint] = useState<DeviceFingerprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const generateFingerprint = useCallback(async (): Promise<DeviceFingerprint> => {
    try {
      // Collect all available data points
      const components: string[] = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        new Date().getTimezoneOffset().toString(),
        screen.colorDepth.toString(),
        screen.width.toString(),
        screen.height.toString(),
        screen.availWidth.toString(),
        screen.availHeight.toString(),
        navigator.hardwareConcurrency?.toString() || 'unknown',
        (navigator as any).deviceMemory?.toString() || 'unknown',
      ];

      // Add canvas fingerprint
      const canvasData = getCanvasFingerprint();
      components.push(canvasData);

      // Generate hashes
      const browserHash = await simpleHash(components.join('|||'));
      const canvasHash = await simpleHash(canvasData);

      const fp: DeviceFingerprint = {
        browserHash,
        deviceType: getDeviceType(),
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        canvasHash,
      };

      return fp;
    } catch (err) {
      throw new Error('Failed to generate fingerprint');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    generateFingerprint()
      .then(fp => {
        if (mounted) {
          setFingerprint(fp);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [generateFingerprint]);

  return {
    fingerprint,
    isLoading,
    error,
    regenerate: generateFingerprint,
  };
}
