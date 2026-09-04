import { useState, useEffect } from 'react';
import { getCases } from '../services/api/casesService';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronRight } from 'lucide-react';
import { formatMoney } from '../utils/currency';

export default function RecoveryCases() {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCases = async () => {
            try {
                const data = await getCases();
                setCases(data);
            } catch (error) {
                toast.error('Failed to load recovery cases');
            } finally {
                setLoading(false);
            }
        };
        fetchCases();
    }, []);



    const getStatusBadge = (status) => {
        const variants = {
            OPEN: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
            ANALYZING: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
            WAITING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
            ACTION_REQUIRED: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
            ESCALATED: 'bg-red-500/10 text-red-400 border-red-500/20',
            RECOVERED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
            FAILED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
            STOPPED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
            EXPIRED: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
        };

        const className = variants[status] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';

        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Recovery Cases</h1>
                    <p className="text-zinc-400 mt-1">Manage and track all automated recovery workflows.</p>
                </div>
            </div>

            <div className="bg-[#161616] border border-zinc-800 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-zinc-400">Loading cases...</div>
                ) : cases.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400">No recovery cases found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-zinc-400 uppercase bg-zinc-900/50 border-b border-zinc-800">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Case ID</th>
                                    <th className="px-6 py-4 font-medium">Type</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium">Revenue At Risk</th>
                                    <th className="px-6 py-4 font-medium">Recovered</th>
                                    <th className="px-6 py-4 font-medium">Date</th>
                                    <th className="px-6 py-4 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {cases.map((c) => (
                                    <tr key={c.id} className="hover:bg-zinc-800/30 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white truncate max-w-[150px]" title={c.id}>
                                            {c.id}
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.type === 'PAYMENT_FAILURE' ? 'Payment Failure' : 'Cart Abandonment'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(c.status)}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-300">
                                            {formatMoney(c.revenueAtRisk)}
                                        </td>
                                        <td className="px-6 py-4 text-emerald-400 font-medium">
                                            {formatMoney(c.outcome?.amountRecovered)}
                                        </td>
                                        <td className="px-6 py-4 text-zinc-400 whitespace-nowrap">
                                            {new Date(c.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link 
                                                to={`/cases/${c.id}`}
                                                className="inline-flex items-center justify-center p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
