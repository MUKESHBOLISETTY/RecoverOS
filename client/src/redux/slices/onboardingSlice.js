import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getOnboardingStatus } from '../../services/api/onboardingService';

export const fetchOnboardingStatus = createAsyncThunk(
    'onboarding/fetchStatus',
    async (_, { rejectWithValue }) => {
        try {
            const data = await getOnboardingStatus();
            return data;
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message || 'Failed to fetch onboarding status'
            );
        }
    }
);

const initialState = {
    shopifyConnected: false,
    razorpayConnected: false,
    agentProvisioned: false,
    policyConfigured: false,
    selectedCommunicationChannels: [],
    communicationConnections: { EMAIL: false, SMS: false },
    requiredConnections: [],
    isReady: false,
    loading: true,
    error: null,
};

const onboardingSlice = createSlice({
    name: 'onboarding',
    initialState,
    reducers: {
        resetOnboardingError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchOnboardingStatus.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchOnboardingStatus.fulfilled, (state, action) => {
                state.loading = false;
                state.shopifyConnected = action.payload.shopifyConnected || false;
                state.razorpayConnected = action.payload.razorpayConnected || false;
                state.agentProvisioned = action.payload.agentProvisioned || false;
                state.policyConfigured = action.payload.policyConfigured || false;
                state.selectedCommunicationChannels = action.payload.selectedCommunicationChannels || [];
                state.communicationConnections = action.payload.communicationConnections || { EMAIL: false, SMS: false };
                state.requiredConnections = action.payload.requiredConnections || [];
                state.isReady = action.payload.isReady || false;
            })
            .addCase(fetchOnboardingStatus.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export const { resetOnboardingError } = onboardingSlice.actions;
export default onboardingSlice.reducer;
