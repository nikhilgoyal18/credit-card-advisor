'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { CreditCardIcon, AlertCircleIcon } from '@/app/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-900/20 p-8">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30">
          <CreditCardIcon className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-gray-500 text-sm mt-1">Sign in to your CardAdvisor account</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
            <AlertCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="full"
          isLoading={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <div className="mt-6 text-center text-gray-600 text-sm">
        Don't have an account?{' '}
        <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-medium">
          Sign up
        </Link>
      </div>
    </div>
  );
}
