import { configureStore } from "@reduxjs/toolkit"
import authReducer from "./slices/authSlice";
import onboardingReducer from "./slices/onboardingSlice";

const store = configureStore({
    reducer: {
        auth: authReducer,
        onboarding: onboardingReducer,
    },
})

export default store;
