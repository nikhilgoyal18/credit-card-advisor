import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
  ActivityIndicator, SafeAreaView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { searchMerchants, getNearbyMerchants } from '@/lib/api';
import type { Merchant } from '@/lib/types';

const RADIUS_OPTIONS = [
  { label: '200m', value: 200 },
  { label: '500m', value: 500 },
  { label: '1km', value: 1000 },
  { label: '2km', value: 2000 },
  { label: '5km', value: 5000 },
];

// Module-level cache — survives component remounts during navigation
const cache = {
  results: [] as Merchant[],
  coords: null as { lat: number; lng: number } | null,
  radius: 1000,
  nearbySearched: false,
  query: '',
};

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState(cache.query);
  const [results, setResults] = useState<Merchant[]>(cache.results);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbySearched, setNearbySearched] = useState(cache.nearbySearched);
  const [radius, setRadius] = useState(cache.radius);
  const [lastCoords, setLastCoords] = useState(cache.coords);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    cache.query = text;
    setNearbySearched(false);
    cache.nearbySearched = false;
    if (text.trim().length < 2) { setResults([]); cache.results = []; return; }
    setLoading(true);
    setError(null);
    try {
      const data = await searchMerchants(text.trim());
      setResults(data);
      cache.results = data;
    } catch (e: any) {
      setError(`Search error: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const runNearbySearch = useCallback(async (lat: number, lng: number, r: number) => {
    setLocating(true);
    setError(null);
    try {
      const data = await getNearbyMerchants(lat, lng, r);
      setResults(data);
      cache.results = data;
      setQuery('');
      cache.query = '';
      setNearbySearched(true);
      cache.nearbySearched = true;
    } catch (e: any) {
      setError(`Nearby error: ${e?.message ?? e}`);
    } finally {
      setLocating(false);
    }
  }, []);

  const handleNearby = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission denied.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setLastCoords(coords);
      cache.coords = coords;
      await runNearbySearch(coords.lat, coords.lng, radius);
    } catch (e: any) {
      setError(`Location error: ${e?.message ?? e}`);
    }
  };

  const handleRadiusChange = async (newRadius: number) => {
    setRadius(newRadius);
    cache.radius = newRadius;
    if (lastCoords) {
      runNearbySearch(lastCoords.lat, lastCoords.lng, newRadius);
    } else {
      // No location yet — request it now
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setError('Location permission denied.'); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
        setLastCoords(coords);
        cache.coords = coords;
        runNearbySearch(coords.lat, coords.lng, newRadius);
      } catch (e: any) {
        setError(`Location error: ${e?.message ?? e}`);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search merchants..."
          value={query}
          onChangeText={handleSearch}
          placeholderTextColor="#9ca3af"
          clearButtonMode="while-editing"
        />
        <Pressable style={styles.locateBtn} onPress={handleNearby} disabled={locating}>
          {locating
            ? <ActivityIndicator color="#6366f1" size="small" />
            : <Text style={styles.locateText}>📍</Text>
          }
        </Pressable>
      </View>

      {/* Radius picker — only shown when not doing a text search */}
      {query.length === 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.radiusRow} contentContainerStyle={styles.radiusContent}>
          {RADIUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.radiusChip, radius === opt.value && styles.radiusChipActive]}
              onPress={() => handleRadiusChange(opt.value)}
            >
              <Text style={[styles.radiusChipText, radius === opt.value && styles.radiusChipTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#6366f1" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/recommend/${item.id}`)}
            >
              <Text style={styles.merchantName}>{item.canonical_name}</Text>
              {item.primary_category && (
                <Text style={styles.category}>{item.primary_category.replace(/_/g, ' ')}</Text>
              )}
            </Pressable>
          )}
          ListEmptyComponent={
            nearbySearched
              ? <Text style={styles.hint}>No merchants found nearby. Try a larger radius or search by name.</Text>
              : query.length === 0
                ? <Text style={styles.hint}>Search a merchant or tap 📍 to find nearby ones</Text>
                : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  searchRow: { flexDirection: 'row', padding: 16, gap: 8, paddingBottom: 8 },
  input: {
    flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 16, color: '#1e293b',
  },
  locateBtn: {
    width: 48, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  locateText: { fontSize: 20 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0',
  },
  merchantName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  category: { fontSize: 13, color: '#64748b', marginTop: 2 },
  hint: { textAlign: 'center', color: '#94a3b8', marginTop: 48, fontSize: 15, paddingHorizontal: 24 },
  error: { color: '#ef4444', paddingHorizontal: 16, marginBottom: 8, fontSize: 14 },
  radiusRow: { height: 48, flexShrink: 0 },
  radiusContent: { paddingHorizontal: 16, alignItems: 'center', flexDirection: 'row' },
  radiusChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, marginRight: 8,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0',
  },
  radiusChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  radiusChipText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  radiusChipTextActive: { color: '#fff' },
});
