import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, Modal,
  ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { getWalletCards, getAllCards, addCardToWallet, removeCardFromWallet } from '@/lib/api';
import type { Card } from '@/lib/types';

export default function WalletScreen() {
  const [wallet, setWallet] = useState<Card[]>([]);
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cards = await getWalletCards();
      setWallet(cards);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openPicker() {
    const cards = await getAllCards();
    setAllCards(cards);
    setShowPicker(true);
  }

  async function handleAdd(card: Card) {
    if (wallet.some((c) => c.id === card.id)) {
      setShowPicker(false);
      return;
    }
    setAdding(true);
    try {
      await addCardToWallet(card.id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
      setShowPicker(false);
    }
  }

  async function handleRemove(card: Card) {
    Alert.alert('Remove card', `Remove ${card.name} from your wallet?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await removeCardFromWallet(card.id);
          await load();
        },
      },
    ]);
  }

  const availableCards = allCards.filter((c) => !wallet.some((w) => w.id === c.id));

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color="#6366f1" />
      ) : (
        <>
          <FlatList
            data={wallet}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.issuer}>{item.issuer_id.replace(/_/g, ' ')}</Text>
                </View>
                <Pressable onPress={() => handleRemove(item)}>
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No cards in your wallet yet.</Text>
            }
          />
          <Pressable style={styles.addBtn} onPress={openPicker}>
            <Text style={styles.addBtnText}>+ Add Card</Text>
          </Pressable>
        </>
      )}

      <Modal visible={showPicker} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose a Card</Text>
            <Pressable onPress={() => setShowPicker(false)}>
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>
          {adding ? (
            <ActivityIndicator style={{ marginTop: 40 }} color="#6366f1" />
          ) : (
            <FlatList
              data={availableCards}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <Pressable style={styles.card} onPress={() => handleAdd(item)}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.issuer}>{item.issuer_id.replace(/_/g, ' ')}</Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>All available cards are already in your wallet.</Text>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  issuer: { fontSize: 13, color: '#64748b', marginTop: 2, textTransform: 'capitalize' },
  remove: { color: '#ef4444', fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 48, fontSize: 15 },
  addBtn: {
    position: 'absolute', bottom: 32, left: 24, right: 24,
    backgroundColor: '#6366f1', borderRadius: 14, padding: 16, alignItems: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalClose: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
});
