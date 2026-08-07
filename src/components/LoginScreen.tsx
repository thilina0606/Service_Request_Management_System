import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, User as UserIcon, Lock, Mail, Sparkles, AlertCircle, Package, ArrowRight, CheckCircle2, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { UserRole } from '../types';
import workshopBg from '../assets/images/workshop_login_bg_1784718579517.jpg';

interface LoginScreenProps {
  onLoginSuccess: (token: string, user: { id: string; name: string; email: string; role: UserRole }) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');

  // Standard Login/Register state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<UserRole>('User');

  // Forgot / Reset password state
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Handle standard Login or Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!isLogin && !name) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin 
        ? { email, password } 
        : { name, email, password, role: registerRole };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred. Please try again.');
      }

      if (isLogin) {
        setSuccess('Success! Logging you in...');
        setTimeout(() => {
          onLoginSuccess(data.token, data.user);
        }, 800);
      } else {
        setSuccess('Registration successful! Please login.');
        setIsLogin(true);
        setName('');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Password Reset Request (Step 1)
  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to request password reset code.');
      }

      setSuccess('Reset code dispatched! Check your email or Mailtrap Outbox DB.');
      setForgotStep('reset');
    } catch (err: any) {
      setError(err.message || 'Server error requested code.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Submit New Password (Step 2)
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetEmail || !resetCode || !newPassword || !confirmPassword) {
      setError('Please fill in all reset fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          token: resetCode,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password.');
      }

      setSuccess('Password reset successful! You can now log in.');
      setTimeout(() => {
        setIsForgotPassword(false);
        setIsLogin(true);
        setEmail(resetEmail);
        setPassword('');
        setResetCode('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error updating password.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    if (role === 'Admin') {
      setEmail('admin@example.com');
    } else if (role === 'Inventory Officer') {
      setEmail('officer@example.com');
    } else {
      setEmail('user@example.com');
    }
    setPassword('password123');
    setIsLogin(true);
  };

  return (
    <div id="login_container" className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans overflow-hidden select-none">
      
      {/* Background Image with Dark Atmospheric Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={workshopBg} 
          alt="Workshop Background" 
          className="w-full h-full object-cover object-center scale-105 filter brightness-90 transition-all duration-700"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] bg-gradient-to-t from-slate-950/80 via-slate-900/40 to-slate-950/70" />
      </div>

      {/* Decorative Floating Ambient Light Orbs (Apple Control Center Vibe) */}
      <div className="absolute top-1/4 left-1/3 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

      {/* Apple Control Panel Bubble Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md bg-slate-900/40 backdrop-blur-2xl backdrop-saturate-150 border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] rounded-[32px] p-6 sm:p-8 ring-1 ring-white/10"
      >
        {/* Header Header Control Bubble */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/25 shadow-xs mb-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-100">
              {isForgotPassword ? 'Password Recovery' : 'System Access'}
            </span>
          </div>

          <div className="flex items-center justify-center space-x-2.5 my-1">
            <div className="bg-gradient-to-tr from-blue-600 to-indigo-500 text-white p-2.5 rounded-2xl shadow-lg shadow-blue-500/30 border border-white/20">
              {isForgotPassword ? <KeyRound className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <span className="text-[22px] font-extrabold text-white tracking-tight drop-shadow-sm">
              {isForgotPassword ? 'Reset Password' : 'Service Request System'}
            </span>
          </div>

          <p className="text-xs font-medium text-slate-300 mt-1">
            {isForgotPassword 
              ? (forgotStep === 'request' ? 'Enter your email to receive a 6-digit reset code' : 'Enter security code & your new password')
              : (isLogin ? 'Sign in to manage service & inventory requests' : 'Create a new requester account')
            }
          </p>

          <button
            type="button"
            onClick={() => {
              if (isForgotPassword) {
                setIsForgotPassword(false);
                setError('');
                setSuccess('');
              } else {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
              }
            }}
            className="mt-3 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition backdrop-blur-md border border-white/20 shadow-xs cursor-pointer flex items-center space-x-1"
          >
            {isForgotPassword ? (
              <>
                <ArrowLeft className="h-3 w-3 opacity-70" />
                <span>Back to Sign In</span>
              </>
            ) : (
              <>
                <span>{isLogin ? 'Need an account? Register' : 'Existing user? Sign In'}</span>
                <ArrowRight className="h-3 w-3 opacity-70" />
              </>
            )}
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-red-500/20 backdrop-blur-md border border-red-500/40 p-3.5 rounded-2xl flex items-center space-x-2.5 text-red-100 text-xs font-medium shadow-sm"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-300" />
            <span>{error}</span>
          </motion.div>
        )}

        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 p-3.5 rounded-2xl flex items-center space-x-2.5 text-emerald-100 text-xs font-medium shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300 animate-bounce" />
            <span>{success}</span>
          </motion.div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {isForgotPassword ? (
          <div className="space-y-4">
            {forgotStep === 'request' ? (
              <form onSubmit={handleRequestResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-1">Account Email Address</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="e.g. user@example.com"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-medium transition-all shadow-inner"
                    />
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1.5 ml-1">
                    A 6-digit security code will be sent to this email & stored in Mailtrap Outbox.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 hover:from-blue-400 hover:to-indigo-500 active:scale-[0.98] shadow-lg shadow-blue-500/30 border border-white/20 backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Dispatching Reset Code...</span>
                      </div>
                    ) : (
                      <>
                        <span>Send Security Code</span>
                        <KeyRound className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setForgotStep('reset')}
                    className="text-xs text-blue-300 hover:text-white underline font-medium transition cursor-pointer"
                  >
                    Already have a 6-digit code? Reset now
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-1">Email Address</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      placeholder="e.g. user@example.com"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-medium transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-1">6-Digit Security Code</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      required
                      maxLength={6}
                      placeholder="e.g. 849201"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-mono tracking-widest transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-1">New Password</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-medium transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-1">Confirm New Password</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-medium transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] shadow-lg shadow-emerald-500/30 border border-white/20 backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Updating Password...</span>
                      </div>
                    ) : (
                      <>
                        <span>Confirm & Update Password</span>
                        <CheckCircle2 className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>

                <div className="flex justify-between items-center text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setForgotStep('request')}
                    className="text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    ← Resend security code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(false);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-blue-300 hover:text-white transition cursor-pointer font-semibold"
                  >
                    Return to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* STANDARD SIGN IN / REGISTER FORM */
          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-1">Full Name</label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="John Doe"
                      className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-medium transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* Role Selection Option */}
                <div>
                  <label className="block text-xs font-bold text-slate-200 uppercase tracking-wider mb-2 ml-1 flex items-center justify-between">
                    <span>Select Account Role</span>
                    <span className="text-[10px] text-blue-300 font-normal">Choose account type</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      id="btn_role_user"
                      onClick={() => setRegisterRole('User')}
                      className={`py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 backdrop-blur-md ${
                        registerRole === 'User'
                          ? 'bg-blue-600/40 border-blue-400 text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-400/50'
                          : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <UserIcon className="h-4 w-4 text-blue-300" />
                      <span>User</span>
                    </button>

                    <button
                      type="button"
                      id="btn_role_inventory"
                      onClick={() => setRegisterRole('Inventory Officer')}
                      className={`py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 backdrop-blur-md ${
                        registerRole === 'Inventory Officer'
                          ? 'bg-amber-600/40 border-amber-400 text-white shadow-lg shadow-amber-500/20 ring-2 ring-amber-400/50'
                          : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <Package className="h-4 w-4 text-amber-300" />
                      <span>Inventory</span>
                    </button>

                    <button
                      type="button"
                      id="btn_role_admin"
                      onClick={() => setRegisterRole('Admin')}
                      className={`py-2.5 px-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center space-y-1 backdrop-blur-md ${
                        registerRole === 'Admin'
                          ? 'bg-purple-600/40 border-purple-400 text-white shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/50'
                          : 'bg-white/5 border-white/15 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      <ShieldAlert className="h-4 w-4 text-purple-300" />
                      <span>Admin</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5 ml-1">Email Address</label>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-medium transition-all shadow-inner"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs font-semibold text-slate-200">Password</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setForgotStep('request');
                      setResetEmail(email || 'user@example.com');
                      setError('');
                      setSuccess('');
                    }}
                    className="text-[11px] font-semibold text-blue-300 hover:text-white transition cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative flex items-center">
                <div className="absolute left-3.5 p-1.5 rounded-xl bg-white/10 text-slate-300">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 border border-white/20 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/30 backdrop-blur-md text-sm font-medium transition-all shadow-inner"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-white bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 hover:from-blue-400 hover:to-indigo-500 active:scale-[0.98] shadow-lg shadow-blue-500/30 border border-white/20 backdrop-blur-md transition-all duration-200 cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  <>
                    <span>{isLogin ? 'Sign In to Control Center' : 'Complete Registration'}</span>
                    <Sparkles className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Quick Login Apple Control Bubbles */}
        {isLogin && (
          <div className="mt-6 pt-5 border-t border-white/15">
            <span className="block text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-3">
              Quick Role Switcher
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                id="btn_quick_user"
                onClick={() => handleQuickLogin('User')}
                className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/15 shadow-sm transition-all duration-200 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                  <UserIcon className="h-4 w-4 text-blue-300" />
                </div>
                <span className="text-[11px] font-semibold text-white tracking-tight">User</span>
              </button>

              <button
                type="button"
                id="btn_quick_officer"
                onClick={() => handleQuickLogin('Inventory Officer')}
                className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/15 shadow-sm transition-all duration-200 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/30 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                  <Package className="h-4 w-4 text-amber-300" />
                </div>
                <span className="text-[11px] font-semibold text-white tracking-tight">Inventory</span>
              </button>

              <button
                type="button"
                id="btn_quick_admin"
                onClick={() => handleQuickLogin('Admin')}
                className="group flex flex-col items-center justify-center p-3 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/15 shadow-sm transition-all duration-200 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center mb-1 group-hover:scale-110 transition">
                  <ShieldAlert className="h-4 w-4 text-purple-300" />
                </div>
                <span className="text-[11px] font-semibold text-white tracking-tight">Admin</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Rights Notice */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center">
          <p className="text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1.5">
            <span>© {new Date().getFullYear()} All Rights Reserved</span>
            <span className="text-slate-500">•</span>
            <span className="font-extrabold text-blue-300 uppercase tracking-wider">THILINATHARU</span>
          </p>
        </div>

      </motion.div>
    </div>
  );
}
