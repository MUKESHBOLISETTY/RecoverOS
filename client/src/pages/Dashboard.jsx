import { useState, useEffect, useCallback } from 'react';
import { getDashboardMetrics } from '../services/api/insightsService';
import { getCases } from '../services/api/casesService';
import { Activity, Briefcase, TrendingUp, AlertCircle, RefreshCw, ChevronRight, CheckCircle2, Clock, AlertTriangle, XCircle, Info } from 'lucide-react';
import { formatMoney, formatPercent } from '../utils/currency';
import { getCustomerName } from '../utils/customerUtils';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { fetchEventSource } from '@microsoft/fetch-event-source';

export default function Dashboard() {
    const [metrics, setMetrics] = useState(null);
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [agentEvents, setAgentEvents] = useState([]);
    
    const navigate = useNavigate();

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const [metricsData, casesData] = await Promise.all([
                getDashboardMetrics().catch(() => null),
                getCases().catch(() => [])
            ]);
            
            if (!metricsData) {
                setError("Unable to load recovery insights.");
            } else {
                setMetrics(metricsData);
            }
            
            setCases(casesData);
        } catch (err) {
            setError("Unable to load recovery insights.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const controller = new AbortController();

        const connectSSE = async () => {
            try {
                await fetchEventSource(`${import.meta.env.VITE_API_URL}/api/v1/recovery/stream`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    signal: controller.signal,
                    onmessage(ev) {
                        try {
                            const data = JSON.parse(ev.data);
                            if (data.type === 'activity' || data.type === 'started' || data.type === 'completed') {
                                setAgentEvents(prev => {
                                    const newEvents = [data, ...prev].slice(0, 5); // Keep last 5 events
                                    return newEvents;
                                });
                            }
                            if (data.type === 'case_created' || data.type === 'case_updated' || data.type === 'recovered') {
                                fetchData();
                            }
                        } catch (e) {
                            console.error('Error parsing SSE event', e);
                        }
                    },
                    onerror(err) {
                        console.error('SSE Error:', err);
                    }
                });
            } catch (err) {
                console.error("SSE connection failed:", err);
            }
        };

        connectSSE();

        return () => {
            controller.abort();
        };
    }, [fetchData]);

    const getStatusBadge = (status) => {
        const variants = {
            OPEN: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
            ANALYZING: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
            WAITING: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
            ACTION_REQUIRED: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
            ESCALATED: 'bg-red-100 text-red-700 hover:bg-red-100',
            RECOVERED: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
            FAILED: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
            STOPPED: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
            EXPIRED: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
        };

        const className = variants[status] || 'bg-slate-100 text-slate-700';

        return (
            <Badge variant="outline" className={`border-0 ${className}`}>
                {status}
            </Badge>
        );
    };

    const activeCasesList = cases.filter(c => ['OPEN', 'ANALYZING', 'WAITING', 'ACTION_REQUIRED'].includes(c.status));
    const recentRecoveries = cases.filter(c => c.status === 'RECOVERED').slice(0, 5);

    const totalRisk = metrics?.revenueAtRisk ? parseInt(metrics.revenueAtRisk, 10) : 0;
    const totalRecovered = metrics?.recoveredRevenue ? parseInt(metrics.recoveredRevenue, 10) : 0;
    const maxBarValue = Math.max(totalRisk, totalRecovered, 1);
    const riskPercentage = Math.min((totalRisk / maxBarValue) * 100, 100);
    const recoveredPercentage = Math.min((totalRecovered / maxBarValue) * 100, 100);

    const statusCounts = cases.reduce((acc, c) => {
        if (['OPEN', 'ANALYZING', 'WAITING'].includes(c.status)) acc.recovering++;
        else if (c.status === 'RECOVERED') acc.recovered++;
        else if (['FAILED', 'STOPPED', 'EXPIRED'].includes(c.status)) acc.stopped++;
        else acc.atRisk++;
        return acc;
    }, { atRisk: 0, recovering: 0, recovered: 0, stopped: 0 });

    return (
        <div className="space-y-8 max-w-7xl pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 mt-1">Revenue recovery at a glance.</p>
                </div>
                <button 
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-md text-sm font-medium transition-colors shadow-sm self-start"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    <button onClick={fetchData} className="text-sm font-medium underline hover:text-red-800">Retry</button>
                </div>
            )}

            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Revenue at Risk</CardTitle>
                        <AlertCircle className="w-4 h-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold text-slate-900">{formatMoney(metrics?.revenueAtRisk)}</div>}
                        <p className="text-xs text-slate-500">Currently exposed</p>
                    </CardContent>
                </Card>
                
                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Recovered Revenue</CardTitle>
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold text-slate-900">{formatMoney(metrics?.recoveredRevenue)}</div>}
                        <p className="text-xs text-slate-500">Recovered by RecoverOS</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Recovery Rate</CardTitle>
                        <Activity className="w-4 h-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold text-slate-900">{formatPercent(metrics?.recoveryRate || 0)}</div>}
                        <p className="text-xs text-slate-500">Cases recovered</p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Active Cases</CardTitle>
                        <Briefcase className="w-4 h-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        {loading ? <Skeleton className="h-8 w-24 mb-1" /> : <div className="text-2xl font-bold text-slate-900">{metrics?.activeCases || 0}</div>}
                        <p className="text-xs text-slate-500">Currently being recovered</p>
                    </CardContent>
                </Card>
            </div>

            {/* Performance & Overview */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="shadow-sm md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-900">Revenue Recovery Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
                        ) : (
                            <div className="space-y-6 mt-2">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-700">Revenue at Risk</span>
                                        <span className="text-sm font-bold text-slate-900">{formatMoney(metrics?.revenueAtRisk)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3">
                                        <div className="bg-red-500 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.max(riskPercentage, 2)}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium text-slate-700">Recovered Revenue</span>
                                        <span className="text-sm font-bold text-slate-900">{formatMoney(metrics?.recoveredRevenue)}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3">
                                        <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500" style={{ width: `${Math.max(recoveredPercentage, 2)}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold text-slate-900">Recovery Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="space-y-3"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /></div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-sm text-slate-600">At Risk</span></div>
                                    <span className="font-semibold text-slate-900">{statusCounts.atRisk}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-sm text-slate-600">Recovering</span></div>
                                    <span className="font-semibold text-slate-900">{statusCounts.recovering}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-sm text-slate-600">Recovered</span></div>
                                    <span className="font-semibold text-slate-900">{statusCounts.recovered}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-400"></div><span className="text-sm text-slate-600">Stopped</span></div>
                                    <span className="font-semibold text-slate-900">{statusCounts.stopped}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Agent Activity Banner */}
            <Card className="shadow-sm bg-blue-50/50 border-blue-100">
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-blue-900">Revenue Recovery Agent</span>
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-0 flex gap-1 items-center px-1.5 py-0">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Active
                            </Badge>
                        </div>
                        <p className="text-sm text-blue-800">
                            {agentEvents.length > 0 
                                ? agentEvents[0].message || "Executing recovery workflow..."
                                : "Monitoring checkout abandonment and payment failures."}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Active Recovery Cases */}
            <div>
                <div className="mb-4">
                    <h2 className="text-xl font-bold tracking-tight text-slate-900">Active Recovery Cases</h2>
                    <p className="text-sm text-slate-500">RecoverOS is currently working on these revenue opportunities.</p>
                </div>
                
                <Card className="shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                            <Skeleton className="h-8 w-full" />
                        </div>
                    ) : activeCasesList.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-6 h-6 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">No recovery activity yet</h3>
                            <p className="text-slate-500 max-w-sm mt-1">
                                RecoverOS will automatically detect eligible revenue-risk events once your connected commerce and payment systems receive activity.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Customer</th>
                                        <th className="px-6 py-4 font-medium">Recovery Type</th>
                                        <th className="px-6 py-4 font-medium">Revenue At Risk</th>
                                        <th className="px-6 py-4 font-medium">Status</th>
                                        <th className="px-6 py-4 font-medium text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {activeCasesList.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {getCustomerName(c)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {c.type === 'PAYMENT_FAILURE' ? 'Payment Failure' : 'Checkout Abandonment'}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {formatMoney(c.revenueAtRisk)}
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(c.status)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="inline-flex items-center justify-center p-2 text-slate-400 group-hover:text-slate-900 rounded-md transition-colors">
                                                    <ChevronRight className="w-4 h-4" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Card>
            </div>

            {/* Recent Recoveries */}
            {recentRecoveries.length > 0 && (
                <div>
                    <div className="mb-4">
                        <h2 className="text-xl font-bold tracking-tight text-slate-900">Recent Recovery Activity</h2>
                    </div>
                    
                    <Card className="shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-medium">Time</th>
                                        <th className="px-6 py-4 font-medium">Customer</th>
                                        <th className="px-6 py-4 font-medium">Type</th>
                                        <th className="px-6 py-4 font-medium">Recovered Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 bg-white">
                                    {recentRecoveries.map((c) => (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                                            <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                                {new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-900">
                                                {getCustomerName(c)}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">
                                                {c.type === 'PAYMENT_FAILURE' ? 'Payment Failure' : 'Checkout Abandonment'}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-emerald-600">
                                                {formatMoney(c.outcome?.amountRecovered)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
