'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Merchant {
  id: string;
  canonical_name: string;
  primary_category: string;
  aliases: string[];
}

export default function Home() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
    };

    checkAuth();
  }, [router, supabase]);

  // Search merchants
  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setMerchants([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/merchants/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (response.ok) {
        setMerchants(data.data || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMerchant = (merchantId: string) => {
    router.push(`/recommend/${merchantId}`);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Credit Card Advisor</h1>
          <div className="flex gap-2">
            <Link href="/wallet" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Wallet
            </Link>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-gray-600 hover:text-gray-700 text-sm font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Which card should you use?
          </h2>
          <p className="text-gray-600 mb-6">
            Search for a merchant to see which of your cards earns the most rewards.
          </p>

          {/* Search input */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search merchants... (Whole Foods, Starbucks, etc.)"
              className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            {loading && (
              <div className="absolute right-3 top-3">
                <div className="animate-spin h-5 w-5 text-blue-600">
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search results */}
        {merchants.length > 0 && (
          <div className="space-y-2">
            {merchants.map((merchant) => (
              <button
                key={merchant.id}
                onClick={() => handleSelectMerchant(merchant.id)}
                className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="font-semibold text-gray-900">{merchant.canonical_name}</div>
                <div className="text-sm text-gray-500 mt-1">{merchant.primary_category.replace(/_/g, ' ')}</div>
                {merchant.aliases.length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    Also known as: {merchant.aliases.slice(0, 2).join(', ')}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {searchQuery && !loading && merchants.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No merchants found for "{searchQuery}". Try a different search.
          </div>
        )}
      </main>
    </div>
  );
}
