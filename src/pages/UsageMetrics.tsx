import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Activity, Users, AlertTriangle, ChevronDown, Clock, MapPin, Monitor, Keyboard, MousePointer } from "lucide-react";

const DB_NAME = 'ph_cache_v1';

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

const UsageMetrics = () => {
    const [logs, setLogs] = useState<LogEvent[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [expandedIp, setExpandedIp] = useState<string | null>(null);

    const load = () => {
        const raw = localStorage.getItem(DB_NAME);
        if (raw) {
            const parsed: LogEvent[] = JSON.parse(raw);
            const filtered = parsed.filter((l: LogEvent) => !l.path.includes('system-reports-internal'));
            setLogs(filtered.reverse());

            // Agrupar por IP
            const sessionMap = new Map<string, LogEvent[]>();
            filtered.forEach(event => {
                if (!sessionMap.has(event.ip)) {
                    sessionMap.set(event.ip, []);
                }
                sessionMap.get(event.ip)!.push(event);
            });

            // Criar estatísticas por sessão
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
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 2000);
        return () => clearInterval(interval);
    }, []);

    const getThreatLevel = (session: Session): 'low' | 'medium' | 'high' => {
        if (session.inputs > 3) return 'high';
        if (session.inputs > 0 || session.totalEvents > 10) return 'medium';
        return 'low';
    };

    const getThreatBadge = (level: 'low' | 'medium' | 'high') => {
        const styles = {
            low: 'bg-green-500/10 text-green-400 border-green-500/30',
            medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            high: 'bg-red-500/10 text-red-400 border-red-500/30',
        };
        return (
            <Badge className={`${styles[level]} text-[9px] px-1.5 py-0.5`}>
                {level.toUpperCase()}
            </Badge>
        );
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
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 font-sans p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                            <Activity className="h-7 w-7 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                Honeypot Analytics
                            </h1>
                            <p className="text-sm text-slate-500 font-medium mt-1">Real-time threat monitoring & session tracking</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-slate-400 font-mono">LIVE</span>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-slate-900/60 border-slate-800/50 backdrop-blur">
                        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Unique IPs</CardTitle>
                            <Users className="h-5 w-5 text-blue-400" />
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                            <div className="text-3xl font-bold text-blue-400">{sessions.length}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900/60 border-slate-800/50 backdrop-blur">
                        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Events</CardTitle>
                            <Activity className="h-5 w-5 text-purple-400" />
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                            <div className="text-3xl font-bold text-purple-400">{logs.length}</div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900/60 border-slate-800/50 backdrop-blur">
                        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">Form Inputs</CardTitle>
                            <Keyboard className="h-5 w-5 text-amber-400" />
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                            <div className="text-3xl font-bold text-amber-400">
                                {logs.filter(l => l.trigger === 'INPUT').length}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-900/60 border-red-500/20 backdrop-blur border-l-4 border-l-red-500">
                        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider">High Risk</CardTitle>
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                        </CardHeader>
                        <CardContent className="px-5 pb-4">
                            <div className="text-3xl font-bold text-red-400">
                                {sessions.filter(s => getThreatLevel(s) === 'high').length}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sessions List */}
                <Card className="bg-slate-900/40 border-slate-800/50 backdrop-blur">
                    <CardHeader className="border-b border-slate-800/50">
                        <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-slate-400" />
                            Active Sessions by IP
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[600px]">
                            <div className="divide-y divide-slate-800/50">
                                {sessions.map((session) => {
                                    const isExpanded = expandedIp === session.ip;
                                    const threatLevel = getThreatLevel(session);

                                    return (
                                        <Collapsible
                                            key={session.ip}
                                            open={isExpanded}
                                            onOpenChange={() => setExpandedIp(isExpanded ? null : session.ip)}
                                        >
                                            <CollapsibleTrigger className="w-full hover:bg-slate-800/30 transition-colors">
                                                <div className="flex items-center justify-between p-4 cursor-pointer">
                                                    <div className="flex items-center gap-4">
                                                        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        <div className="flex items-center gap-3">
                                                            <div className={`h-3 w-3 rounded-full ${threatLevel === 'high' ? 'bg-red-500' : threatLevel === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                                            <div className="text-left">
                                                                <div className="font-mono text-sm font-semibold text-white">{session.ip}</div>
                                                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                                    <Clock className="h-3 w-3" />
                                                                    {formatTimestamp(session.lastSeen)} • Duration: {getSessionDuration(session)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-xs text-slate-400 flex gap-3">
                                                            <span className="flex items-center gap-1">
                                                                <Monitor className="h-3 w-3" />
                                                                {session.pageViews}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <MousePointer className="h-3 w-3" />
                                                                {session.clicks}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <Keyboard className="h-3 w-3 text-amber-400" />
                                                                {session.inputs}
                                                            </span>
                                                        </div>
                                                        <Badge className="bg-slate-800 text-slate-300 text-xs px-2">
                                                            {session.totalEvents} events
                                                        </Badge>
                                                        {getThreatBadge(threatLevel)}
                                                    </div>
                                                </div>
                                            </CollapsibleTrigger>

                                            <CollapsibleContent>
                                                <div className="bg-slate-950/50 px-4 py-3 border-t border-slate-800/50">
                                                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                                        <Activity className="h-3 w-3" />
                                                        Session Timeline
                                                    </div>
                                                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                                        {session.events.map((event, idx) => (
                                                            <div key={event.id || idx} className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800/30 hover:border-slate-700/50 transition-colors">
                                                                <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                                                                    {formatTimestamp(event.timestamp)}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <Badge className={`text-[9px] px-1.5 py-0.5 ${event.trigger === 'INPUT' ? 'bg-amber-900/20 text-amber-400 border-amber-800/30' :
                                                                                event.trigger === 'CLICK' ? 'bg-blue-900/20 text-blue-400 border-blue-800/30' :
                                                                                    'bg-slate-800 text-slate-400 border-slate-700'
                                                                            }`}>
                                                                            {event.trigger}
                                                                        </Badge>
                                                                        <span className="text-xs text-slate-500 font-mono">{event.path}</span>
                                                                    </div>
                                                                    {event.trigger === 'INPUT' && (
                                                                        <div className="text-xs text-slate-300 mt-1">
                                                                            <span className="text-amber-400 font-semibold">{event.field}</span>
                                                                            <span className="text-slate-600 mx-2">=</span>
                                                                            <code className="bg-slate-800/50 px-2 py-0.5 rounded text-white">"{event.val}"</code>
                                                                        </div>
                                                                    )}
                                                                    {event.trigger === 'CLICK' && event.target && (
                                                                        <div className="text-xs text-slate-400 mt-1">
                                                                            Target: <code className="text-blue-300">{event.target}</code>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    );
                                })}

                                {sessions.length === 0 && (
                                    <div className="p-12 text-center text-slate-500">
                                        <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p className="text-sm">No sessions detected yet</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UsageMetrics;
