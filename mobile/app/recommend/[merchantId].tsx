import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, SafeAreaView, Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRecommendations } from '@/lib/api';
import type { RecommendResponse, Recommendation } from '@/lib/types';

function getRawEarnLabel(explanation: string, earnType: string): string | null {
  const match = explanation.match(/earns\s+([\d.]+)(x|%)/i);
  if (!match) return null;
  return `${match[1]}${earnType === 'cashback_percent' ? '%' : 'x'}`;
}

function splitCaveats(caveats: string[]) {
  const spendLimit = caveats.filter((c) => c.toLowerCase().includes('applies up to'));
  const other = caveats.filter((c) => !c.toLowerCase().includes('applies up to'));
  return { spendLimit, other };
}

export default function RecommendScreen() {
  const { merchantId } = useLocalSearchParams<{ merchantId: string }>();
  const router = useRouter();
  const [data, setData] = useState<RecommendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!merchantId) return;
    getRecommendations(merchantId)
      .then(setData)
      .catch(() => setError('Could not load recommendations.'))
      .finally(() => setLoading(false));
  }, [merchantId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#6366f1" size="large" />
      </SafeAreaView>
    );
  }

  if (error || !data || data.data.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error ?? 'No recommendations found.'}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const top = data.data[0];
  const rest = data.data.slice(1);
  const { spendLimit, other } = splitCaveats(top.caveats);

  return (
    <SafeAreaView style={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← {data.merchant.name}</Text>
      </Pressable>

      {/* Hero card */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Best card</Text>
        <Text style={styles.heroRate}>
          {getRawEarnLabel(top.explanation, top.earn_type) ?? `${top.effective_rate}${top.earn_type === 'cashback_percent' ? '%' : 'x'}`}
        </Text>
        {top.earn_type !== 'cashback_percent' && (
          <Text style={styles.heroEffective}>≈{top.effective_rate.toFixed(1)}% effective value</Text>
        )}
        <Text style={styles.heroCardName}>{top.card_id.replace(/_/g, ' ')}</Text>
        <Text style={styles.heroExplanation}>{top.explanation}</Text>
        {spendLimit.map((c, i) => (
          <View key={i} style={styles.infoChip}>
            <Text style={styles.infoText}>ℹ {c}</Text>
          </View>
        ))}
        {other.length > 0 && (
          <View style={styles.warnChip}>
            <Text style={styles.warnText}>⚠ {other.join(' · ')}</Text>
          </View>
        )}
      </View>

      {/* Other cards */}
      {rest.length > 0 && (
        <FlatList
          data={rest}
          keyExtractor={(item) => item.card_id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.otherHeader}>Other cards</Text>}
          renderItem={({ item }) => {
            const { spendLimit: sl, other: ot } = splitCaveats(item.caveats);
            return (
              <View style={styles.otherCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.otherName}>{item.card_id.replace(/_/g, ' ')}</Text>
                  <Text style={styles.otherExplain}>{item.explanation}</Text>
                  {sl.map((c, i) => <Text key={i} style={styles.otherInfo}>ℹ {c}</Text>)}
                  {ot.length > 0 && <Text style={styles.otherWarn}>⚠ {ot[0]}</Text>}
                </View>
                <View style={[
                  styles.rateBadge,
                  item.earn_type === 'cashback_percent' ? styles.cashBadge : styles.pointsBadge,
                ]}>
                  <Text style={[
                    styles.rateText,
                    item.earn_type === 'cashback_percent' ? styles.cashText : styles.pointsText,
                  ]}>
                    {getRawEarnLabel(item.explanation, item.earn_type) ?? `${item.effective_rate}${item.earn_type === 'cashback_percent' ? '%' : 'x'}`}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <Text style={styles.disclaimer}>{data.disclaimer}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#ef4444', fontSize: 16, textAlign: 'center', marginBottom: 16 },
  back: { color: '#6366f1', fontSize: 16 },
  backBtn: { padding: 16 },
  backText: { color: '#6366f1', fontSize: 15, fontWeight: '600' },
  hero: {
    margin: 16, borderRadius: 20, padding: 24,
    backgroundColor: '#6366f1',
  },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  heroRate: { color: '#fff', fontSize: 64, fontWeight: '900', lineHeight: 72 },
  heroEffective: { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 2, marginBottom: 4 },
  heroCardName: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 4 },
  heroExplanation: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 8 },
  infoChip: {
    marginTop: 8, backgroundColor: 'rgba(59,130,246,0.3)',
    borderRadius: 10, padding: 10,
  },
  infoText: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  warnChip: { marginTop: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 },
  warnText: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  list: { paddingHorizontal: 16, paddingBottom: 80 },
  otherHeader: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  otherCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0',
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  otherName: { fontSize: 14, fontWeight: '600', color: '#1e293b', textTransform: 'capitalize' },
  otherExplain: { fontSize: 13, color: '#64748b', marginTop: 2 },
  otherInfo: { fontSize: 12, color: '#3b82f6', marginTop: 2 },
  otherWarn: { fontSize: 12, color: '#d97706', marginTop: 2 },
  rateBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  cashBadge: { backgroundColor: '#f0fdf4' },
  pointsBadge: { backgroundColor: '#eef2ff' },
  rateText: { fontSize: 14, fontWeight: '700' },
  cashText: { color: '#15803d' },
  pointsText: { color: '#4338ca' },
  disclaimer: { color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: 16 },
});
