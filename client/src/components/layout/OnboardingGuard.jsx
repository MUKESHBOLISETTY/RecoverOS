import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchOnboardingStatus } from '../../redux/slices/onboardingSlice';

export default function OnboardingGuard({ children }) {
    const dispatch = useDispatch();
    const location = useLocation();
    const { isReady } = useSelector((state) => state.onboarding);
    const [initialLoad, setInitialLoad] = React.useState(true);

    useEffect(() => {
        dispatch(fetchOnboardingStatus()).finally(() => {
            setInitialLoad(false);
        });
    }, [dispatch]);

    // Show loading screen while checking onboarding status initially
    if (initialLoad) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="w-full max-w-3xl space-y-8 animate-pulse">
                    <div className="h-12 w-64 bg-slate-200 rounded"></div>
                    <div className="h-64 w-full bg-slate-200 rounded"></div>
                </div>
            </div>
        );
    }

    // If not ready and trying to access protected content, go to onboarding
    if (!isReady && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />;
    }

    // We allow users to stay on /onboarding even if ready, so they can see the success message
    // and explicitly click "Go to Dashboard".

    return children;
}
