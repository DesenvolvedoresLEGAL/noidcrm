import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const DB_NAME = 'ph_cache_v1';
const EVENT_QUEUE: any[] = [];
const isDev = import.meta.env.DEV;

// 🔍 FORENSIC FINGERPRINTING
const getFingerprint = async () => {
    const fp: any = {
        screen: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        language: navigator.language,
        languages: navigator.languages.join(','),
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: (navigator as any).deviceMemory || 'unknown',
        vendor: navigator.vendor,
        doNotTrack: navigator.doNotTrack,
        plugins: Array.from(navigator.plugins || []).map((p: any) => p.name).join(',') || 'none',
        mimeTypes: Array.from(navigator.mimeTypes || []).map((m: any) => m.type).slice(0, 5).join(','),
        touchSupport: 'ontouchstart' in window,
        cookieEnabled: navigator.cookieEnabled,
        localStorage: !!window.localStorage,
        sessionStorage: !!window.sessionStorage,
        indexedDB: !!window.indexedDB,
    };

    // Canvas Fingerprint
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('FBI-MODE', 2, 2);
            fp.canvasHash = canvas.toDataURL().slice(-50);
        }
    } catch (e) {
        fp.canvasHash = 'blocked';
    }

    // WebGL Fingerprint
    try {
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                fp.webglVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                fp.webglRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
        }
    } catch (e) {
        fp.webglVendor = 'blocked';
    }

    // Battery API
    try {
        const battery: any = await (navigator as any).getBattery?.();
        if (battery) {
            fp.batteryLevel = Math.round(battery.level * 100) + '%';
            fp.batteryCharging = battery.charging;
        }
    } catch (e) {
        fp.batteryLevel = 'blocked';
    }

    // Connection Info
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn) {
        fp.connectionType = conn.effectiveType;
        fp.downlink = conn.downlink + ' Mbps';
        fp.rtt = conn.rtt + ' ms';
    }

    return fp;
};

// IP Geolocation — cached in sessionStorage, called once per session, silent on failure
const GEO_CACHE_KEY = 'ph_geo';
const GEO_FAIL_KEY = 'ph_geo_failed';

const getGeoLocation = async (ip: string) => {
    if (sessionStorage.getItem(GEO_FAIL_KEY) === '1') return null;
    const cached = sessionStorage.getItem(GEO_CACHE_KEY);
    if (cached) {
        try { return JSON.parse(cached); } catch { /* fallthrough */ }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
        const res = await fetch(`https://ipwho.is/${ip}`, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error('geo http');
        const data = await res.json();
        if (data?.success === false) throw new Error('geo not found');
        const geo = {
            city: data.city,
            region: data.region,
            country: data.country,
            countryCode: data.country_code,
            latitude: data.latitude,
            longitude: data.longitude,
            org: data.connection?.isp || data.connection?.org,
            timezone: data.timezone?.id,
        };
        try { sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(geo)); } catch { /* quota */ }
        return geo;
    } catch (e) {
        clearTimeout(timeout);
        try { sessionStorage.setItem(GEO_FAIL_KEY, '1'); } catch { /* quota */ }
        if (isDev) console.debug('[ph] geo lookup skipped:', (e as Error).message);
        return null;
    }
};

export const PostHogProvider = () => {
    const location = useLocation();
    const pathnameRef = useRef(location.pathname);
    const fingerprintRef = useRef<any>(null);
    const geoRef = useRef<any>(null);

    useEffect(() => {
        pathnameRef.current = location.pathname;
        track('page_view');
    }, [location.pathname]);

    const track = async (event_type: string, props: any = {}) => {
        // Garantir que fingerprint foi gerado
        if (!fingerprintRef.current) {
            fingerprintRef.current = await getFingerprint();
        }

        const ip = sessionStorage.getItem('ph_ip') || '0.0.0.0';

        // Geo: usar cache em memória, sem nova chamada por evento
        if (!geoRef.current) {
            const cached = sessionStorage.getItem(GEO_CACHE_KEY);
            if (cached) {
                try { geoRef.current = JSON.parse(cached); } catch { /* ignore */ }
            }
        }

        const event = {
            id: Math.random().toString(36).substring(2) + Date.now(),
            timestamp: new Date().toISOString(),
            trigger: event_type.toUpperCase(),
            path: pathnameRef.current,
            ip: ip,
            ua: navigator.userAgent,
            fingerprint: fingerprintRef.current,
            geo: geoRef.current,
            ...props
        };

        EVENT_QUEUE.push(event);
    };

    useEffect(() => {
        const interval = setInterval(() => {
            if (EVENT_QUEUE.length === 0) return;
            const batch = [...EVENT_QUEUE];
            EVENT_QUEUE.length = 0;
            const old = JSON.parse(localStorage.getItem(DB_NAME) || '[]');
            localStorage.setItem(DB_NAME, JSON.stringify([...old, ...batch].slice(-500)));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (t.tagName === 'BODY' || t.tagName === 'HTML' || t.tagName === 'SVG' || t.tagName === 'path') return;

            const targetText = t.innerText?.slice(0, 20).trim() || t.getAttribute('aria-label') || t.id || 'element';
            track('click', { target: `${t.tagName.toLowerCase()}: ${targetText}` });
        };

        const handleBlur = (e: FocusEvent) => {
            const t = e.target as HTMLInputElement;
            if ((t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.value) {
                if (t.value.length < 2) return;
                track('input', { field: t.name || t.id || t.placeholder || t.type, val: t.value });
            }
        };

        // Obter IP público — uma vez por sessão, com timeout e fallback silencioso
        if (!sessionStorage.getItem('ph_ip')) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            fetch('https://api.ipify.org?format=json', { signal: controller.signal })
                .then(r => r.json())
                .then(d => {
                    clearTimeout(timeout);
                    sessionStorage.setItem('ph_ip', d.ip);
                    return getGeoLocation(d.ip);
                })
                .then(geo => { if (geo) geoRef.current = geo; })
                .catch((e) => {
                    clearTimeout(timeout);
                    if (isDev) console.debug('[ph] ip lookup skipped:', (e as Error).message);
                });
        }

        window.addEventListener('click', handleClick, true);
        window.addEventListener('blur', handleBlur, true);
        return () => {
            window.removeEventListener('click', handleClick, true);
            window.removeEventListener('blur', handleBlur, true);
        };
    }, []);

    return null;
};
