'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/app/components/Button';
import { SkeletonCard } from '@/app/components/SkeletonCard';
import { ConfirmDialog } from '@/app/components/ConfirmDialog';
import { XMarkIcon, CreditCardIcon, AlertCircleIcon } from '@/app/components/icons';

interface Card {
  id: string;
  name: string;
  issuer_id: string;
  reward_unit: 'cashback_percent' | 'points_multiplier';
  base_earn_rate: number;
}

interface UserCard {
  id: string;
  card_id: string;
  nickname?: string;
  disabled: boolean;
  display_order: number;
  created_at: string;
}

export default function WalletPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [userCards, setUserCards] = useState<(UserCard & { card?: Card })[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [modalMounted, setModalMounted] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [confirmingCardId, setConfirmingCardId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Check auth and load cards
  useEffect(() => {
    const loadCards = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);

      // Fetch all available cards
      const { data: cards } = await supabase.from('cards').select('*');
      setAllCards(cards || []);

      // Fetch user's cards
      const { data: userCardRecords } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true });

      // Enrich with card details
      const enriched = (userCardRecords || []).map((uc) => ({
        ...uc,
        card: (cards || []).find((c) => c.id === uc.card_id),
      }));

      setUserCards(enriched);
      setLoading(false);
    };

    loadCards();
  }, [router, supabase]);

  const handleAddCard = async () => {
    if (!selectedCardId || !user) return;

    try {
      const maxOrder = userCards.length > 0 ? Math.max(...userCards.map((c) => c.display_order)) : -1;

      const { error } = await supabase.from('user_cards').insert({
        user_id: user.id,
        card_id: selectedCardId,
        display_order: maxOrder + 1,
      });

      if (error) {
        setOperationError('Error adding card: ' + error.message);
        return;
      }

      // Reload cards
      const { data: userCardRecords } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true });

      const enriched = (userCardRecords || []).map((uc) => ({
        ...uc,
        card: allCards.find((c) => c.id === uc.card_id),
      }));

      setUserCards(enriched);
      closeModal();
      setSelectedCardId(null);
    } catch (err) {
      console.error('Add card error:', err);
      setOperationError('An error occurred');
    }
  };

  const handleRemoveCard = async (userCardId: string) => {
    setIsRemoving(true);
    try {
      const { error } = await supabase.from('user_cards').delete().eq('id', userCardId);

      if (error) {
        setOperationError('Error removing card: ' + error.message);
        setConfirmingCardId(null);
        return;
      }

      setUserCards((prev) => prev.filter((c) => c.id !== userCardId));
      setConfirmingCardId(null);
    } catch (err) {
      console.error('Remove card error:', err);
      setOperationError('An error occurred');
      setConfirmingCardId(null);
    } finally {
      setIsRemoving(false);
    }
  };

  const getAvailableCards = () => {
    const usedCardIds = userCards.map((c) => c.card_id);
    return allCards.filter((c) => !usedCardIds.includes(c.id));
  };

  const openModal = () => {
    setShowAddCard(true);
    requestAnimationFrame(() => setModalMounted(true));
  };

  const closeModal = () => {
    setModalMounted(false);
    setTimeout(() => setShowAddCard(false), 300);
  };

  const issuerGradients: Record<string, string> = {
    chase: 'from-[#003087] to-[#0050b3]',
    amex: 'from-[#007bc1] to-[#005b8e]',
    capital_one: 'from-[#d03027] to-[#9b1e1a]',
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="bg-white/80 border-b border-gray-100 h-14" />
        <main className="flex-1 max-w-md mx-auto w-full px-4 py-6">
          <div className="section-label-skeleton animate-pulse h-3 w-24 bg-gray-200 rounded mb-4" />
          <div className="space-y-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            ← Home
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Your Wallet</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        {/* Error banner */}
        {operationError && (
          <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircleIcon className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{operationError}</p>
            </div>
            <button
              onClick={() => setOperationError(null)}
              className="ml-auto text-red-400 hover:text-red-600 flex-shrink-0"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {userCards.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">💳</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No cards yet</h2>
            <p className="text-gray-600 mb-6">Add credit cards to get personalized recommendations.</p>
            <Button variant="primary" onClick={openModal}>
              Add your first card
            </Button>
          </div>
        ) : (
          <>
            {/* Card list */}
            <h2 className="section-label">Your Cards</h2>
            <div className="space-y-3 mb-6">
              {userCards.map((userCard) => {
                const gradient = issuerGradients[userCard.card?.issuer_id || ''] || 'from-gray-700 to-gray-900';
                return (
                  <div key={userCard.id} className="relative">
                    <div
                      className={`relative rounded-2xl p-5 bg-linear-to-br ${gradient} text-white shadow-lg overflow-hidden min-h-[120px] flex flex-col justify-between`}
                    >
                      {/* Decorative circles */}
                      <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/10 rounded-full" />
                      <div className="absolute -bottom-8 -right-2 w-24 h-24 bg-white/5 rounded-full" />

                      <div className="relative z-10 flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-white text-base leading-tight">
                            {userCard.card?.name}
                          </div>
                          <div className="text-white/70 text-xs mt-1 capitalize">
                            {userCard.card?.issuer_id.replace(/_/g, ' ')}
                          </div>
                        </div>
                        <button
                          onClick={() => setConfirmingCardId(userCard.id)}
                          className="text-white/60 hover:text-white/90 transition-colors p-1 -mr-1 -mt-1"
                          aria-label="Remove card"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="relative z-10 mt-4 flex items-end justify-between">
                        <div className="text-white/90 text-sm font-medium">
                          {userCard.card?.base_earn_rate}
                          {userCard.card?.reward_unit === 'cashback_percent' ? '% base' : 'x base'}
                        </div>
                      </div>
                    </div>

                    {/* ConfirmDialog must be outside the overflow-hidden card div */}
                    <ConfirmDialog
                      isOpen={confirmingCardId === userCard.id}
                      message="Remove this card from your wallet?"
                      confirmLabel="Remove"
                      cancelLabel="Keep"
                      onConfirm={() => handleRemoveCard(userCard.id)}
                      onCancel={() => setConfirmingCardId(null)}
                      variant="danger"
                      isLoading={isRemoving}
                    />
                  </div>
                );
              })}
            </div>

            {/* Add card button */}
            <Button
              variant="secondary"
              size="full"
              onClick={openModal}
              className="mb-6"
            >
              + Add another card
            </Button>
          </>
        )}

        {/* Add card modal */}
        {showAddCard && (
          <div
            className={`fixed inset-0 z-50 flex items-end justify-center transition-colors duration-300 ${
              modalMounted ? 'bg-black/50' : 'bg-transparent'
            }`}
          >
            <div
              className={`bg-white w-full max-w-md mx-auto rounded-t-2xl p-6 transition-transform duration-300 ease-out ${
                modalMounted ? 'translate-y-0' : 'translate-y-full'
              }`}
            >
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add a Card</h2>

              {getAvailableCards().length === 0 ? (
                <div>
                  <p className="text-gray-600 mb-6">You've added all available cards!</p>
                  <Button variant="primary" size="full" onClick={closeModal}>
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
                    {getAvailableCards().map((card) => (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          selectedCardId === card.id
                            ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20'
                            : 'bg-white border-gray-100 hover:border-indigo-200'
                        }`}
                      >
                        <div className="font-semibold text-gray-900">{card.name}</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {card.issuer_id.charAt(0).toUpperCase() + card.issuer_id.slice(1)}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      size="md"
                      onClick={closeModal}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleAddCard}
                      disabled={!selectedCardId}
                      className="flex-1"
                    >
                      Add Card
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer message */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600 mb-4">
            Once you've added cards, search for merchants to get personalized recommendations.
          </p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            Start searching
          </Link>
        </div>
      </main>
    </div>
  );
}
