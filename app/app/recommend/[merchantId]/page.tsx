'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/app/components/Button';
import { AlertCircleIcon } from '@/app/components/icons';

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
  const searchParams = useSearchParams();
  const supabase = createClient();
  const merchantId = decodeURIComponent(params.merchantId as string);
  const isHistoric = searchParams.get('historic') === 'true';
  const osmCategory = searchParams.get('category');
  const osmName = searchParams.get('name');
  const isOsm = merchantId.startsWith('osm:');

  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null);
  const [historicDate, setHistoricDate] = useState<string | null>(null);
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

        if (isHistoric) {
          // Load the most recent stored recommendation for this user+merchant
          const [{ data: recRow, error: recError }, { data: merchant, error: merchantError }] =
            await Promise.all([
              supabase
                .from('recommendations')
                .select('effective_rate, earn_type, explanation, caveats, created_at')
                .eq('user_id', user.id)
                .eq('merchant_id', merchantId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single(),
              supabase
                .from('merchants')
                .select('id, canonical_name, primary_category')
                .eq('id', merchantId)
                .single(),
            ]);

          if (recError || !recRow || merchantError || !merchant) {
            // Fall back to fresh recommendation if no history exists
            router.replace(`/recommend/${merchantId}`);
            return;
          }

          setHistoricDate(recRow.created_at);
          setRecommendations({
            data: [
              {
                card_id: '',
                effective_rate: recRow.effective_rate,
                earn_type: recRow.earn_type,
                explanation: recRow.explanation,
                caveats: recRow.caveats ?? [],
                last_verified_at: recRow.created_at,
                recommendation_type: 'best_likely_card',
              },
            ],
            merchant: {
              id: merchant.id,
              canonical_name: merchant.canonical_name,
              primary_category: merchant.primary_category,
            },
            disclaimer:
              'Final rewards may depend on issuer terms, merchant classification, and account-specific conditions.',
          });
          return;
        }

        // Fresh recommendation — call the API (also logs to recommendations table)
        const body = isOsm && osmCategory
          ? { category: osmCategory }
          : { merchant_id: merchantId };
        const response = await fetch('/api/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
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
  }, [merchantId, isHistoric, router, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white/80 border-b border-gray-100 h-14 animate-pulse" />
        <main className="max-w-md mx-auto px-4 py-6 space-y-6">
          <div className="bg-gray-200 rounded-3xl h-48 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-24 animate-pulse" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl max-w-md flex items-start gap-3">
          <AlertCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold mb-1">Error</h2>
            <p className="text-sm">{error}</p>
          </div>
        </div>
        <Link href="/" className="mt-6 text-indigo-600 hover:text-indigo-700 font-medium">
          Back to search
        </Link>
      </div>
    );
  }

  if (!recommendations) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-slate-50">
        <p className="text-gray-600">No recommendations available</p>
        <Link href="/" className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium">
          Back to search
        </Link>
      </div>
    );
  }

  const { data, merchant, disclaimer } = recommendations;

  /** Extract raw earn rate from explanation text, e.g. "earns 3x on dining" → "3x" */
  function getRawEarnLabel(explanation: string, earnType: string): string | null {
    const match = explanation.match(/earns\s+([\d.]+)(x|%)/i);
    if (!match) return null;
    return `${match[1]}${earnType === 'cashback_percent' ? '%' : 'x'}`;
  }

  /** Split caveats into spend-limit (info) vs other (warning) */
  function splitCaveats(caveats: string[]) {
    const spendLimit = caveats.filter((c) => c.toLowerCase().includes('applies up to'));
    const other = caveats.filter((c) => !c.toLowerCase().includes('applies up to'));
    return { spendLimit, other };
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-900">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-gray-900 flex-1 truncate">{osmName ?? merchant.canonical_name}</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        {data.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">You haven't added any cards to your wallet yet.</p>
            <Link href="/wallet" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Add cards to your wallet
            </Link>
          </div>
        ) : (
          <>
            {/* OSM category notice */}
            {isOsm && osmCategory && (
              <div className="mb-5 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                <p className="text-xs text-indigo-700 leading-snug">
                  <span className="font-semibold">{osmName}</span> isn't in our merchant database yet.
                  Showing best card for <span className="font-semibold">{osmCategory.replace(/_/g, ' ').toLowerCase()}</span> — rewards may vary by exact merchant.
                </p>
              </div>
            )}

            {/* Historic view notice */}
            {isHistoric && historicDate && (
              <div className="mb-5 flex items-center justify-between gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-xs text-amber-700 leading-snug">
                  Saved from{' '}
                  <span className="font-semibold">
                    {new Date(historicDate).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  {' · '}your wallet may have changed
                </p>
                <Link
                  href={`/recommend/${merchantId}`}
                  className="flex-shrink-0 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                >
                  Refresh
                </Link>
              </div>
            )}

            {/* Top recommendation (highlighted) */}
            {data.length > 0 && (
              <div className="mb-8">
                {(() => {
                  const heroConfig =
                    data[0].earn_type === 'cashback_percent'
                      ? {
                          gradient: 'from-emerald-500 to-teal-600',
                          badgeLabel: 'Cash Back',
                        }
                      : {
                          gradient: 'from-indigo-500 to-violet-600',
                          badgeLabel: 'Points',
                        };

                  return (
                    <div
                      className={`relative rounded-3xl p-7 bg-linear-to-br ${heroConfig.gradient} text-white shadow-xl overflow-hidden`}
                    >
                      {/* Decorative circles */}
                      <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
                      <div className="absolute -bottom-10 -left-4 w-32 h-32 bg-white/10 rounded-full" />

                      <div className="relative z-10">
                        {/* Earn type badge */}
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-white/20 text-white mb-4">
                          {heroConfig.badgeLabel}
                        </span>

                        {/* Hero rate */}
                        {data[0].earn_type === 'cashback_percent' ? (
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-7xl font-black leading-none tracking-tight">
                              {data[0].effective_rate}
                            </span>
                            <span className="text-3xl font-bold opacity-90 mt-1">%</span>
                          </div>
                        ) : (
                          <div className="mb-2">
                            <div className="flex items-baseline gap-2">
                              <span className="text-7xl font-black leading-none tracking-tight">
                                {getRawEarnLabel(data[0].explanation, data[0].earn_type) ?? data[0].effective_rate}
                              </span>
                            </div>
                            <div className="text-white/70 text-sm font-medium mt-1">
                              ≈{data[0].effective_rate.toFixed(1)}% effective value
                            </div>
                          </div>
                        )}

                        {/* Card name */}
                        <div className="text-xl font-semibold text-white/95 mb-1">
                          {data[0].explanation.split(' earns ')[0]}
                        </div>

                        {/* Explanation */}
                        <p className="text-white/75 text-sm leading-relaxed">
                          {data[0].explanation}
                        </p>

                        {/* Caveats — spend limit as info (blue), others as warning */}
                        {data[0].caveats.length > 0 && (() => {
                          const { spendLimit, other } = splitCaveats(data[0].caveats);
                          return (
                            <div className="mt-4 space-y-2">
                              {spendLimit.map((c, i) => (
                                <div key={i} className="bg-blue-500/30 border border-blue-300/30 rounded-xl p-3 text-sm text-white/90">
                                  ℹ {c}
                                </div>
                              ))}
                              {other.length > 0 && (
                                <div className="bg-black/20 rounded-xl p-3 text-sm text-white/85">
                                  ⚠ {other.join(' · ')}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Other recommendations */}
            {data.length > 1 && (
              <div>
                <h2 className="section-label">Ranked Cards</h2>
                <div className="space-y-2">
                  {data.slice(1).map((rec, index) => (
                    <div
                      key={rec.card_id}
                      className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
                    >
                      {/* Rank number */}
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-gray-500">
                        {index + 2}
                      </div>

                      {/* Card info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 text-sm truncate">
                          {rec.explanation.split(' earns ')[0]}
                        </div>
                        {(() => {
                          const { spendLimit, other } = splitCaveats(rec.caveats);
                          return (
                            <>
                              {spendLimit.map((c, i) => (
                                <div key={i} className="text-xs text-blue-600 mt-0.5">ℹ {c}</div>
                              ))}
                              {other.length > 0 && (
                                <div className="text-xs text-amber-600 mt-0.5">⚠ {other[0]}</div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Rate badge */}
                      <div
                        className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-bold text-sm text-center ${
                          rec.earn_type === 'cashback_percent'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {rec.earn_type === 'cashback_percent' ? (
                          <>{rec.effective_rate}%</>
                        ) : (
                          <div>
                            <div>{getRawEarnLabel(rec.explanation, rec.earn_type) ?? `${rec.effective_rate}x`}</div>
                            <div className="text-[10px] font-normal opacity-70">≈{rec.effective_rate.toFixed(1)}%</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata and disclaimer */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-4">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium mr-2">
                  {merchant.primary_category.replace(/_/g, ' ')}
                </span>
                Last verified: {new Date(data[0]?.last_verified_at).toLocaleDateString()}
              </div>
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-900/70 leading-relaxed">
                {disclaimer}
              </div>
            </div>
          </>
        )}

        {/* Navigation footer */}
        <div className="mt-8 flex gap-3">
          <Button variant="secondary" size="full" as={Link} href="/">
            Search Again
          </Button>
          <Button variant="ghost" size="full" as={Link} href="/wallet">
            My Wallet
          </Button>
        </div>
      </main>
    </div>
  );
}
