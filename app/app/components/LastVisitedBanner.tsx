'use client';

import type { RecentVisit } from '@/lib/validation/schemas';
import { ChevronRightIcon } from '@/app/components/icons';

interface LastVisitedBannerProps {
  visits: RecentVisit[];
  onDismiss: () => void;
  onSelect: (merchantId: string) => void;
}

function formatRelativeDate(iso: string): string {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

function formatRate(rate: number, earnType: string): string {
  return earnType === 'cashback_percent' ? `${rate}%` : `${rate}x`;
}

export function LastVisitedBanner({ visits, onDismiss, onSelect }: LastVisitedBannerProps) {
  if (visits.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Recently visited merchants"
      className="rounded-2xl bg-white border border-gray-100 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-gray-50">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Recent</span>
        <button
          onClick={onDismiss}
          aria-label="Dismiss recently visited"
          className="text-gray-300 hover:text-gray-500 transition-colors p-1.5 -mr-1 rounded-lg hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Merchant rows */}
      <div className="divide-y divide-gray-50">
        {visits.map((visit) => (
          <button
            key={visit.merchant_id}
            onClick={() => onSelect(visit.merchant_id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors group text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors leading-tight">
                {visit.canonical_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{visit.card_name}</p>
            </div>

            <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
              {formatRate(visit.effective_rate, visit.earn_type)}
            </span>

            <span className="flex-shrink-0 text-xs text-gray-300 w-12 text-right">
              {formatRelativeDate(visit.visited_at)}
            </span>

            <ChevronRightIcon className="h-4 w-4 text-gray-200 group-hover:text-gray-400 transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
