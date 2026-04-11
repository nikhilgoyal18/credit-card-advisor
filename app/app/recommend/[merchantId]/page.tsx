'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Recommendation {
  card_id: string;
  effective_rate: number;
  earn_type: 'cashback_percent' | 'points_multiplier';
  explanation: string;
  caveats: string[];
  last_verified_at: string;
  recommendation_type: string;
}

interface RecommendationResponse {
  data: Recommendation[];
  merchant: {
    id: string;
    canonical_name: string;
    primary_category: string;
  };
  disclaimer: string;
}

export default function RecommendPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const merchantId = params.merchantId as string;

  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        // Check auth first
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch recommendations
        const response = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ merchant_id: merchantId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to get recommendations');
          return;
        }

        const data = await response.json();
        setRecommendations(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setError('An error occurred while fetching recommendations');
      } finally {
        setLoading(false);
      }
    };

    if (merchantId) {
      fetchRecommendations();
    }
  }, [merchantId, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4">
            <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p>Loading recommendations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <h2 className="font-bold mb-2">Error</h2>
          <p>{error}</p>
        </div>
        <Link href="/" className="mt-6 text-blue-600 hover:underline">
          Back to search
        </Link>
      </div>
    );
  }

  if (!recommendations) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <p>No recommendations available</p>
        <Link href="/" className="mt-4 text-blue-600 hover:underline">
          Back to search
        </Link>
      </div>
    );
  }

  const { data, merchant, disclaimer } = recommendations;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1">{merchant.canonical_name}</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        {data.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">You haven't added any cards to your wallet yet.</p>
            <Link href="/wallet" className="text-blue-600 hover:underline font-medium">
              Add cards to your wallet
            </Link>
          </div>
        ) : (
          <>
            {/* Top recommendation (highlighted) */}
            {data.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Best Card
                </h2>
                <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {data[0].effective_rate}
                    {data[0].earn_type === 'cashback_percent' ? '%' : 'x'}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 mb-2">
                    {/* Extract card name from explanation */}
                    {data[0].explanation.split(' earns ')[0]}
                  </div>
                  <p className="text-gray-700 text-sm mb-3">{data[0].explanation}</p>
                  {data[0].caveats.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                      {data[0].caveats.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Other recommendations */}
            {data.length > 1 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Other Cards
                </h2>
                <div className="space-y-2">
                  {data.slice(1).map((rec) => (
                    <div key={rec.card_id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-semibold text-gray-900">
                          {rec.explanation.split(' earns ')[0]}
                        </div>
                        <div className="text-lg font-bold text-gray-700">
                          {rec.effective_rate}
                          {rec.earn_type === 'cashback_percent' ? '%' : 'x'}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{rec.explanation}</p>
                      {rec.caveats.length > 0 && (
                        <div className="text-xs text-yellow-700 mt-2">
                          Note: {rec.caveats.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata and disclaimer */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-4">
                Category: {merchant.primary_category.replace(/_/g, ' ')}{' '}
                • Last verified: {new Date(data[0]?.last_verified_at).toLocaleDateString()}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-800">
                {disclaimer}
              </div>
            </div>
          </>
        )}

        {/* Navigation footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 flex gap-4">
          <Link href="/" className="flex-1 text-center py-2 text-blue-600 hover:text-blue-700 font-medium">
            Search again
          </Link>
          <Link
            href="/wallet"
            className="flex-1 text-center py-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            Manage wallet
          </Link>
        </div>
      </main>
    </div>
  );
}
