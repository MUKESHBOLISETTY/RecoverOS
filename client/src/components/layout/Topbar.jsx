import { Bell } from 'lucide-react';
import { useSelector } from 'react-redux';

export default function Topbar() {
    const { user } = useSelector((state) => state.auth);

    return (
        <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200">
            <div className="flex-1">
                {/* Search or breadcrumbs could go here */}
            </div>
            
            <div className="flex items-center gap-4">
                <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                
                <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-medium text-sm">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-slate-700 hidden sm:block">
                        {user?.email || 'Merchant'}
                    </span>
                </div>
            </div>
        </header>
    );
}
