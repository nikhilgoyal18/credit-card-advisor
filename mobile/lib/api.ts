import { supabase } from './supabase';
import { BASE_URL } from '../constants/api';
import type { Merchant, RecommendResponse, Card } from './types';

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  // Refresh session if token is missing or expired
  const session = data.session ?? (await supabase.auth.refreshSession()).data.session;
  const token = session?.access_token;
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
  return json.data ?? [];
}

export async function getRecommendations(merchantId: string, category?: string | null): Promise<RecommendResponse> {
  const isOsm = merchantId.startsWith('osm:');
  const body = isOsm
    ? { category }
    : { merchant_id: merchantId, ...(category ? { category } : {}) };
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Recommend failed: ${res.status}`);
  return res.json();
}

async function fetchOverpassMerchants(lat: number, lng: number, radius: number): Promise<{ name: string; category?: string }[]> {
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const bbox = `${lat - latDelta},${lng - lngDelta},${lat + latDelta},${lng + lngDelta}`;

  const query = `
[out:json][timeout:20][bbox:${bbox}];
(
  node["shop"];
  node["amenity"~"restaurant|cafe|fast_food|bar|pharmacy|supermarket|bank|fuel"];
  node["brand"];
  way["shop"];
  way["amenity"~"restaurant|cafe|fast_food|bar|pharmacy|supermarket|bank|fuel"];
);
out center tags 200;
`.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);
  const json = await res.json();

  const seen = new Set<string>();
  const results: { name: string; category?: string }[] = [];

  for (const el of json.elements ?? []) {
    const name = el.tags?.brand ?? el.tags?.name ?? el.tags?.operator;
    if (!name) continue;
    const key = name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    const category = el.tags?.amenity ?? el.tags?.shop;
    results.push({ name, ...(category ? { category } : {}) });
  }

  return results.slice(0, 80);
}

export async function getNearbyMerchants(lat: number, lng: number, radius = 1000): Promise<Merchant[]> {
  // Call Overpass directly from device (avoids Vercel IP blocks)
  const osmMerchants = await fetchOverpassMerchants(lat, lng, radius);
  if (osmMerchants.length === 0) return [];

  // Send names to our API for DB matching + reward info
  const res = await fetch(`${BASE_URL}/api/merchants/nearby-match`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ merchants: osmMerchants }),
  });
  if (!res.ok) throw new Error(`Match failed: ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

export async function getWalletCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('user_cards')
    .select('card_id, cards(id, name, issuer_id)')
    .order('display_order');
  if (error) throw error;
  return (data ?? []).map((row: any) => row.cards);
}

export async function addCardToWallet(cardId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase
    .from('user_cards')
    .insert({ user_id: user.id, card_id: cardId, display_order: 999 });
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
