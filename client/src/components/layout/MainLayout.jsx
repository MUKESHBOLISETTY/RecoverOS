import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function MainLayout() {
    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden selection:bg-red-100 selection:text-red-900">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
                <Topbar />
                <main className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 p-6 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
