import React, { useEffect, useState } from 'react';
import { getDashboardMetrics } from '../services/api/insightsService';
import { formatMoney, formatPercent } from '../utils/currency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { AlertCircle, TrendingUp, Briefcase, Activity, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Insights() {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const data = await getDashboardMetrics();
                setMetrics(data);
            } catch (error) {
                toast.error('Unable to load revenue insights.');
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="space-y-6 max-w-6xl">
                <div>
                    <Skeleton className="h-10 w-48 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center border border-slate-200 rounded-xl bg-slate-50">
                <AlertCircle className="w-8 h-8 text-slate-400 mb-4" />
                <h2 className="text-xl font-bold text-slate-900 mb-2">No recovery data available for this period.</h2>
                <p className="text-slate-500">Insights will populate as RecoverOS processes recovery cases.</p>
            </div>
        );
    }

    const atRisk = BigInt(metrics.revenueAtRisk || '0');
    const recovered = BigInt(metrics.recoveredRevenue || '0');
    
    let recoveryProgressPercent = 0;
    if (atRisk > 0n) {
        recoveryProgressPercent = Number((recovered * 100n) / atRisk);
    }

    const { activeCases, recoveredCases, stoppedCases, totalCases } = metrics;
    const activePercent = totalCases > 0 ? (activeCases / totalCases) * 100 : 0;
    const recoveredPercent = totalCases > 0 ? (recoveredCases / totalCases) * 100 : 0;
    const stoppedPercent = totalCases > 0 ? (stoppedCases / totalCases) * 100 : 0;

    return (
        <div className="max-w-6xl space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Revenue Insights</h1>
                <p className="text-slate-500 mt-1">Measure how RecoverOS is performing across your recovery cases.</p>
            </div>

            {/* Primary Top Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="shadow-sm border-slate-200 bg-white">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 text-slate-500 mb-3">
                            <Activity className="w-5 h-5" />
                            <h3 className="font-medium">Revenue at Risk</h3>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">
                            {formatMoney(metrics.revenueAtRisk)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-emerald-200 bg-emerald-50">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 text-emerald-700 mb-3">
                            <Shield className="w-5 h-5" />
                            <h3 className="font-medium">Recovered Revenue</h3>
                        </div>
                        <div className="text-3xl font-bold text-emerald-700">
                            {formatMoney(metrics.recoveredRevenue)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200 bg-white">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 text-slate-500 mb-3">
                            <TrendingUp className="w-5 h-5" />
                            <h3 className="font-medium">Recovery Rate</h3>
                        </div>
                        <div className="text-3xl font-bold text-slate-900">
                            {formatPercent(metrics.recoveryRate)}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                            {metrics.recoveredCases} of {metrics.totalCases} cases recovered
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue Recovery Visual */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Recovery Performance</CardTitle>
                        <CardDescription>Comparison of total revenue exposed to risk vs successfully recovered.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6 pt-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-sm font-medium text-slate-700">Revenue at Risk</span>
                                    <span className="font-bold text-slate-900">{formatMoney(metrics.revenueAtRisk)}</span>
                                </div>
                                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-300 rounded-full w-full"></div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <span className="text-sm font-medium text-emerald-700">Recovered Revenue</span>
                                    <span className="font-bold text-emerald-600">{formatMoney(metrics.recoveredRevenue)}</span>
                                </div>
                                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                                        style={{ width: `${Math.min(recoveryProgressPercent, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Case Outcomes Breakdown */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle>Recovery Outcomes</CardTitle>
                        <CardDescription>Status breakdown across all {totalCases} identified cases.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div> Recovering (Active)
                                    </span>
                                    <span className="font-medium text-slate-900">{activeCases}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400" style={{ width: `${activePercent}%` }}></div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Recovered
                                    </span>
                                    <span className="font-medium text-slate-900">{recoveredCases}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${recoveredPercent}%` }}></div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-slate-300"></div> Stopped
                                    </span>
                                    <span className="font-medium text-slate-900">{stoppedCases}</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-300" style={{ width: `${stoppedPercent}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Intervention Performance */}
                {metrics.recoveryByIntervention && (
                    <Card className="shadow-sm border-slate-200 lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Intervention Performance</CardTitle>
                            <CardDescription>Recovery metrics for cases involving specific interventions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.entries(metrics.recoveryByIntervention).map(([key, data]) => {
                                    if (data.cases === 0) return null;
                                    
                                    const labels = {
                                        email: 'Email Recovery',
                                        sms: 'SMS Recovery',
                                        discount: 'Discount Offers',
                                        paymentLink: 'Payment Links'
                                    };

                                    return (
                                        <div key={key} className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                                            <h4 className="font-medium text-slate-900 mb-2">{labels[key] || key}</h4>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Cases involved</span>
                                                    <span className="font-medium text-slate-700">{data.cases}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500">Recovered cases</span>
                                                    <span className="font-medium text-emerald-600">{data.recoveredCases}</span>
                                                </div>
                                                <div className="flex justify-between mt-2 pt-2 border-t border-slate-200">
                                                    <span className="text-slate-600 font-medium">Assoc. Revenue</span>
                                                    <span className="font-bold text-slate-900">{formatMoney(data.recoveredRevenue)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {Object.values(metrics.recoveryByIntervention).every(d => d.cases === 0) && (
                                    <div className="col-span-3 py-6 text-center text-sm text-slate-500">
                                        No interventions have been used yet.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
