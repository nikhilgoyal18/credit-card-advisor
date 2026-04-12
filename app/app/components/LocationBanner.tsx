'use client';

import { useState } from 'react';
import type { NearbyMerchantResult } from '@/lib/validation/schemas';
import { ChevronRightIcon } from '@/app/components/icons';

interface LocationBannerProps {
  merchants: NearbyMerchantResult[];
  onDismiss: () => void;
  onSelect: (merchantId: string) => void;
}

const VISIBLE_COUNT = 5;
// OSM-only overflow: show the top N by estimated rate so the list stays compact.
const OSM_OVERFLOW_LIMIT = 5;

export function LocationBanner({ merchants, onDismiss, onSelect }: LocationBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (merchants.length === 0) return null;

  const visible = merchants.slice(0, VISIBLE_COUNT);
  // Only reward-matched merchants are useful as overflow chips — tapping an
  // OSM-only merchant just pre-fills the search with no results, which looks broken.
  const overflowWithRewards = merchants.slice(VISIBLE_COUNT).filter((m) => m.has_rewards);
  // Sort OSM-only overflow by best estimated rate so the most useful ones show first,
  // then cap to OSM_OVERFLOW_LIMIT to avoid an unbounded alphabetical dump.
  const overflowOsmAll = merchants.slice(VISIBLE_COUNT).filter((m) => !m.has_rewards);
  const overflowOsmSorted = [...overflowOsmAll].sort(
    (a, b) => (b.category_estimate?.best_rate ?? 0) - (a.category_estimate?.best_rate ?? 0)
  );
  const overflowOsmTop = overflowOsmSorted.slice(0, OSM_OVERFLOW_LIMIT);
  const overflowOsmHidden = overflowOsmSorted.length - overflowOsmTop.length;

  return (
    <div
      role="region"
      aria-label="Nearby merchants"
      className="mb-5 rounded-2xl bg-white border border-indigo-100 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-xs font-bold text-gray-700 uppercase tracking-widest">Near You</span>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss location suggestions"
          className="text-gray-300 hover:text-gray-500 transition-colors p-1.5 -mr-1 rounded-lg hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Merchant rows */}
      <div className="divide-y divide-gray-50">
        {visible.map((m) =>
          m.has_rewards ? (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-indigo-50/60 transition-colors group text-left"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5 bg-emerald-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors leading-tight">
                  {m.canonical_name}
                </p>
                {m.primary_category && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {m.primary_category.replace(/_/g, ' ').toLowerCase()}
                  </p>
                )}
              </div>
              <ChevronRightIcon className="h-4 w-4 text-gray-200 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
            </button>
          ) : (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5 bg-gray-200" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 leading-tight">{m.canonical_name}</p>
                {m.category_estimate ? (
                  <p className="text-xs mt-0.5">
                    <span className="text-indigo-500 font-semibold">
                      ~{m.category_estimate.earn_type === 'cashback_percent'
                        ? `${m.category_estimate.best_rate}%`
                        : `${m.category_estimate.best_rate}x`}
                    </span>
                    <span className="text-gray-400">
                      {' '}est. · {m.category_estimate.category.replace(/_/g, ' ').toLowerCase()} · {m.category_estimate.card_name}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">No reward data</p>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* Overflow — only reward-matched merchants shown as chips */}
      {overflowWithRewards.length > 0 && (
        expanded ? (
          <div className="border-t border-gray-50 px-4 py-3 flex flex-wrap gap-2">
            {overflowWithRewards.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelect(m.id)}
                className="text-xs font-medium px-3 py-1 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                {m.canonical_name}
              </button>
            ))}
            {overflowOsmTop.length > 0 && (
              <>
                <div className="w-full mt-1 mb-0.5">
                  <p className="text-xs text-gray-400 font-medium">Also nearby — estimated rewards:</p>
                </div>
                {overflowOsmTop.map((m) => (
                  <span
                    key={m.id}
                    className="text-xs px-3 py-1 rounded-full border border-gray-100 text-gray-500 bg-gray-50 cursor-default"
                    title={m.category_estimate
                      ? `Est. ${m.category_estimate.earn_type === 'cashback_percent' ? m.category_estimate.best_rate + '%' : m.category_estimate.best_rate + 'x'} with ${m.category_estimate.card_name}`
                      : 'No reward data'}
                  >
                    {m.canonical_name}
                    {m.category_estimate && (
                      <span className="ml-1.5 text-indigo-400 font-semibold">
                        ~{m.category_estimate.earn_type === 'cashback_percent'
                          ? `${m.category_estimate.best_rate}%`
                          : `${m.category_estimate.best_rate}x`}
                      </span>
                    )}
                  </span>
                ))}
                {overflowOsmHidden > 0 && (
                  <span className="w-full text-xs text-gray-400 mt-1">
                    +{overflowOsmHidden} more nearby
                  </span>
                )}
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="w-full py-3 text-xs font-semibold text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50/60 transition-colors border-t border-gray-50"
          >
            +{overflowWithRewards.length} more with rewards nearby
          </button>
        )
      )}
    </div>
  );
}
