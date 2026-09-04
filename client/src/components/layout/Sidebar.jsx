import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Briefcase, Settings, LogOut, BarChart3, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Sidebar() {
    const location = useLocation();
    const navigate = useNavigate();

    const navigation = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Insights', href: '/insights', icon: BarChart3 },
        { name: 'Audit', href: '/audit', icon: FileText },
        { name: 'Settings', href: '/settings', icon: Settings },
    ];

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 text-slate-700 w-64 border-r border-slate-200 shrink-0">
            <div className="h-16 flex items-center px-6 border-b border-slate-200">
                <span className="text-xl font-bold text-slate-900 tracking-tight">Recover<span className="text-red-600">OS</span></span>
            </div>
            
            <div className="flex-1 py-6 px-4 space-y-1">
                {navigation.map((item) => {

                    const isActive = location.pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                                isActive 
                                    ? 'bg-red-50 text-red-600 font-medium' 
                                    : 'hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-red-600' : 'text-slate-500'}`} />
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            <div className="p-4 border-t border-slate-200">
                <button 
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-3 py-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                >
                    <LogOut className="w-5 h-5" />
                    Sign out
                </button>
            </div>
        </div>
    );
}
