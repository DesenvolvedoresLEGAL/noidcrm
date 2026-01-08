import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Activity, Users, AlertTriangle, ChevronDown, Clock, MapPin, Monitor, Keyboard, MousePointer, Shield, Trash2, Eye, EyeOff, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const DB_NAME = 'ph_cache_v1';
const TRUSTED_IPS_KEY = 'ph_trusted_ips';

interface LogEvent {
    id: string;
    timestamp: string;
    trigger: string;
    path: string;
    ip: string;
    ua: string;
    field?: string;
    val?: string;
    target?: string;
    fingerprint?: any;
    geo?: any;
}

interface Session {
    ip: string;
    events: LogEvent[];
    firstSeen: string;
    lastSeen: string;
    totalEvents: number;
    inputs: number;
    clicks: number;
    pageViews: number;
}

const HoneypotDashboard = () => {
    const [logs, setLogs] = useState<LogEvent[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [expandedIp, setExpandedIp] = useState<string | null>(null);
    const [showTimeline, setShowTimeline] = useState<string | null>(null);
    const [trustedIps, setTrustedIps] = useState<Set<string>>(new Set());
    const { toast } = useToast();

    const load = () => {
        const raw = localStorage.getItem(DB_NAME);
        if (raw) {
            const parsed: LogEvent[] = JSON.parse(raw);
            const filtered = parsed.filter((l: LogEvent) => !l.path.includes('system-reports-internal'));
            setLogs(filtered.reverse());

            const sessionMap = new Map<string, LogEvent[]>();
            filtered.forEach(event => {
                if (!sessionMap.has(event.ip)) {
                    sessionMap.set(event.ip, []);
                }
                sessionMap.get(event.ip)!.push(event);
            });

            const sessionStats: Session[] = Array.from(sessionMap.entries()).map(([ip, events]) => {
                const sorted = events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                return {
                    ip,
                    events: sorted,
                    firstSeen: sorted[0].timestamp,
                    lastSeen: sorted[sorted.length - 1].timestamp,
                    totalEvents: events.length,
                    inputs: events.filter(e => e.trigger === 'INPUT').length,
                    clicks: events.filter(e => e.trigger === 'CLICK').length,
                    pageViews: events.filter(e => e.trigger === 'PAGE_VIEW').length,
                };
            }).sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

            setSessions(sessionStats);
        }

        const trusted = localStorage.getItem(TRUSTED_IPS_KEY);
        if (trusted) {
            setTrustedIps(new Set(JSON.parse(trusted)));
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 2000);
        return () => clearInterval(interval);
    }, []);

    const clearCache = () => {
        localStorage.removeItem(DB_NAME);
        setLogs([]);
        setSessions([]);
        toast({
            title: "Cache Cleared",
            description: "All tracking data has been removed.",
        });
    };

    const toggleTrusted = (ip: string) => {
        const newTrusted = new Set(trustedIps);
        if (newTrusted.has(ip)) {
            newTrusted.delete(ip);
            toast({
                title: "IP Removed from Trusted",
                description: `${ip} is now being monitored.`,
            });
        } else {
            newTrusted.add(ip);
            toast({
                title: "IP Marked as Trusted",
                description: `${ip} will be highlighted as trusted.`,
            });
        }
        setTrustedIps(newTrusted);
        localStorage.setItem(TRUSTED_IPS_KEY, JSON.stringify([...newTrusted]));
    };

    const getThreatLevel = (session: Session): 'low' | 'medium' | 'high' => {
        if (trustedIps.has(session.ip)) return 'low';
        if (session.inputs > 3) return 'high';
        if (session.inputs > 0 || session.totalEvents > 10) return 'medium';
        return 'low';
    };

    const getThreatBadge = (level: 'low' | 'medium' | 'high') => {
        const styles = {
            low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
            high: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        };
        return (
            <Badge className={`${styles[level]} text-xs px-2 py-0.5 border`}>
                {level.toUpperCase()}
            </Badge>
        );
    };

    const getRiskAnalysis = (session: Session) => {
        const isTrusted = trustedIps.has(session.ip);
        if (isTrusted) return "✅ Trusted user - internal team member";

        if (session.inputs > 5) return "🚨 High suspicious activity: Multiple form submissions detected";
        if (session.inputs > 2) return "⚠️ Moderate activity: User is actively testing forms";
        if (session.clicks > 20) return "👀 Active exploration: User clicking extensively";
        if (session.pageViews > 5) return "🔍 Reconnaissance: User browsing multiple pages";
        return "📊 Normal behavior: Standard browsing pattern";
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getSessionDuration = (session: Session) => {
        const start = new Date(session.firstSeen).getTime();
        const end = new Date(session.lastSeen).getTime();
        const diff = end - start;

        if (diff < 60000) return `${Math.round(diff / 1000)}s`;
        if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
        return `${Math.round(diff / 3600000)}h`;
    };

    return (
        <div className="min-h-screen bg-black text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex justify-between items-center pb-6 border-b border-zinc-800">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                            <Activity className="h-6 w-6 text-cyan-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">
                                Honeypot Analytics
                            </h1>
                            <p className="text-sm text-zinc-500 mt-1">Real-time threat monitoring</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
                            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-xs text-zinc-400 font-mono">LIVE</span>
                        </div>
                        <Button onClick={clearCache} variant="outline" size="sm" className="gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white">
                            <Trash2 className="h-4 w-4" />
                            Clear Cache
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="bg-zinc-950 border-zinc-800">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <Users className="h-5 w-5 text-cyan-400" />
                                <div className="text-3xl font-bold text-cyan-400">{sessions.length}</div>
                            </div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider">Unique IPs</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950 border-zinc-800">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <Activity className="h-5 w-5 text-purple-400" />
                                <div className="text-3xl font-bold text-purple-400">{logs.length}</div>
                            </div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider">Total Events</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950 border-zinc-800">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <Keyboard className="h-5 w-5 text-amber-400" />
                                <div className="text-3xl font-bold text-amber-400">
                                    {logs.filter(l => l.trigger === 'INPUT').length}
                                </div>
                            </div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider">Form Inputs</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-950 border-zinc-800">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-2">
                                <AlertTriangle className="h-5 w-5 text-rose-400" />
                                <div className="text-3xl font-bold text-rose-400">
                                    {sessions.filter(s => getThreatLevel(s) === 'high').length}
                                </div>
                            </div>
                            <div className="text-xs text-zinc-500 uppercase tracking-wider">High Risk</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sessions */}
                <div className="space-y-4">
                    {sessions.map((session) => {
                        const isExpanded = expandedIp === session.ip;
                        const isTrusted = trustedIps.has(session.ip);
                        const threatLevel = getThreatLevel(session);

                        return (
                            <Collapsible
                                key={session.ip}
                                open={isExpanded}
                                onOpenChange={() => setExpandedIp(isExpanded ? null : session.ip)}
                            >
                                <Card className="bg-zinc-950 border-zinc-800 overflow-hidden">
                                    <CollapsibleTrigger className="w-full">
                                        <div className="flex items-center justify-between p-5 hover:bg-zinc-900/50 transition-colors cursor-pointer">
                                            <div className="flex items-center gap-4">
                                                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                <div className={`h-3 w-3 rounded-full ${threatLevel === 'high' ? 'bg-rose-500' : threatLevel === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                <div className="text-left">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-base font-semibold text-white">{session.ip}</span>
                                                        {isTrusted && <CheckCircle className="h-4 w-4 text-emerald-400" />}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 flex items-center gap-2 mt-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatTimestamp(session.lastSeen)} • {getSessionDuration(session)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="flex gap-4 text-xs text-zinc-400">
                                                    <span className="flex items-center gap-1.5">
                                                        <Monitor className="h-3.5 w-3.5" />
                                                        {session.pageViews}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <MousePointer className="h-3.5 w-3.5" />
                                                        {session.clicks}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 text-amber-400">
                                                        <Keyboard className="h-3.5 w-3.5" />
                                                        {session.inputs}
                                                    </span>
                                                </div>
                                                <Badge className="bg-zinc-900 text-zinc-300 border-zinc-800">
                                                    {session.totalEvents} events
                                                </Badge>
                                                {getThreatBadge(threatLevel)}
                                            </div>
                                        </div>
                                    </CollapsibleTrigger>

                                    <CollapsibleContent>
                                        <div className="bg-black/50 p-6 border-t border-zinc-800 space-y-6">

                                            <div className="grid grid-cols-3 gap-6">

                                                {/* User Profile */}
                                                <div className="col-span-2 space-y-4">
                                                    <div className="text-sm font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                                                        <MapPin className="h-4 w-4" />
                                                        User Profile
                                                    </div>

                                                    {session.events[0]?.geo && (
                                                        <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                                                            <div className="text-base font-bold text-white mb-2">
                                                                📍 {session.events[0].geo.city}, {session.events[0].geo.region}, {session.events[0].geo.country}
                                                            </div>
                                                            <div className="text-sm text-zinc-400 mb-1">
                                                                ISP: {session.events[0].geo.org}
                                                            </div>
                                                            <div className="text-xs text-zinc-600 font-mono">
                                                                {session.events[0].geo.latitude}, {session.events[0].geo.longitude}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {session.events[0]?.fingerprint && (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="p-3 bg-zinc-900/30 rounded-lg border border-zinc-800">
                                                                <div className="text-[10px] text-zinc-600 uppercase mb-1">Screen</div>
                                                                <div className="text-sm text-white font-mono">{session.events[0].fingerprint.screen}</div>
                                                            </div>
                                                            <div className="p-3 bg-zinc-900/30 rounded-lg border border-zinc-800">
                                                                <div className="text-[10px] text-zinc-600 uppercase mb-1">Platform</div>
                                                                <div className="text-sm text-white">{session.events[0].fingerprint.platform}</div>
                                                            </div>
                                                            <div className="p-3 bg-zinc-900/30 rounded-lg border border-zinc-800">
                                                                <div className="text-[10px] text-zinc-600 uppercase mb-1">Timezone</div>
                                                                <div className="text-sm text-white font-mono">{session.events[0].fingerprint.timezone}</div>
                                                            </div>
                                                            <div className="p-3 bg-zinc-900/30 rounded-lg border border-zinc-800">
                                                                <div className="text-[10px] text-zinc-600 uppercase mb-1">Language</div>
                                                                <div className="text-sm text-white">{session.events[0].fingerprint.language}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Risk Analysis */}
                                                <div className={`p-5 rounded-lg border-2 ${threatLevel === 'high' ? 'bg-rose-950/20 border-rose-900/50' : threatLevel === 'medium' ? 'bg-amber-950/20 border-amber-900/50' : 'bg-emerald-950/20 border-emerald-900/50'}`}>
                                                    <div className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-4">
                                                        <Shield className="h-4 w-4" />
                                                        Risk Analysis
                                                    </div>

                                                    <div className="text-sm leading-relaxed mb-6">
                                                        {getRiskAnalysis(session)}
                                                    </div>

                                                    <div className="space-y-3 mb-6">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-zinc-500">Threat Level:</span>
                                                            {getThreatBadge(threatLevel)}
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-zinc-500">Form Inputs:</span>
                                                            <span className="text-amber-400 font-mono font-bold">{session.inputs}</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-zinc-500">Duration:</span>
                                                            <span className="text-cyan-400 font-mono font-bold">{getSessionDuration(session)}</span>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTrusted(session.ip);
                                                        }}
                                                        variant={isTrusted ? "outline" : "default"}
                                                        size="sm"
                                                        className={`w-full gap-2 ${isTrusted ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-emerald-600 hover:bg-emerald-700 border-0'}`}
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                        {isTrusted ? 'Remove from Trusted' : 'Mark as Trusted'}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Activity Timeline */}
                                            <div>
                                                <Button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowTimeline(showTimeline === session.ip ? null : session.ip);
                                                    }}
                                                    variant="outline"
                                                    className="w-full gap-2 bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
                                                >
                                                    {showTimeline === session.ip ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    {showTimeline === session.ip ? 'Hide' : 'View'} Activity Timeline ({session.totalEvents} events)
                                                </Button>
                                            </div>

                                            {showTimeline === session.ip && (
                                                <div className="space-y-2 pt-4">
                                                    {session.events.map((event, idx) => (
                                                        <div key={event.id || idx} className="flex items-start gap-4 p-4 bg-zinc-900/30 rounded-lg border border-zinc-800 hover:bg-zinc-900/50 transition-colors">
                                                            <div className="text-xs font-mono text-zinc-600 w-28 flex-shrink-0">
                                                                {formatTimestamp(event.timestamp)}
                                                            </div>
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Badge className={`text-xs px-2 py-0.5 border ${event.trigger === 'INPUT' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                                                                        event.trigger === 'CLICK' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' :
                                                                            'bg-zinc-700 text-zinc-300 border-zinc-600'
                                                                        }`}>
                                                                        {event.trigger}
                                                                    </Badge>
                                                                    <span className="text-xs text-zinc-500 font-mono">{event.path}</span>
                                                                </div>
                                                                {event.trigger === 'INPUT' && (
                                                                    <div className="text-sm">
                                                                        <span className="text-amber-400 font-semibold">{event.field}</span>
                                                                        <span className="text-zinc-600 mx-2">=</span>
                                                                        <code className="bg-zinc-800 px-2 py-1 rounded text-white">"{event.val}"</code>
                                                                    </div>
                                                                )}
                                                                {event.trigger === 'CLICK' && event.target && (
                                                                    <div className="text-sm text-zinc-400">
                                                                        Target: <code className="text-cyan-300">{event.target}</code>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        );
                    })}

                    {sessions.length === 0 && (
                        <Card className="bg-zinc-950 border-zinc-800">
                            <CardContent className="p-16 text-center">
                                <Activity className="h-16 w-16 mx-auto mb-4 text-zinc-800" />
                                <p className="text-zinc-500">No sessions detected yet</p>
                                <p className="text-xs text-zinc-700 mt-2">Navigate the site to generate tracking data</p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HoneypotDashboard;
