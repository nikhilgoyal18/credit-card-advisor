import { supabase } from './supabase';
import { BASE_URL } from '../constants/api';
import type { Merchant, RecommendResponse, Card } from './types';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function searchMerchants(query: string): Promise<Merchant[]> {
  const res = await fetch(
    `${BASE_URL}/api/merchants/search?q=${encodeURIComponent(query)}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const json = await res.json();
  return json.results ?? json;
}

export async function getRecommendations(merchantId: string): Promise<RecommendResponse> {
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ merchant_id: merchantId }),
  });
  if (!res.ok) throw new Error(`Recommend failed: ${res.status}`);
  return res.json();
}

export async function getNearbyMerchants(lat: number, lng: number): Promise<Merchant[]> {
  const res = await fetch(
    `${BASE_URL}/api/merchants/nearby?lat=${lat}&lng=${lng}`,
    { headers: await authHeaders() }
  );
  if (!res.ok) throw new Error(`Nearby failed: ${res.status}`);
  const json = await res.json();
  return json.results ?? json;
}

export async function getWalletCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('user_cards')
    .select('card_id, cards(id, name, issuer_id)')
    .order('position');
  if (error) throw error;
  return (data ?? []).map((row: any) => row.cards);
}

export async function addCardToWallet(cardId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_cards')
    .insert({ user_id: user.id, card_id: cardId, position: 999 });
  if (error) throw error;
}

export async function removeCardFromWallet(cardId: string): Promise<void> {
  const { error } = await supabase
    .from('user_cards')
    .delete()
    .eq('card_id', cardId);
  if (error) throw error;
}

export async function getAllCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('id, name, issuer_id')
    .order('name');
  if (error) throw error;
  return data ?? [];
}
