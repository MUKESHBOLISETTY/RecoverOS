import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCaseDetails } from '../services/api/casesService';
import { getCustomerName } from '../utils/customerUtils';
import { ArrowLeft, Clock, Activity, ShoppingCart, CreditCard, AlertCircle, RefreshCw, AlertTriangle, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { formatMoney } from '../utils/currency';
import toast from 'react-hot-toast';
import AuditTimeline from '../components/cases/AuditTimeline';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { fetchEventSource } from '@microsoft/fetch-event-source';

export default function CaseJourney() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [caseData, setCaseData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const fetchCase = useCallback(async () => {
        try {
            setError(false);
            const data = await getCaseDetails(id);
            setCaseData(data);
        } catch (error) {
            setError(true);
            toast.error('Unable to load this recovery case.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchCase();
    }, [fetchCase]);

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
                            if (data.caseId === id || data.entityId === id) {
                                fetchCase();
                            }
                        } catch (e) {
                            console.error('Error parsing SSE event', e);
                        }
                    },
                    onerror(err) {
                        console.error('SSE Error:', err);
                    },
                    onclose() {
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
    }, [id]);



    const getStatusBadge = (status) => {
        const variants = {
            OPEN: 'bg-blue-100 text-blue-700',
            ANALYZING: 'bg-purple-100 text-purple-700',
            WAITING: 'bg-amber-100 text-amber-700',
            ACTION_REQUIRED: 'bg-orange-100 text-orange-700',
            ESCALATED: 'bg-red-100 text-red-700',
            RECOVERED: 'bg-emerald-100 text-emerald-700',
            FAILED: 'bg-slate-100 text-slate-700',
            STOPPED: 'bg-slate-100 text-slate-700',
            EXPIRED: 'bg-slate-100 text-slate-700',
        };

        const className = variants[status] || 'bg-slate-100 text-slate-700';
        return (
            <Badge variant="outline" className={`border-0 ${className}`}>
                {status}
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-24 w-full" />
                <div className="grid md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-4">
                        <Skeleton className="h-[400px] w-full" />
                    </div>
                    <div className="md:col-span-1 space-y-4">
                        <Skeleton className="h-64 w-full" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !caseData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                    {error ? 'Unable to load this recovery case' : 'Recovery case not found'}
                </h2>
                <div className="flex gap-4 mt-6">
                    {error && (
                        <button onClick={fetchCase} className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800">
                            Try again
                        </button>
                    )}
                    <button onClick={() => navigate('/dashboard')} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50">
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const typeDisplay = caseData.type === 'PAYMENT_FAILURE' ? 'Payment Failure' : 'Checkout Abandonment';
    const completedActions = caseData.actions ? caseData.actions.filter(a => a.status === 'COMPLETED') : [];

    let agentDecision = "Decision details are not available for this execution.";
    if (caseData.agentExecutions && caseData.agentExecutions.length > 0) {
        const executionWithDecision = caseData.agentExecutions.find(e => e.decision && e.decision.rationale);
        if (executionWithDecision) {
            agentDecision = executionWithDecision.decision.rationale;
        }
    }

    return (
        <div className="space-y-6 max-w-5xl pb-12">
            {/* Header */}
            <div>
                <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-4 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Link>
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                {getCustomerName(caseData)}
                            </h1>
                            {getStatusBadge(caseData.status)}
                        </div>
                        <p className="text-slate-500 flex items-center gap-4 text-sm">
                            <span className="font-medium text-slate-700">{typeDisplay}</span>
                            <span>•</span>
                            <span>Created {new Date(caseData.createdAt).toLocaleDateString()}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Hero Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4">
                        <div className="text-sm font-medium text-slate-500 mb-1">Revenue at Risk</div>
                        <div className="text-2xl font-bold text-slate-900">{formatMoney(caseData.revenueAtRisk)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4">
                        <div className="text-sm font-medium text-slate-500 mb-1">Recovered Revenue</div>
                        <div className="text-2xl font-bold text-emerald-600">{formatMoney(caseData.outcome?.amountRecovered)}</div>
                    </CardContent>
                </Card>
                <Card className="shadow-sm border-slate-200">
                    <CardContent className="p-4">
                        <div className="text-sm font-medium text-slate-500 mb-1">Interventions</div>
                        <div className="text-2xl font-bold text-slate-900">{completedActions.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Main Column */}
                <div className="md:col-span-2 space-y-8">
                    {/* Timeline */}
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-slate-400" /> Recovery Journey
                        </h2>
                        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                            <AuditTimeline events={caseData.auditEvents || []} />
                        </div>
                    </div>

                    {/* Actions List */}
                    {caseData.actions && caseData.actions.length > 0 && (
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-slate-400" /> Recovery Actions
                            </h2>
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
                                {caseData.actions.map((action, idx) => (
                                    <div key={action.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-200 font-medium text-xs shrink-0">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-900 capitalize">
                                                    {action.type.replace(/_/g, ' ')}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {new Date(action.createdAt).toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-0">
                                                {action.status}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Final Result Panel */}
                    {caseData.status === 'RECOVERED' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-emerald-100 rounded-full shrink-0">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-emerald-900 mb-1">Recovered</h3>
                                    <p className="text-emerald-700 font-medium">{formatMoney(caseData.outcome?.amountRecovered)} recovered</p>
                                    <p className="text-sm text-emerald-600 mt-2">
                                        Recovery verified at: {caseData.outcome?.recoveredAt ? new Date(caseData.outcome.recoveredAt).toLocaleString() : new Date(caseData.outcome?.createdAt).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {(caseData.status === 'STOPPED' || caseData.status === 'FAILED') && (
                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-slate-200 rounded-full shrink-0">
                                    {caseData.status === 'STOPPED' ? <AlertCircle className="w-6 h-6 text-slate-600" /> : <XCircle className="w-6 h-6 text-red-500" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                        {caseData.status === 'STOPPED' ? 'Recovery stopped' : 'Recovery failed'}
                                    </h3>
                                    <div className="mt-2 text-sm text-slate-700">
                                        <span className="font-medium text-slate-900">Reason: </span> 
                                        {caseData.outcome?.notes || caseData.outcome?.stopReason || 'No reason provided.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {caseData.status === 'ANALYZING' && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-purple-100 rounded-full shrink-0">
                                    <Activity className="w-6 h-6 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-purple-900 mb-1">Recovery in progress</h3>
                                    <p className="text-sm text-purple-700">RecoverOS is currently analyzing this recovery opportunity.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Summary Column */}
                <div className="md:col-span-1 space-y-6">
                    {/* Agent Decision */}
                    <Card className="shadow-sm border-slate-200 bg-blue-50/50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                                <Shield className="w-4 h-4 text-blue-500" /> Agent Decision
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-blue-800 leading-relaxed italic">
                                "{agentDecision}"
                            </p>
                        </CardContent>
                    </Card>

                    {/* Recovery Summary Box */}
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="pb-3 bg-slate-50 border-b border-slate-100">
                            <CardTitle className="text-base text-slate-900">Recovery Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-1">Status</div>
                                <div>{getStatusBadge(caseData.status)}</div>
                            </div>
                            
                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-1">Recovery Type</div>
                                <div className="text-sm font-medium text-slate-900">
                                    {typeDisplay}
                                </div>
                            </div>

                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-1">Revenue At Risk</div>
                                <div className="text-sm font-medium text-slate-900">
                                    {formatMoney(caseData.revenueAtRisk)}
                                </div>
                            </div>

                            {caseData.outcome?.amountRecovered && (
                                <div>
                                    <div className="text-xs font-medium text-slate-500 mb-1">Recovered Revenue</div>
                                    <div className="text-sm font-bold text-emerald-600">
                                        {formatMoney(caseData.outcome.amountRecovered)}
                                    </div>
                                </div>
                            )}
                            
                            <div>
                                <div className="text-xs font-medium text-slate-500 mb-1">Current Intervention</div>
                                <div className="text-sm font-medium text-slate-900 capitalize">
                                    {completedActions.length > 0 
                                        ? completedActions[completedActions.length - 1].type.replace(/_/g, ' ') 
                                        : 'None yet'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
