import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchOnboardingStatus, resetOnboardingError } from '../redux/slices/onboardingSlice';
import { initShopifyOAuth, saveConnection, initGoogleOAuth, getGoogleSpreadsheets, finalizeSheetsConnection } from '../services/api/connectorsService';
import { getPolicy, updatePolicy } from '../services/api/policyService';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { CheckCircle2, ArrowRight, Store, CreditCard, Settings, Mail, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Onboarding() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const { 
        shopifyConnected, 
        razorpayConnected, 
        agentProvisioned, 
        policyConfigured,
        selectedCommunicationChannels,
        communicationConnections,
        requiredConnections,
        isReady, 
        loading 
    } = useSelector((state) => state.onboarding);

    const [shopifyForm, setShopifyForm] = useState({ shopDomain: '', clientId: '', clientSecret: '' });
    const [razorpayForm, setRazorpayForm] = useState({ keyId: '', keySecret: '' });
    const [googleForm, setGoogleForm] = useState({ clientId: '', clientSecret: '' });
    
    const [policyForm, setPolicyForm] = useState({
        checkoutAbandonmentEnabled: true,
        paymentFailureEnabled: true,
        maxDiscountPercentage: 20,
        recoveryWindowHours: 48,
        dailyCommunicationLimit: 2,
        communicationChannels: []
    });

    const [isConnectingShopify, setIsConnectingShopify] = useState(false);
    const [isConnectingRazorpay, setIsConnectingRazorpay] = useState(false);
    const [isSavingPolicy, setIsSavingPolicy] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    
    const [showGmailDialog, setShowGmailDialog] = useState(false);
    const [showSmsDialog, setShowSmsDialog] = useState(false);
    const [showSheetsDialog, setShowSheetsDialog] = useState(false);
    
    const [spreadsheets, setSpreadsheets] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [tempAuthId, setTempAuthId] = useState('');

    useEffect(() => {
        const fetchPolicy = async () => {
            try {
                const rules = await getPolicy();
                if (rules) {
                    setPolicyForm(prev => ({
                        checkoutAbandonmentEnabled: rules.checkoutAbandonmentEnabled ?? prev.checkoutAbandonmentEnabled,
                        paymentFailureEnabled: rules.paymentFailureEnabled ?? prev.paymentFailureEnabled,
                        maxDiscountPercentage: rules.maxDiscountPercentage ?? prev.maxDiscountPercentage,
                        recoveryWindowHours: rules.recoveryWindowHours ?? prev.recoveryWindowHours,
                        dailyCommunicationLimit: rules.dailyCommunicationLimit ?? prev.dailyCommunicationLimit,
                        communicationChannels: Array.isArray(rules.communicationChannels) ? rules.communicationChannels : prev.communicationChannels
                    }));
                }
            } catch (err) {
                console.error("Failed to load policy", err);
            }
        };
        fetchPolicy();
    }, []);

    useEffect(() => {
        const shopifyStatus = searchParams.get('shopify');
        const googleStatus = searchParams.get('google');
        const tid = searchParams.get('tempAuthId');
        
        if (shopifyStatus) {
            if (shopifyStatus === 'success') toast.success('Shopify connection authorized.');
            else if (shopifyStatus === 'error') toast.error('Shopify authorization failed.');
            setSearchParams({});
            dispatch(fetchOnboardingStatus());
        }

        if (googleStatus) {
            if (googleStatus === 'success') {
                toast.success('Connection authorized.');
                dispatch(fetchOnboardingStatus());
            } else if (googleStatus === 'error') {
                toast.error('Authorization failed.');
            } else if (googleStatus === 'sheets' && tid) {
                setTempAuthId(tid);
                loadSpreadsheets(tid);
            }
            setSearchParams({});
        }
    }, [searchParams, setSearchParams, dispatch]);

    const loadSpreadsheets = async (tid) => {
        try {
            const response = await getGoogleSpreadsheets(tid);
            setSpreadsheets(response.data || []);
            setShowSheetsDialog(true);
        } catch (error) {
            toast.error('Failed to load spreadsheets');
        }
    };

    const handleShopifyConnect = async (e) => {
        e.preventDefault();
        setIsConnectingShopify(true);
        try {
            const redirectUri = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/connectors/shopify/callback`;
            const payload = { ...shopifyForm, redirectUri };
            const response = await initShopifyOAuth(payload);
            if (response.success && response.url) window.location.href = response.url;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to initialize Shopify connection');
            setIsConnectingShopify(false);
        }
    };

    const handleRazorpayConnect = async (e) => {
        e.preventDefault();
        setIsConnectingRazorpay(true);
        try {
            await saveConnection({ connectorId: 'razorpay', name: 'Razorpay', credentials: razorpayForm });
            toast.success('Razorpay connected successfully');
            setRazorpayForm({ keyId: '', keySecret: '' }); 
            dispatch(fetchOnboardingStatus());
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to connect Razorpay.');
        } finally {
            setIsConnectingRazorpay(false);
        }
    };

    const handleSavePolicy = async () => {
        setIsSavingPolicy(true);
        try {
            await updatePolicy({
                ...policyForm,
                policyConfigured: true
            });
            toast.success('Policy saved successfully');
            dispatch(fetchOnboardingStatus());
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save policy');
        } finally {
            setIsSavingPolicy(false);
        }
    };

    const handleGoogleConnect = async (e, connectorId) => {
        e.preventDefault();
        setIsGoogleLoading(true);
        try {
            const redirectUri = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/connectors/google/callback`;
            const payload = { ...googleForm, redirectUri, connectorId };
            const response = await initGoogleOAuth(payload);
            if (response.success && response.url) window.location.href = response.url;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to initialize connection');
            setIsGoogleLoading(false);
        }
    };

    const handleFinalizeSheets = async () => {
        try {
            await finalizeSheetsConnection({ tempAuthId, spreadsheetId: selectedSheet, worksheetName: 'Sheet1', channel: 'sms' });
            toast.success('SMS Provider connected successfully');
            setShowSheetsDialog(false);
            dispatch(fetchOnboardingStatus());
        } catch (error) {
            toast.error('Failed to finalize connection');
        }
    };

    const toggleChannel = (channel) => {
        setPolicyForm(prev => {
            const exists = prev.communicationChannels.includes(channel);
            const newChannels = exists 
                ? prev.communicationChannels.filter(c => c !== channel)
                : [...prev.communicationChannels, channel];
            return { ...prev, communicationChannels: newChannels };
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="w-full max-w-3xl space-y-8">
                    <Skeleton className="h-12 w-64" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    const emailSelected = policyForm.communicationChannels.includes('EMAIL');
    const smsSelected = policyForm.communicationChannels.includes('SMS');
    
    const commerceConnected = shopifyConnected && razorpayConnected;
    
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-red-500/30 pb-20">
            <div className="max-w-3xl mx-auto py-12 px-6">
                
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Recover<span className="text-red-600">OS</span></h1>
                    <h2 className="text-2xl font-semibold mb-2">Welcome to your Dashboard Setup</h2>
                    <p className="text-slate-500">
                        Connect systems and configure policies to activate the Revenue Recovery Agent.
                    </p>
                </div>

                {/* Progress summary */}
                <div className="flex items-center gap-4 mb-8 text-sm font-medium">
                    <span className={`flex items-center gap-2 ${commerceConnected ? 'text-green-600' : 'text-slate-500'}`}>
                        {commerceConnected ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                        1. Integrations
                    </span>
                    <Separator className="flex-1" />
                    <span className={`flex items-center gap-2 ${policyConfigured ? 'text-green-600' : 'text-slate-500'}`}>
                        {policyConfigured ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                        2. Policy
                    </span>
                    <Separator className="flex-1" />
                    <span className={`flex items-center gap-2 ${isReady ? 'text-green-600' : 'text-slate-500'}`}>
                        {isReady ? <CheckCircle2 className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                        3. Ready
                    </span>
                </div>

                <div className="space-y-6">
                    
                    {/* Commerce Integrations */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold border-b pb-2">Commerce Integrations</h3>
                        {/* Shopify */}
                        <Card>
                            <CardHeader className="flex flex-row items-start justify-between pb-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-xl">
                                        <Store className="w-5 h-5 text-slate-500" /> Shopify
                                    </CardTitle>
                                    <CardDescription className="mt-1.5">Checkout Abandonment</CardDescription>
                                </div>
                                {shopifyConnected && <Badge variant="secondary" className="bg-green-100 text-green-700 border-none">✓ Connected</Badge>}
                            </CardHeader>
                            {!shopifyConnected && (
                                <form onSubmit={handleShopifyConnect}>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="shopDomain">Store domain</Label>
                                            <Input id="shopDomain" placeholder="merchant.myshopify.com" value={shopifyForm.shopDomain} onChange={(e) => setShopifyForm({...shopifyForm, shopDomain: e.target.value})} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="clientId">Client ID</Label>
                                            <Input id="clientId" value={shopifyForm.clientId} onChange={(e) => setShopifyForm({...shopifyForm, clientId: e.target.value})} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="clientSecret">Client Secret</Label>
                                            <Input id="clientSecret" type="password" value={shopifyForm.clientSecret} onChange={(e) => setShopifyForm({...shopifyForm, clientSecret: e.target.value})} required />
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="submit" disabled={isConnectingShopify} className="bg-slate-900 hover:bg-slate-800 text-white">
                                            {isConnectingShopify ? 'Connecting...' : 'Connect Shopify'}
                                        </Button>
                                    </CardFooter>
                                </form>
                            )}
                        </Card>

                        {/* Razorpay */}
                        <Card>
                            <CardHeader className="flex flex-row items-start justify-between pb-4">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-xl">
                                        <CreditCard className="w-5 h-5 text-slate-500" /> Razorpay
                                    </CardTitle>
                                    <CardDescription className="mt-1.5">Payment Recovery</CardDescription>
                                </div>
                                {razorpayConnected && <Badge variant="secondary" className="bg-green-100 text-green-700 border-none">✓ Connected</Badge>}
                            </CardHeader>
                            {!razorpayConnected && (
                                <form onSubmit={handleRazorpayConnect}>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="keyId">Key ID</Label>
                                            <Input id="keyId" value={razorpayForm.keyId} onChange={(e) => setRazorpayForm({...razorpayForm, keyId: e.target.value})} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="keySecret">Key Secret</Label>
                                            <Input id="keySecret" type="password" value={razorpayForm.keySecret} onChange={(e) => setRazorpayForm({...razorpayForm, keySecret: e.target.value})} required />
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button type="submit" disabled={isConnectingRazorpay} className="bg-slate-900 hover:bg-slate-800 text-white">
                                            {isConnectingRazorpay ? 'Connecting...' : 'Connect Razorpay'}
                                        </Button>
                                    </CardFooter>
                                </form>
                            )}
                        </Card>
                    </div>

                    {commerceConnected && (
                        <>
                            {/* Recovery Policy */}
                            <div className="space-y-6 pt-6">
                                <h3 className="text-lg font-semibold border-b pb-2">Recovery Policy</h3>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Settings className="w-5 h-5 text-slate-500" /> Policy Configuration
                                        </CardTitle>
                                        <CardDescription>Configure how RecoverOS should recover at-risk revenue.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>Checkout Abandonment</Label>
                                                <p className="text-sm text-slate-500">Automatically recover abandoned checkouts</p>
                                            </div>
                                            <Switch checked={policyForm.checkoutAbandonmentEnabled} onCheckedChange={(v) => setPolicyForm({...policyForm, checkoutAbandonmentEnabled: v})} />
                                        </div>
                                        <Separator />
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label>Payment Failure</Label>
                                                <p className="text-sm text-slate-500">Automatically recover failed payments</p>
                                            </div>
                                            <Switch checked={policyForm.paymentFailureEnabled} onCheckedChange={(v) => setPolicyForm({...policyForm, paymentFailureEnabled: v})} />
                                        </div>
                                        <Separator />
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Maximum Discount (%)</Label>
                                                <Input type="number" min="0" max="100" value={policyForm.maxDiscountPercentage} onChange={(e) => setPolicyForm({...policyForm, maxDiscountPercentage: e.target.value})} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Recovery Window (hours)</Label>
                                                <Input type="number" min="1" max="720" value={policyForm.recoveryWindowHours} onChange={(e) => setPolicyForm({...policyForm, recoveryWindowHours: e.target.value})} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Daily Communication Limit</Label>
                                                <Input type="number" min="0" max="10" value={policyForm.dailyCommunicationLimit} onChange={(e) => setPolicyForm({...policyForm, dailyCommunicationLimit: e.target.value})} />
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button onClick={handleSavePolicy} disabled={isSavingPolicy} className="bg-slate-900 hover:bg-slate-800 text-white">
                                            {isSavingPolicy ? 'Saving...' : 'Save Policy'}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>

                            {/* Communication Channels */}
                            <div className="space-y-6 pt-6">
                                <h3 className="text-lg font-semibold border-b pb-2">Communication Channels</h3>
                                <p className="text-sm text-slate-500">Choose how RecoverOS can contact customers during recovery.</p>
                                
                                {/* Email Channel */}
                                <Card className={emailSelected ? "border-slate-300" : "opacity-80"}>
                                    <CardHeader className="flex flex-row items-start justify-between pb-4">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-xl">
                                                <Mail className="w-5 h-5 text-slate-500" /> Email
                                            </CardTitle>
                                            <CardDescription className="mt-1.5">Recovery emails and follow-ups</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium">{emailSelected ? 'Enabled' : 'Disabled'}</span>
                                            <Switch checked={emailSelected} onCheckedChange={() => toggleChannel('EMAIL')} />
                                        </div>
                                    </CardHeader>
                                    {emailSelected && (
                                        <CardContent>
                                            <div className="p-4 bg-slate-50 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-medium">Gmail</p>
                                                    {communicationConnections.EMAIL ? (
                                                        <p className="text-sm text-green-600 flex items-center gap-1 mt-1"><CheckCircle2 className="w-4 h-4"/> Connected</p>
                                                    ) : (
                                                        <p className="text-sm text-slate-500 mt-1">Connect Gmail to send recovery emails.</p>
                                                    )}
                                                </div>
                                                {!communicationConnections.EMAIL ? (
                                                    <Button variant="outline" onClick={() => setShowGmailDialog(true)}>Connect Gmail</Button>
                                                ) : (
                                                    <Button variant="outline" disabled>Manage</Button>
                                                )}
                                            </div>
                                            {!communicationConnections.EMAIL && (
                                                <p className="text-xs text-red-500 mt-3 font-medium">⚠️ Gmail connection is required to complete onboarding.</p>
                                            )}
                                        </CardContent>
                                    )}
                                </Card>

                                {/* SMS Channel */}
                                <Card className={smsSelected ? "border-slate-300" : "opacity-80"}>
                                    <CardHeader className="flex flex-row items-start justify-between pb-4">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-xl">
                                                <MessageSquare className="w-5 h-5 text-slate-500" /> SMS
                                            </CardTitle>
                                            <CardDescription className="mt-1.5">Recovery messages via SMS</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium">{smsSelected ? 'Enabled' : 'Disabled'}</span>
                                            <Switch checked={smsSelected} onCheckedChange={() => toggleChannel('SMS')} />
                                        </div>
                                    </CardHeader>
                                    {smsSelected && (
                                        <CardContent>
                                            <div className="p-4 bg-slate-50 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div>
                                                    <p className="font-medium">SMS Provider</p>
                                                    {communicationConnections.SMS ? (
                                                        <p className="text-sm text-green-600 flex items-center gap-1 mt-1"><CheckCircle2 className="w-4 h-4"/> Connected</p>
                                                    ) : (
                                                        <p className="text-sm text-slate-500 mt-1">Connect your messaging provider to enable SMS recovery.</p>
                                                    )}
                                                </div>
                                                {!communicationConnections.SMS ? (
                                                    <Button variant="outline" onClick={() => setShowSmsDialog(true)}>Connect</Button>
                                                ) : (
                                                    <Button variant="outline" disabled>Manage</Button>
                                                )}
                                            </div>
                                            {!communicationConnections.SMS && (
                                                <p className="text-xs text-red-500 mt-3 font-medium">⚠️ SMS provider connection is required to complete onboarding.</p>
                                            )}
                                        </CardContent>
                                    )}
                                </Card>

                            </div>
                        </>
                    )}

                    {/* Completion Alert */}
                    {isReady && (
                        <Alert className="border-green-200 bg-green-50/50 mt-10">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <AlertTitle className="text-green-800 font-semibold text-lg ml-2">You're ready</AlertTitle>
                            <AlertDescription className="text-green-700 mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ml-2">
                                <div>
                                    <p className="font-medium flex items-center gap-2 mb-2">
                                        Revenue Recovery Agent <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-xs font-bold text-green-700 uppercase ml-1">• Active</span>
                                    </p>
                                    <ul className="text-sm space-y-0.5 list-disc list-inside text-green-700/80">
                                        <li>Shopify & Razorpay connected</li>
                                        <li>Recovery policy configured</li>
                                        <li>Communication integrations verified</li>
                                    </ul>
                                </div>
                                <Button onClick={() => navigate('/dashboard')} className="shrink-0 bg-green-600 hover:bg-green-700 text-white">
                                    Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}

                </div>
            </div>

            {/* Gmail OAuth Dialog */}
            <Dialog open={showGmailDialog} onOpenChange={setShowGmailDialog}>
                <DialogContent>
                    <form onSubmit={(e) => handleGoogleConnect(e, 'gmail')}>
                        <DialogHeader>
                            <DialogTitle>Connect Gmail</DialogTitle>
                            <DialogDescription>Enter your Google OAuth credentials to authorize email sending.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Client ID</Label>
                                <Input value={googleForm.clientId} onChange={e => setGoogleForm({...googleForm, clientId: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Client Secret</Label>
                                <Input type="password" value={googleForm.clientSecret} onChange={e => setGoogleForm({...googleForm, clientSecret: e.target.value})} required />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowGmailDialog(false)}>Cancel</Button>
                            <Button type="submit" disabled={isGoogleLoading}>{isGoogleLoading ? 'Connecting...' : 'Authorize'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* SMS Provider (Google Sheets) Dialog */}
            <Dialog open={showSmsDialog} onOpenChange={setShowSmsDialog}>
                <DialogContent>
                    <form onSubmit={(e) => handleGoogleConnect(e, 'google_sheets')}>
                        <DialogHeader>
                            <DialogTitle>Connect SMS Provider</DialogTitle>
                            <DialogDescription>Authorize your provider credentials to enable SMS recovery.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Client ID</Label>
                                <Input value={googleForm.clientId} onChange={e => setGoogleForm({...googleForm, clientId: e.target.value})} required />
                            </div>
                            <div className="space-y-2">
                                <Label>Client Secret</Label>
                                <Input type="password" value={googleForm.clientSecret} onChange={e => setGoogleForm({...googleForm, clientSecret: e.target.value})} required />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowSmsDialog(false)}>Cancel</Button>
                            <Button type="submit" disabled={isGoogleLoading}>{isGoogleLoading ? 'Connecting...' : 'Authorize'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* SMS Provider Finalization Dialog */}
            <Dialog open={showSheetsDialog} onOpenChange={setShowSheetsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Select Data Source</DialogTitle>
                        <DialogDescription>Choose the resource to link with your SMS Provider.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a resource..." />
                            </SelectTrigger>
                            <SelectContent>
                                {spreadsheets.map(sheet => (
                                    <SelectItem key={sheet.id} value={sheet.id}>{sheet.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setShowSheetsDialog(false)}>Cancel</Button>
                        <Button type="button" onClick={handleFinalizeSheets} disabled={!selectedSheet}>Finalize Connection</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
