import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, Layout, Database, Terminal } from "lucide-react";

const DB_NAME = 'ph_cache_v1';

const UsageMetrics = () => {
    const [logs, setLogs] = useState<any[]>([]);

    const load = () => {
        const raw = localStorage.getItem(DB_NAME);
        if (raw) {
            const parsed = JSON.parse(raw);
            const filtered = parsed.filter((l: any) => !l.path.includes('system-reports-internal'));
            setLogs(filtered.reverse());
        }
    };

    useEffect(() => {
        load();
        const interval = setInterval(load, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-slate-300 font-sans p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                        <Activity className="h-6 w-6 text-blue-500" />
                        <h1 className="text-xl font-medium tracking-tight text-white">System Usage Analytics</h1>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">INTERNAL USE ONLY</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-slate-900/40 border-slate-800">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Total Sessions</CardTitle>
                            <Layout className="h-4 w-4 text-slate-500" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-white">{new Set(logs.map(l => l.ip)).size}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/40 border-slate-800">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Interaction Events</CardTitle>
                            <Terminal className="h-4 w-4 text-slate-500" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-blue-400">{logs.length}</div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-900/40 border-slate-800">
                        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-semibold text-slate-400 uppercase">Form Submissions</CardTitle>
                            <Database className="h-4 w-4 text-slate-500" />
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                            <div className="text-2xl font-bold text-amber-500 text-opacity-80">
                                {logs.filter(l => l.trigger === 'INPUT').length}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="bg-slate-900/20 border-slate-800">
                    <ScrollArea className="h-[600px] w-full">
                        <Table>
                            <TableHeader className="bg-slate-900/50">
                                <TableRow className="border-slate-800 hover:bg-transparent">
                                    <TableHead className="text-slate-500 w-[100px] text-[10px] font-bold uppercase">Time</TableHead>
                                    <TableHead className="text-slate-500 w-[140px] text-[10px] font-bold uppercase">Client IP</TableHead>
                                    <TableHead className="text-slate-500 w-[80px] text-[10px] font-bold uppercase">Type</TableHead>
                                    <TableHead className="text-slate-500 text-[10px] font-bold uppercase">Metadata</TableHead>
                                    <TableHead className="text-slate-500 text-right text-[10px] font-bold uppercase">Path</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log, i) => (
                                    <TableRow key={log.id || i} className="border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                                        <TableCell className="text-[10px] text-slate-500 font-mono">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </TableCell>
                                        <TableCell className="text-slate-400 text-xs font-mono">{log.ip}</TableCell>
                                        <TableCell>
                                            <span className={`text-[9px] px-1 py-0.5 rounded-sm font-bold ${log.trigger === 'INPUT' ? 'bg-amber-900/20 text-amber-500 border border-amber-800/30' :
                                                    'bg-slate-800 text-slate-400 border border-slate-700'
                                                }`}>
                                                {log.trigger}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-300">
                                            {log.trigger === 'INPUT' ? (
                                                <span className="opacity-80">
                                                    Field <code className="text-amber-500">{log.field}</code>: <span className="font-semibold">"{log.val}"</span>
                                                </span>
                                            ) : log.trigger === 'CLICK' ? (
                                                <span className="opacity-60">Interaction: {log.target}</span>
                                            ) : (
                                                <span className="opacity-40 italic font-mono text-[10px]">Application State Load</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-[10px] text-slate-600 font-mono">
                                            {log.path}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    );
};

export default UsageMetrics;
