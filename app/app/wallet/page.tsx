'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

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

  const [user, setUser] = useState(null);
  const [userCards, setUserCards] = useState<(UserCard & { card?: Card })[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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
        alert('Error adding card: ' + error.message);
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
      setShowAddCard(false);
      setSelectedCardId(null);
    } catch (err) {
      console.error('Add card error:', err);
      alert('An error occurred');
    }
  };

  const handleRemoveCard = async (userCardId: string) => {
    if (!window.confirm('Remove this card from your wallet?')) return;

    try {
      const { error } = await supabase.from('user_cards').delete().eq('id', userCardId);

      if (error) {
        alert('Error removing card: ' + error.message);
        return;
      }

      setUserCards((prev) => prev.filter((c) => c.id !== userCardId));
    } catch (err) {
      console.error('Remove card error:', err);
      alert('An error occurred');
    }
  };

  const getAvailableCards = () => {
    const usedCardIds = userCards.map((c) => c.card_id);
    return allCards.filter((c) => !usedCardIds.includes(c.id));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-600 hover:text-gray-900">
            ← Home
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Your Wallet</h1>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6">
        {userCards.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No cards yet</h2>
            <p className="text-gray-600 mb-6">Add credit cards to get personalized recommendations.</p>
            <button
              onClick={() => setShowAddCard(!showAddCard)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Add your first card
            </button>
          </div>
        ) : (
          <>
            {/* Card list */}
            <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Your Cards
            </h2>
            <div className="space-y-3 mb-6">
              {userCards.map((userCard) => (
                <div
                  key={userCard.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 flex justify-between items-start"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{userCard.card?.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {userCard.card?.issuer_id.charAt(0).toUpperCase() +
                        userCard.card?.issuer_id.slice(1)}{' '}
                      • {userCard.card?.base_earn_rate}
                      {userCard.card?.reward_unit === 'cashback_percent' ? '%' : 'x'} base
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCard(userCard.id)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Add card button */}
            <button
              onClick={() => setShowAddCard(!showAddCard)}
              className="w-full py-3 px-4 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 mb-6"
            >
              + Add another card
            </button>
          </>
        )}

        {/* Add card modal */}
        {showAddCard && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="bg-white w-full max-w-md rounded-t-lg p-6 animate-in slide-in-from-bottom">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Add a Card</h2>

              {getAvailableCards().length === 0 ? (
                <div>
                  <p className="text-gray-600 mb-6">You've added all available cards!</p>
                  <button
                    onClick={() => setShowAddCard(false)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 max-h-96 overflow-y-auto mb-6">
                    {getAvailableCards().map((card) => (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`w-full text-left p-4 rounded-lg border transition-all ${
                          selectedCardId === card.id
                            ? 'bg-blue-50 border-blue-500'
                            : 'bg-white border-gray-200 hover:border-gray-300'
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
                    <button
                      onClick={() => setShowAddCard(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddCard}
                      disabled={!selectedCardId}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      Add Card
                    </button>
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
          <Link href="/" className="text-blue-600 hover:underline font-medium">
            Start searching
          </Link>
        </div>
      </main>
    </div>
  );
}
