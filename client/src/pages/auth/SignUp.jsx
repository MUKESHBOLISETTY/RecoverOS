import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../../services/api/authService';

const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate()
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = await register(email, password);
            if (data.success) {
                localStorage.setItem('token', data.data.token);
                navigate('/');
            } else {
                alert(data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('An error occurred during registration');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f8fb] px-4 sm:px-6 lg:px-8 font-sans">
            <div className="max-w-md w-full bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-gray-100 p-8 lg:p-10">

                <div className="flex flex-col items-center mb-8">
                    <div className="text-3xl font-bold text-[#02042b] tracking-tighter mb-3">
                        RecoverOS
                    </div>
                    <h2 className="text-xl font-semibold text-gray-800">
                        Sign up for the Dashboard
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3385ff] focus:border-[#3385ff] transition-colors shadow-sm"
                            placeholder="name@company.com"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                Password
                            </label>
                        </div>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3385ff] focus:border-[#3385ff] transition-colors shadow-sm"
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#02042b] hover:bg-[#0f113a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#02042b] transition-all"
                    >
                        Sign Up
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-sm text-gray-600">
                        Already have an account?{' '}
                        <a onClick={() => navigate("/login")} className="font-medium text-[#3385ff] hover:text-blue-700 transition-colors cursor-pointer">
                            Login
                        </a>
                    </p>
                </div>

            </div>
        </div>
    );
};

export default SignUp;
