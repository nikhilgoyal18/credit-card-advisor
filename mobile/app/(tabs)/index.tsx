import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
  ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { searchMerchants, getNearbyMerchants } from '@/lib/api';
import type { Merchant } from '@/lib/types';

export default function HomeScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbySearched, setNearbySearched] = useState(false);

  const handleSearch = useCallback(async (text: string) => {
    setQuery(text);
    setNearbySearched(false);
    if (text.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await searchMerchants(text.trim());
      setResults(data);
    } catch (e: any) {
      setError(`Search error: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleNearby = async () => {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setError('Location permission denied.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const data = await getNearbyMerchants(loc.coords.latitude, loc.coords.longitude);
      setResults(data);
      setQuery('');
      setNearbySearched(true);
    } catch (e: any) {
      setError(`Nearby error: ${e?.message ?? e}`);
    } finally {
      setLocating(false);
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
  searchRow: { flexDirection: 'row', padding: 16, gap: 8 },
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
});
