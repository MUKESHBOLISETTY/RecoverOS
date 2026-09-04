import { format } from 'date-fns';
import { 
    CheckCircle2, 
    XCircle, 
    AlertTriangle, 
    MessageSquare, 
    Tag, 
    Link as LinkIcon, 
    Calendar,
    Activity,
    ShieldCheck,
    PlayCircle
} from 'lucide-react';

export default function AuditTimeline({ events = [] }) {
    if (!events || events.length === 0) {
        return (
            <div className="text-center py-12 text-slate-500 border border-dashed border-slate-200 rounded-lg bg-slate-50">
                No recovery activity has been recorded yet.
            </div>
        );
    }

    const getEventIcon = (eventType) => {
        switch (eventType) {
            case 'RECOVERY_CASE_CREATED':
            case 'RECOVERY_AGENT_STARTED':
                return <PlayCircle className="w-4 h-4 text-blue-500" />;
            case 'POLICY_VALIDATED':
                return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
            case 'COMMUNICATION_SENT':
                return <MessageSquare className="w-4 h-4 text-purple-500" />;
            case 'DISCOUNT_CREATED':
                return <Tag className="w-4 h-4 text-yellow-500" />;
            case 'PAYMENT_LINK_CREATED':
                return <LinkIcon className="w-4 h-4 text-indigo-500" />;
            case 'FOLLOW_UP_SCHEDULED':
                return <Calendar className="w-4 h-4 text-orange-500" />;
            case 'RECOVERY_CASE_RECOVERED':
            case 'RECOVERY_VERIFICATION_COMPLETED':
                return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
            case 'RECOVERY_CASE_FAILED':
            case 'RECOVERY_CASE_STOPPED':
                return <XCircle className="w-4 h-4 text-red-500" />;
            case 'RECOVERY_ACTION_STARTED':
                return <Activity className="w-4 h-4 text-blue-500" />;
            default:
                return <Activity className="w-4 h-4 text-slate-400" />;
        }
    };

    const formatEventName = (eventType) => {
        const str = eventType.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        
        if (str.includes('Cart')) {
            return str.replace('Cart', 'Checkout');
        }
        return str;
    };

    const getSafeExplanation = (event) => {
        const { action, newValue, metadata } = event;
        
        if (metadata?.explanation) {
            return metadata.explanation;
        }
        
        switch(action) {
            case 'RECOVERY_CASE_CREATED':
                return "New recovery opportunity detected.";
            case 'RECOVERY_AGENT_STARTED':
                return "RecoverOS started analyzing this recovery opportunity.";
            case 'AGENT_DECISION':
                return newValue?.rationale || "Agent analyzed recovery context and decided on the next action.";
            case 'POLICY_VALIDATED':
                return newValue?.constraint ? `Validated policy constraint: ${newValue.constraint}` : "Action validated against merchant recovery policy.";
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
        <div className="relative space-y-0 pl-4 before:absolute before:inset-0 before:ml-6 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200">
            {events.map((event, index) => {
                return (
                    <div key={event.id} className="relative flex items-start group is-active py-4">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm shrink-0 z-10 transition-colors mt-0.5">
                            {getEventIcon(event.action)}
                        </div>
                        <div className="w-full ml-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <div className="font-semibold text-slate-900 text-sm">
                                    {formatEventName(event.action)}
                                </div>
                                <time className="text-xs font-medium text-slate-500">
                                    {format(new Date(event.createdAt), 'MMM d, yyyy h:mm a')}
                                </time>
                            </div>
                            
                            <p className="text-sm text-slate-600 mt-1 mb-2">
                                {getSafeExplanation(event)}
                            </p>

                            {event.newValue?.action && (
                                <div className="text-xs text-slate-700 font-medium bg-slate-100 inline-block px-2 py-0.5 rounded-full border border-slate-200 mt-1">
                                    Action: {event.newValue.action}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
