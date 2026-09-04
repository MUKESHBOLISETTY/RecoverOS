import React, { useState, useEffect } from 'react';
import { getAuditEvents } from '../services/api/auditService';
import { getCases } from '../services/api/casesService';
import { formatMoney } from '../utils/currency';
import { getCustomerName } from '../utils/customerUtils';
import { Search, Filter, AlertCircle, FileText, ChevronLeft, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';

export default function Audit() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalPages: 1, total: 0 });
    
    const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const [casesMap, setCasesMap] = useState({});

    useEffect(() => {
        getCases().then(data => {
            const map = {};
            data.forEach(c => map[c.id] = c);
            setCasesMap(map);
        }).catch(err => console.error(err));
    }, []);

    const fetchEvents = async (page = 1, type = 'ALL', search = '') => {
        try {
            setLoading(true);
            const data = await getAuditEvents({ page, pageSize: 20, eventType: type, search });
            setEvents(data.events || []);
            setPagination(data.pagination || { page: 1, pageSize: 20, totalPages: 1, total: 0 });
        } catch (error) {
            toast.error('Unable to load audit activity.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents(1, eventTypeFilter, searchQuery);
    }, [eventTypeFilter, searchQuery]);

    const handleSearch = (e) => {
        e.preventDefault();
        setSearchQuery(searchInput);
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchEvents(newPage, eventTypeFilter, searchQuery);
        }
    };

    const openEventDetails = (event) => {
        setSelectedEvent(event);
        setIsDialogOpen(true);
    };

    const getEventBadge = (action) => {
        if (action.includes('CREATED') || action.includes('STARTED') || action === 'RECOVERY_CASE_CREATED') return 'bg-blue-100 text-blue-700';
        if (action.includes('VALIDATED') || action.includes('DECISION')) return 'bg-purple-100 text-purple-700';
        if (action.includes('SENT') || action.includes('SCHEDULED')) return 'bg-amber-100 text-amber-700';
        if (action.includes('BLOCKED') || action.includes('FAILED')) return 'bg-red-100 text-red-700';
        if (action.includes('RECOVERED') || action.includes('COMPLETED')) return 'bg-emerald-100 text-emerald-700';
        return 'bg-slate-100 text-slate-700';
    };

    const formatActionName = (action) => {
        return action.replace(/_/g, ' ').toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase());
    };

    const getSafeExplanation = (event) => {
        const { action, newValue, metadata } = event;
        
        if (metadata?.explanation) {
            return metadata.explanation;
        }
        
        switch(action) {
            case 'RECOVERY_CASE_CREATED':
                return "New checkout recovery opportunity detected.";
            case 'RECOVERY_AGENT_STARTED':
                return "RecoverOS started analyzing this recovery opportunity.";
            case 'AGENT_DECISION':
                return newValue?.rationale || "Agent analyzed recovery context and decided on the next action.";
            case 'POLICY_VALIDATED':
                return newValue?.constraint ? `Requested action approved: ${newValue.constraint}` : "Action validated against merchant recovery policy.";
            case 'COMMUNICATION_SENT':
                return newValue?.channel ? `Recovery communication sent via ${newValue.channel}.` : "Recovery communication sent.";
            case 'DISCOUNT_CREATED':
                return newValue?.percentage ? `${newValue.percentage}% recovery discount created.` : "Recovery discount generated.";
            case 'PAYMENT_LINK_CREATED':
                return "Secure recovery payment link created.";
            case 'FOLLOW_UP_SCHEDULED':
                return "Follow-up recovery action scheduled.";
            case 'RECOVERY_VERIFICATION_COMPLETED':
                return "Recovery result verification completed.";
            case 'RECOVERY_CASE_RECOVERED':
                return "Revenue successfully recovered.";
            case 'RECOVERY_CASE_FAILED':
            case 'RECOVERY_CASE_STOPPED':
                return "Recovery process ended without success.";
            default:
                return "Recovery action executed.";
        }
    };

    return (
        <div className="max-w-6xl space-y-6 pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Audit Activity</h1>
                <p className="text-slate-500 mt-1">Review the actions RecoverOS has taken across your recovery cases.</p>
            </div>

            <Card className="shadow-sm border-slate-200">
                <CardContent className="p-0">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 rounded-t-lg">
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                                <SelectTrigger className="w-full sm:w-[240px] bg-white">
                                    <div className="flex items-center gap-2">
                                        <Filter className="w-4 h-4 text-slate-500" />
                                        <SelectValue placeholder="Filter by event type" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Events</SelectItem>
                                    <SelectItem value="RECOVERY_CASE_CREATED">Case Created</SelectItem>
                                    <SelectItem value="AGENT_DECISION">Agent Decision</SelectItem>
                                    <SelectItem value="POLICY_VALIDATED">Policy Validated</SelectItem>
                                    <SelectItem value="COMMUNICATION_SENT">Communication Sent</SelectItem>
                                    <SelectItem value="DISCOUNT_CREATED">Discount Created</SelectItem>
                                    <SelectItem value="RECOVERY_CASE_RECOVERED">Recovered</SelectItem>
                                    <SelectItem value="RECOVERY_CASE_STOPPED">Stopped</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <form onSubmit={handleSearch} className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder="Search by Case ID..." 
                                className="pl-9 bg-white"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                            />
                        </form>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-white border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Time</th>
                                    <th className="px-6 py-4 font-medium">Event</th>
                                    <th className="px-6 py-4 font-medium">Recovery Case</th>
                                    <th className="px-6 py-4 font-medium">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i}>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-24" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-6 w-32 rounded-full" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-32" /></td>
                                            <td className="px-6 py-4"><Skeleton className="h-4 w-48" /></td>
                                        </tr>
                                    ))
                                ) : events.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-500">
                                                <FileText className="w-8 h-8 mb-3 text-slate-300" />
                                                <p>No recovery activity recorded yet.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    events.map((event) => (
                                        <tr 
                                            key={event.id} 
                                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                                            onClick={() => openEventDetails(event)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                                {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                <div className="text-xs text-slate-400 mt-0.5">{new Date(event.createdAt).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="secondary" className={`border-0 font-medium ${getEventBadge(event.action)}`}>
                                                    {formatActionName(event.action)}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                                {casesMap[event.entityId] ? (
                                                    <div className="font-sans">
                                                        <div className="font-medium text-slate-900">{getCustomerName(casesMap[event.entityId])}</div>
                                                        <div className="text-slate-500 mt-0.5">{casesMap[event.entityId].type === 'PAYMENT_FAILURE' ? 'Payment Failure' : 'Checkout Abandonment'}</div>
                                                    </div>
                                                ) : (
                                                    `${event.entityId.substring(0, 8)}...`
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 max-w-md truncate">
                                                {getSafeExplanation(event)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && events.length > 0 && (
                        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-white rounded-b-lg text-sm text-slate-500">
                            <div>
                                Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} events
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    className="border-slate-200 text-slate-700"
                                >
                                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="border-slate-200 text-slate-700"
                                >
                                    Next <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Event Details Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {selectedEvent && (
                                <Badge variant="secondary" className={`border-0 ${getEventBadge(selectedEvent.action)}`}>
                                    {formatActionName(selectedEvent.action)}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedEvent && new Date(selectedEvent.createdAt).toLocaleString()}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEvent && (
                        <div className="space-y-6 pt-4">
                            <div className="grid grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                                <div>
                                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Recovery Case</div>
                                    <div className="font-medium text-sm text-slate-900">
                                        {casesMap[selectedEvent.entityId] ? getCustomerName(casesMap[selectedEvent.entityId]) : 'Unknown Customer'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Actor</div>
                                    <div className="text-sm text-slate-900">System (Merchant Policy)</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm font-semibold text-slate-900">Event Metadata</div>
                                
                                <div className="p-4 bg-slate-50 rounded-md border border-slate-200 text-sm text-slate-700 leading-relaxed">
                                    {getSafeExplanation(selectedEvent)}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
