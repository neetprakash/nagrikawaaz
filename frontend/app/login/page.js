'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, setToken, setStoredUser } from '../../lib/api';

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // phone | otp
  const [demoOtp, setDemoOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.sendOtp(phone);
      if (res.otp) setDemoOtp(res.otp); // DEMO_MODE only
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verify(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.verifyOtp(phone, code);
      setToken(res.token);
      setStoredUser(res.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto card">
      <h1 className="text-xl font-bold text-navy mb-1">Login</h1>
      <p className="text-sm text-gray-600 mb-4">Verified with OTP on your registered phone number.</p>

      {step === 'phone' && (
        <form onSubmit={sendOtp} className="space-y-3">
          <input
            className="input"
            required
            pattern="[0-9]{10}"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Sending…' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form onSubmit={verify} className="space-y-3">
          {demoOtp && (
            <p className="text-xs bg-yellow-50 text-yellow-800 rounded-lg p-2">
              DEMO_MODE: your OTP is <b>{demoOtp}</b> (no real SMS was sent)
            </p>
          )}
          <input
            className="input"
            required
            placeholder="6-digit OTP"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button className="btn-primary w-full" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify & Login'}
          </button>
          <button type="button" className="text-sm text-gray-500 underline" onClick={() => setStep('phone')}>
            Change phone number
          </button>
        </form>
      )}
    </div>
  );
}
