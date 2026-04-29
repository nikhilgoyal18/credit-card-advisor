'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/app/components/Button';
import { Input } from '@/app/components/Input';
import { Spinner } from '@/app/components/Spinner';
import { SearchIcon, ChevronRightIcon } from '@/app/components/icons';
import { LocationBanner } from '@/app/components/LocationBanner';
import { LastVisitedBanner } from '@/app/components/LastVisitedBanner';
import type { MerchantResult, NearbyMerchantResult, RecentVisit } from '@/lib/validation/schemas';
import type { User } from '@supabase/supabase-js';

export default function Home() {
const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [merchants, setMerchants] = useState<MerchantResult[]>([]);
  const [loading, setLoading] = useState(false);

  type LocationState = 'idle' | 'requesting' | 'loading' | 'done' | 'no_match' | 'timed_out' | 'error' | 'dismissed';
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [nearbyMerchants, setNearbyMerchants] = useState<NearbyMerchantResult[]>([]);
  const [recentVisits, setRecentVisits] = useState<RecentVisit[]>([]);
  const [recentBannerDismissed, setRecentBannerDismissed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const RADIUS_OPTIONS = [
    { label: 'Here',         value: 200,   hint: '~200m'  },
    { label: 'Walking',      value: 1000,  hint: '~1km'   },
    { label: 'Driving',      value: 5000,  hint: '~5km'   },
    { label: 'Area',         value: 20000, hint: '~20km'  },
  ] as const;
  type RadiusValue = typeof RADIUS_OPTIONS[number]['value'];
  const [selectedRadius, setSelectedRadius] = useState<RadiusValue>(200);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Check auth on mount; also restore any saved nearby merchants from this session.
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

      // Skip fetch if user already dismissed the banner this session
      const dismissed = (() => { try { return sessionStorage.getItem('recentBannerDismissed') === 'true'; } catch { return false; } })();
      if (dismissed) {
        setRecentBannerDismissed(true);
        return;
      }

      // Step 1: fetch recent recommendation events
      const { data: rows, error: recentError } = await supabase
        .from('recommendations')
        .select('merchant_id, effective_rate, earn_type, explanation, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!recentError && rows?.length) {
        // Deduplicate by merchant — keep most recent visit per merchant
        const seen = new Set<string>();
        const dedupedRows: typeof rows = [];
        for (const row of rows) {
          if (seen.has(row.merchant_id)) continue;
          seen.add(row.merchant_id);
          dedupedRows.push(row);
          if (dedupedRows.length === 5) break;
        }

        // Step 2: fetch merchant names for those IDs
        const merchantIds = dedupedRows.map((r) => r.merchant_id);
        const { data: merchantData, error: merchantError } = await supabase
          .from('merchants')
          .select('id, canonical_name')
          .in('id', merchantIds);

        if (!merchantError && merchantData) {
          const nameMap = new Map(merchantData.map((m) => [m.id, m.canonical_name]));
          const deduped: RecentVisit[] = dedupedRows
            .filter((r) => nameMap.has(r.merchant_id))
            .map((r) => {
              const match = r.explanation.match(/earns (\d+\.?\d*)(x|%)/);
              const earn_rate = match ? parseFloat(match[1]) : r.effective_rate;
              return {
                merchant_id: r.merchant_id,
                canonical_name: nameMap.get(r.merchant_id)!,
                card_name: r.explanation.split(' earns ')[0],
                earn_rate,
                earn_type: r.earn_type,
                visited_at: r.created_at,
              };
            });
          setRecentVisits(deduped);
        }
      }
    };

    checkAuth();

    // Restore nearby merchants if the user navigated away and came back.
    // Results older than 30 minutes are discarded — location context has changed.
    try {
      const saved = sessionStorage.getItem('nearbyMerchants');
      const savedAt = sessionStorage.getItem('nearbyMerchantsAt');
      if (saved && savedAt) {
        const ageMs = Date.now() - parseInt(savedAt, 10);
        if (ageMs < 30 * 60 * 1000) {
          setNearbyMerchants(JSON.parse(saved));
          setLocationState('done');
        } else {
          sessionStorage.removeItem('nearbyMerchants');
          sessionStorage.removeItem('nearbyMerchantsAt');
        }
      }
    } catch {
      // sessionStorage unavailable (private browsing restrictions etc.) — silent fallback
    }
  }, [router, supabase]);

  // Search merchants
  const fetchMerchants = async (query: string) => {
    if (!query.trim()) {
      setMerchants([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/merchants/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        console.error(`Search failed with status ${response.status}`);
        return;
      }
      const data = await response.json();
      setMerchants(data.data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    await fetchMerchants(query);
  };

  const handleSelectMerchant = (merchantId: string) => {
    router.push(`/recommend/${merchantId}`);
  };

  // Navigate to the historic view when tapping from the "Recent" banner so
  // that the recommendation shown is the one recorded at visit time, not a
  // fresh recalculation against the current wallet.
  const handleRecentVisitSelect = (merchantId: string) => {
    router.push(`/recommend/${merchantId}?historic=true`);
  };

  // Called when the user taps a merchant in the location banner.
  // If we have reward data, go straight to the recommend page.
  // If not, pre-fill the search box so the user can find the merchant manually.
  const handleNearbySelect = (merchantId: string) => {
    const merchant = nearbyMerchants.find((m) => m.id === merchantId);
    if (!merchant) return;
    if (merchant.has_rewards) {
      router.push(`/recommend/${merchantId}`);
    } else if (merchant.category_estimate) {
      // OSM-only merchant — use inferred category for full recommendation
      const params = new URLSearchParams({
        category: merchant.category_estimate.category,
        name: merchant.canonical_name,
      });
      router.push(`/recommend/${encodeURIComponent(merchantId)}?${params}`);
    } else {
      setLocationState('dismissed');
      setNearbyMerchants([]);
      try {
        sessionStorage.removeItem('nearbyMerchants');
        sessionStorage.removeItem('nearbyMerchantsAt');
      } catch { /* sessionStorage unavailable */ }
      setSearchQuery(merchant.canonical_name);
      fetchMerchants(merchant.canonical_name);
      searchInputRef.current?.focus();
    }
  };

  const handleRecentBannerDismiss = () => {
    setRecentBannerDismissed(true);
    try { sessionStorage.setItem('recentBannerDismissed', 'true'); } catch { /* unavailable */ }
  };

  const runNearbySearch = async (lat: number, lng: number, radius: number) => {
    setLocationState('loading');
    setDebugInfo(`📍 ${lat.toFixed(5)},${lng.toFixed(5)}`);
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radius: String(radius) });
      const res = await fetch(`/api/merchants/nearby?${params}`);
      if (!res.ok) {
        setDebugInfo(`API error ${res.status}`);
        setLocationState('error');
        return;
      }
      const data = await res.json();
      if (data.timed_out) { setLocationState('timed_out'); return; }
      const merchants = data.data ?? [];
      setDebugInfo(`${merchants.length} merchants nearby`);
      setNearbyMerchants(merchants);
      setLocationState(merchants.length > 0 ? 'done' : 'no_match');
      if (merchants.length > 0) {
        try {
          sessionStorage.setItem('nearbyMerchants', JSON.stringify(merchants));
          sessionStorage.setItem('nearbyMerchantsAt', Date.now().toString());
        } catch { /* sessionStorage unavailable */ }
      }
    } catch {
      setLocationState('error');
    }
  };

  const handleRadiusChange = (value: RadiusValue) => {
    setSelectedRadius(value);
    if (lastCoords) {
      runNearbySearch(lastCoords.lat, lastCoords.lng, value);
    } else {
      // No location yet — trigger full location request with new radius
      handleDetectLocationWithRadius(value);
    }
  };

  const handleDetectLocationWithRadius = (radius: number) => {
    setLocationState('requesting');
    const permissionTimer = setTimeout(() => setLocationState('error'), 15_000);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        clearTimeout(permissionTimer);
        const { lat, lng } = { lat: coords.latitude, lng: coords.longitude };
        setLastCoords({ lat, lng });
        await runNearbySearch(lat, lng, radius);
      },
      () => { clearTimeout(permissionTimer); setLocationState('error'); },
      { enableHighAccuracy: false, timeout: 10_000 }
    );
  };

  const handleDetectLocation = () => handleDetectLocationWithRadius(selectedRadius);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold bg-clip-text text-transparent bg-linear-to-r from-indigo-600 to-violet-600">
              CardAdvisor
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/wallet" className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
              Wallet
            </Link>
            <Link href="/account" aria-label="Account settings" className="text-gray-400 hover:text-indigo-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-8">
        {/* Hero section */}
        <div className="text-center mb-8 pt-4">
          <p className="text-sm font-semibold text-indigo-600 uppercase tracking-widest mb-2">
            Your personal rewards optimizer
          </p>
          <h2 className="text-3xl font-bold text-gray-900 leading-tight mb-3">
            Which card earns<br />
            <span className="bg-clip-text text-transparent bg-linear-to-r from-indigo-600 to-violet-600">
              the most?
            </span>
          </h2>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Search any merchant. We'll instantly rank your cards by reward rate.
          </p>
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <Input
            ref={searchInputRef}
            leftIcon={<SearchIcon className="h-5 w-5 text-gray-400" />}
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Whole Foods, Starbucks, Amazon…"
            autoFocus
          />
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Spinner size="sm" />
            </div>
          )}
        </div>

        {/* Persistent aria-live region for transient location states.
            Must stay in the DOM so screen readers pick up content changes. */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {locationState === 'requesting' && 'Waiting for location permission'}
          {locationState === 'loading' && 'Finding nearby merchants'}
          {locationState === 'no_match' && 'No matching merchants found nearby.'}
          {locationState === 'timed_out' && 'Location scan timed out. Try a smaller radius.'}
          {locationState === 'error' && 'Could not access location'}
        </div>

        {/* ── SEARCH RESULTS (always directly below input when searching) ── */}
        {(() => {
          const isSearching = searchQuery.trim().length > 0;
          if (!isSearching) return null;
          return (
            <>
              {merchants.length > 0 && (
                <div className="space-y-2 mb-5">
                  {merchants.map((merchant) => (
                    <button
                      key={merchant.id}
                      onClick={() => handleSelectMerchant(merchant.id)}
                      className="w-full text-left p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all duration-200 group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
                            {merchant.canonical_name}
                          </div>
                          <span className="inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                            {merchant.primary_category.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <ChevronRightIcon className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                      </div>
                      {merchant.aliases.length > 0 && (
                        <div className="text-xs text-gray-400 mt-2">
                          Also: {merchant.aliases.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!loading && merchants.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <SearchIcon className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No results for "{searchQuery}"</p>
                  <p className="text-gray-400 text-xs mt-1">Try a shorter or different name</p>
                </div>
              )}
            </>
          );
        })()}

        {/* ── CONTEXTUAL CONTENT (hidden while searching) ────────────── */}
        {searchQuery.trim().length === 0 && (
          <>
            {/* Idle / dismissed / no_match / timed_out → location CTA card */}
            {(locationState === 'idle' || locationState === 'dismissed' || locationState === 'no_match' || locationState === 'timed_out') && (
              <div className="mb-5 rounded-2xl border border-dashed border-indigo-200 bg-white p-4">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-indigo-600">
                      <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 leading-tight">Find what's near you</p>
                    <p className="text-xs text-gray-400 mt-0.5">See nearby merchants and your best card</p>
                  </div>
                </div>

                {/* Debug info */}
                {debugInfo && (
                  <p className="text-xs text-gray-400 mb-2 font-mono break-all">{debugInfo}</p>
                )}

                {/* No-results / timeout notice */}
                {(locationState === 'no_match' || locationState === 'timed_out') && (
                  <div className="mb-3 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 flex-shrink-0">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    <div>
                      {locationState === 'timed_out' ? (
                        <>
                          <p className="text-xs font-semibold text-amber-700">Scan timed out — area too busy</p>
                          <p className="text-xs text-amber-500 mt-0.5">Try a smaller radius or search manually above</p>
                        </>
                      ) : selectedRadius >= 20000 ? (
                        <>
                          <p className="text-xs font-semibold text-amber-700">No merchants in our database nearby</p>
                          <p className="text-xs text-amber-500 mt-0.5">Try searching by name above</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-semibold text-amber-700">No merchants found at this radius</p>
                          <p className="text-xs text-amber-500 mt-0.5">Try a wider range and detect again</p>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Segmented radius control */}
                <div className="flex rounded-xl bg-gray-100 p-1 mb-3">
                  {RADIUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleRadiusChange(opt.value)}
                      className={`flex-1 flex flex-col items-center py-1.5 rounded-lg text-xs font-medium transition-all ${
                        selectedRadius === opt.value
                          ? 'bg-white text-indigo-700 shadow-sm font-semibold'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span className={`text-[10px] mt-0.5 ${selectedRadius === opt.value ? 'text-indigo-400' : 'text-gray-400'}`}>
                        {opt.hint}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDetectLocation}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                  </svg>
                  Detect my location
                </button>
                <p className="text-center text-xs text-gray-400 mt-2">Your coordinates are never stored</p>
              </div>
            )}

            {locationState === 'requesting' && (
              <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 text-center">
                <p className="text-sm font-medium text-indigo-600">Waiting for location permission…</p>
                <p className="text-xs text-indigo-400 mt-1">Allow access in your browser prompt</p>
              </div>
            )}

            {locationState === 'loading' && (
              <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4 flex items-center gap-3">
                <Spinner size="sm" />
                <p className="text-sm font-medium text-indigo-600">
                  Scanning within {RADIUS_OPTIONS.find(o => o.value === selectedRadius)?.hint}…
                </p>
              </div>
            )}

            {locationState === 'error' && (
              <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5 text-center">
                <p className="text-sm font-medium text-red-600">Couldn't access location</p>
                <p className="text-xs text-red-400 mt-0.5">Try searching above instead</p>
              </div>
            )}

            {locationState === 'done' && nearbyMerchants.length > 0 && (
              <LocationBanner
                merchants={nearbyMerchants}
                onDismiss={() => {
                  setLocationState('dismissed');
                  setNearbyMerchants([]);
                  try {
                    sessionStorage.removeItem('nearbyMerchants');
                    sessionStorage.removeItem('nearbyMerchantsAt');
                  } catch { /* sessionStorage unavailable */ }
                  searchInputRef.current?.focus();
                }}
                onSelect={handleNearbySelect}
              />
            )}

            {/* ── RECENTLY VISITED ─────────────────────────────────────── */}
            {recentVisits.length > 0 && !recentBannerDismissed && (
              <LastVisitedBanner
                visits={recentVisits}
                onDismiss={handleRecentBannerDismiss}
                onSelect={handleRecentVisitSelect}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
