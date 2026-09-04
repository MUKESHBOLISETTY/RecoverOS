import React, { useState, useEffect } from 'react';
import { getPolicy, updatePolicy } from '../services/api/policyService';
import { Shield, Mail, MessageSquare, Zap, User, Search, RefreshCw, Smartphone, CreditCard, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('policy');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [policy, setPolicy] = useState({
        checkoutAbandonmentEnabled: true,
        paymentFailureEnabled: true,
        maxDiscountPercentage: 0,
        recoveryWindowHours: 48,
        dailyCommunicationLimit: 2,
        communicationChannels: ['EMAIL']
    });

    const [integrations, setIntegrations] = useState({
        shopify: { connected: true, identifier: 'merchant-store.myshopify.com' },
        razorpay: { connected: true, identifier: 'rzp_live_xxxxxxxx' },
        gmail: { connected: true, identifier: 'recovery@merchant.com' },
        sms: { connected: true, identifier: 'SMS Provider' }
    });

    useEffect(() => {
        const fetchPolicy = async () => {
            try {
                setLoading(true);
                const data = await getPolicy();
                
                setPolicy({
                    checkoutAbandonmentEnabled: data.checkoutAbandonmentEnabled ?? true,
                    paymentFailureEnabled: data.paymentFailureEnabled ?? true,
                    maxDiscountPercentage: data.maxDiscountPercentage || 0,
                    recoveryWindowHours: data.recoveryWindowHours || 48,
                    dailyCommunicationLimit: data.dailyCommunicationLimit ?? 2,
                    communicationChannels: data.communicationChannels || ['EMAIL']
                });
            } catch (error) {
                toast.error('Failed to load merchant policy');
            } finally {
                setLoading(false);
            }
        };
        fetchPolicy();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setPolicy(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSwitchChange = (name, checked) => {
        setPolicy(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleChannelToggle = (channel) => {
        setPolicy(prev => {
            const channels = prev.communicationChannels || [];
            if (channels.includes(channel)) {
                return { ...prev, communicationChannels: channels.filter(c => c !== channel) };
            } else {
                return { ...prev, communicationChannels: [...channels, channel] };
            }
        });
    };

    const handleSavePolicy = async () => {
        try {
            setSaving(true);
            const updates = {
                checkoutAbandonmentEnabled: Boolean(policy.checkoutAbandonmentEnabled),
                paymentFailureEnabled: Boolean(policy.paymentFailureEnabled),
                maxDiscountPercentage: Number(policy.maxDiscountPercentage),
                recoveryWindowHours: Number(policy.recoveryWindowHours),
                dailyCommunicationLimit: Number(policy.dailyCommunicationLimit),
                communicationChannels: policy.communicationChannels
            };
            const updated = await updatePolicy(updates);
            setPolicy(updated); // Sync with backend authoritative state
            toast.success('Policy updated successfully');
        } catch (error) {
            toast.error(error?.response?.data?.message || 'Failed to update policy');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'policy', label: 'Recovery Policy', icon: <Shield className="w-4 h-4" /> },
        { id: 'communication', label: 'Communication', icon: <Mail className="w-4 h-4" /> },
        { id: 'integrations', label: 'Integrations', icon: <Zap className="w-4 h-4" /> },
        { id: 'agent', label: 'Agent', icon: <RefreshCw className="w-4 h-4" /> },
        { id: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
    ];

    if (loading) {
        return (
            <div className="space-y-6 max-w-5xl">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="w-full md:w-64 shrink-0 space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                    <div className="flex-1">
                        <Skeleton className="h-[400px] w-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
                <p className="text-slate-500 mt-1">Configure how RecoverOS works for your business.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Vertical Navigation */}
                <nav className="w-full md:w-56 shrink-0 flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    
                    {/* RECOVERY POLICY TAB */}
                    {activeTab === 'policy' && (
                        <div className="space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Recovery Policy</CardTitle>
                                    <CardDescription>Control how RecoverOS can intervene when revenue is at risk.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-medium">Checkout Abandonment</Label>
                                                <p className="text-sm text-slate-500">Automatically recover abandoned checkouts.</p>
                                            </div>
                                            <Switch 
                                                checked={policy.checkoutAbandonmentEnabled} 
                                                onCheckedChange={(checked) => handleSwitchChange('checkoutAbandonmentEnabled', checked)} 
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base font-medium">Payment Failure</Label>
                                                <p className="text-sm text-slate-500">Automatically recover failed payments.</p>
                                            </div>
                                            <Switch 
                                                checked={policy.paymentFailureEnabled} 
                                                onCheckedChange={(checked) => handleSwitchChange('paymentFailureEnabled', checked)} 
                                            />
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-6 max-w-md">
                                        <div className="space-y-2">
                                            <Label htmlFor="maxDiscount">Maximum Discount (%)</Label>
                                            <Input 
                                                id="maxDiscount"
                                                name="maxDiscountPercentage"
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={policy.maxDiscountPercentage}
                                                onChange={handleChange}
                                            />
                                            <p className="text-xs text-slate-500">The maximum discount RecoverOS can autonomously offer.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="recoveryWindow">Recovery Window (Hours)</Label>
                                            <Input 
                                                id="recoveryWindow"
                                                name="recoveryWindowHours"
                                                type="number"
                                                min="1"
                                                max="720"
                                                value={policy.recoveryWindowHours}
                                                onChange={handleChange}
                                            />
                                            <p className="text-xs text-slate-500">How long RecoverOS may continue recovery attempts for a case.</p>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="dailyLimit">Daily Communication Limit</Label>
                                            <Input 
                                                id="dailyLimit"
                                                name="dailyCommunicationLimit"
                                                type="number"
                                                min="0"
                                                max="10"
                                                value={policy.dailyCommunicationLimit}
                                                onChange={handleChange}
                                            />
                                            <p className="text-xs text-slate-500">Maximum customer communications RecoverOS can send per day.</p>
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <Button onClick={handleSavePolicy} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800">
                                            {saving ? 'Saving...' : 'Save Policy'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* COMMUNICATION TAB */}
                    {activeTab === 'communication' && (
                        <div className="space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Communication Channels</CardTitle>
                                    <CardDescription>Choose which channels RecoverOS may use to contact customers.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-start justify-between p-4 border border-slate-200 rounded-lg bg-white">
                                        <div className="flex gap-4">
                                            <div className="p-2 bg-slate-50 rounded-md border border-slate-100 shrink-0 h-fit">
                                                <Mail className="w-5 h-5 text-slate-700" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-slate-900">Email</h3>
                                                <p className="text-sm text-slate-500 mt-1">Recovery messages via Email</p>
                                                
                                                {policy.communicationChannels?.includes('EMAIL') && (
                                                    <div className="mt-3 flex items-center gap-2 text-sm">
                                                        {integrations.gmail.connected ? (
                                                            <span className="text-emerald-600 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connected to {integrations.gmail.identifier}</span>
                                                        ) : (
                                                            <span className="text-orange-600 font-medium">Gmail connection required</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Switch 
                                            checked={policy.communicationChannels?.includes('EMAIL') || false} 
                                            onCheckedChange={() => handleChannelToggle('EMAIL')} 
                                        />
                                    </div>

                                    <div className="flex items-start justify-between p-4 border border-slate-200 rounded-lg bg-white">
                                        <div className="flex gap-4">
                                            <div className="p-2 bg-slate-50 rounded-md border border-slate-100 shrink-0 h-fit">
                                                <Smartphone className="w-5 h-5 text-slate-700" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-slate-900">SMS</h3>
                                                <p className="text-sm text-slate-500 mt-1">Recovery messages via SMS</p>
                                                
                                                {policy.communicationChannels?.includes('SMS') && (
                                                    <div className="mt-3 flex items-center gap-2 text-sm">
                                                        {integrations.sms.connected ? (
                                                            <span className="text-emerald-600 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connected to {integrations.sms.identifier}</span>
                                                        ) : (
                                                            <span className="text-orange-600 font-medium">SMS Provider connection required</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Switch 
                                            checked={policy.communicationChannels?.includes('SMS') || false} 
                                            onCheckedChange={() => handleChannelToggle('SMS')} 
                                        />
                                    </div>
                                    
                                    <div className="pt-4">
                                        <Button onClick={handleSavePolicy} disabled={saving} className="bg-slate-900 text-white hover:bg-slate-800">
                                            {saving ? 'Saving...' : 'Save Channels'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* INTEGRATIONS TAB */}
                    {activeTab === 'integrations' && (
                        <div className="space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Integrations</CardTitle>
                                    <CardDescription>Manage connections to external services and platforms.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Shopify */}
                                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-slate-50 rounded-md border border-slate-100 shrink-0">
                                                <ShoppingCart className="w-6 h-6 text-slate-700" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-slate-900">Shopify</h3>
                                                <p className="text-sm text-slate-500">Checkout Abandonment</p>
                                                <div className="text-xs font-medium text-emerald-600 mt-1">✓ Connected • {integrations.shopify.identifier}</div>
                                            </div>
                                        </div>
                                        <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">Manage</Button>
                                    </div>

                                    {/* Razorpay */}
                                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-slate-50 rounded-md border border-slate-100 shrink-0">
                                                <CreditCard className="w-6 h-6 text-slate-700" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-slate-900">Razorpay</h3>
                                                <p className="text-sm text-slate-500">Payment Recovery</p>
                                                <div className="text-xs font-medium text-emerald-600 mt-1">✓ Connected • {integrations.razorpay.identifier}</div>
                                            </div>
                                        </div>
                                        <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">Manage</Button>
                                    </div>

                                    {/* Gmail */}
                                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-slate-50 rounded-md border border-slate-100 shrink-0">
                                                <Mail className="w-6 h-6 text-slate-700" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-slate-900">Gmail</h3>
                                                <p className="text-sm text-slate-500">Email Recovery</p>
                                                {integrations.gmail.connected ? (
                                                    <div className="text-xs font-medium text-emerald-600 mt-1">✓ Connected • {integrations.gmail.identifier}</div>
                                                ) : (
                                                    <div className="text-xs font-medium text-slate-500 mt-1">Not connected</div>
                                                )}
                                            </div>
                                        </div>
                                        <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
                                            {integrations.gmail.connected ? 'Manage' : 'Connect'}
                                        </Button>
                                    </div>

                                    {/* SMS Provider */}
                                    <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-slate-50 rounded-md border border-slate-100 shrink-0">
                                                <Smartphone className="w-6 h-6 text-slate-700" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-slate-900">SMS Provider</h3>
                                                <p className="text-sm text-slate-500">SMS Recovery</p>
                                                {integrations.sms.connected ? (
                                                    <div className="text-xs font-medium text-emerald-600 mt-1">✓ Connected • {integrations.sms.identifier}</div>
                                                ) : (
                                                    <div className="text-xs font-medium text-slate-500 mt-1">Not connected</div>
                                                )}
                                            </div>
                                        </div>
                                        <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50">
                                            {integrations.sms.connected ? 'Manage' : 'Connect'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* AGENT TAB */}
                    {activeTab === 'agent' && (
                        <div className="space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>System Agent Status</CardTitle>
                                    <CardDescription>View the status of your autonomous recovery agent.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 flex h-3 w-3 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">Revenue Recovery Agent</h3>
                                            <p className="text-sm font-medium text-emerald-600 mt-1 mb-3">Active • RecoverOS is monitoring eligible revenue-risk events.</p>
                                            <p className="text-sm text-slate-600">Automatically detects revenue at risk and executes bounded recovery workflows based on your configured policy constraints.</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                        <h4 className="font-medium text-slate-900 mb-3 text-sm">Capabilities</h4>
                                        <ul className="space-y-2 text-sm text-slate-600">
                                            <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Checkout Abandonment Recovery</li>
                                            <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Payment Failure Recovery</li>
                                        </ul>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* ACCOUNT TAB */}
                    {activeTab === 'account' && (
                        <div className="space-y-6">
                            <Card className="shadow-sm border-slate-200">
                                <CardHeader>
                                    <CardTitle>Account Information</CardTitle>
                                    <CardDescription>Your RecoverOS merchant details.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 max-w-md">
                                    <div className="space-y-2">
                                        <Label>Email</Label>
                                        <Input disabled value="merchant@example.com" className="bg-slate-50" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Business Name</Label>
                                        <Input disabled value="Demo Store Inc" className="bg-slate-50" />
                                    </div>
                                    <p className="text-xs text-slate-500">Contact support to modify primary account details.</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
