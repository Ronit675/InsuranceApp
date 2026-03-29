import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ZONES = [
  { id: 'bengaluru-koramangala', label: 'Koramangala', city: 'Bengaluru', risk: 'Medium' },
  { id: 'bengaluru-indiranagar',  label: 'Indiranagar',  city: 'Bengaluru', risk: 'Low'    },
  { id: 'bengaluru-whitefield',   label: 'Whitefield',   city: 'Bengaluru', risk: 'Low'    },
  { id: 'bengaluru-btm',          label: 'BTM Layout',   city: 'Bengaluru', risk: 'High'   },
  { id: 'mumbai-andheri',         label: 'Andheri',      city: 'Mumbai',    risk: 'High'   },
  { id: 'mumbai-bandra',          label: 'Bandra',       city: 'Mumbai',    risk: 'Medium' },
  { id: 'delhi-connaught',        label: 'Connaught Pl', city: 'Delhi',     risk: 'Medium' },
  { id: 'delhi-lajpat',           label: 'Lajpat Nagar', city: 'Delhi',     risk: 'Low'    },
];

const RISK_COLORS: Record<string, string> = {
  Low: '#00E5A0',
  Medium: '#F59E0B',
  High: '#EF4444',
};

export default function OnboardingZoneScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();

  const handleContinue = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const zone = ZONES.find(z => z.id === selected)!;
      const res = await api.post('/profile/zone', {
        serviceZone: selected,
        city: zone.city,
      });
      setUser(res.data.user);
      router.replace('/home');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <View style={styles.header}>
        <View style={styles.stepRow}>
          <View style={[styles.step, styles.stepDone]} />
          <View style={[styles.step, styles.stepActive]} />
        </View>
        <Text style={styles.stepLabel}>Step 2 of 2</Text>
        <Text style={styles.title}>Your service zone</Text>
        <Text style={styles.subtitle}>
          Zone risk affects your weekly premium. We use historical disruption data for each area.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {ZONES.map((z) => (
          <TouchableOpacity
            key={z.id}
            style={[styles.row, selected === z.id && styles.rowSelected]}
            onPress={() => setSelected(z.id)}
            activeOpacity={0.8}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.zoneLabel}>{z.label}</Text>
              <Text style={styles.zoneCity}>{z.city}</Text>
            </View>
            <View style={styles.rowRight}>
              <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[z.risk] + '22' }]}>
                <Text style={[styles.riskText, { color: RISK_COLORS[z.risk] }]}>{z.risk}</Text>
              </View>
              {selected === z.id && <Text style={styles.checkmark}>✓</Text>}
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.bottom}>
        {selected && (
          <View style={styles.earningsNote}>
            <Text style={styles.earningsNoteText}>
              We&apos;ll import your last 8 weeks of earnings from the platform to set your recommended coverage.
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.btn, !selected && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={!selected || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#0A0A0F" />
            : <Text style={styles.btnText}>Start protecting my income</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', paddingHorizontal: 24 },
  header: { paddingTop: 60, marginBottom: 24 },
  stepRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  step: { height: 4, flex: 1, borderRadius: 2, backgroundColor: '#1E1E2E' },
  stepActive: { backgroundColor: '#00E5A0' },
  stepDone: { backgroundColor: '#00E5A0' },
  stepLabel: { fontSize: 12, color: '#6B7280', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#13131A', borderRadius: 14, padding: 18,
    marginBottom: 10, borderWidth: 1, borderColor: '#1E1E2E',
  },
  rowSelected: { borderColor: '#00E5A0', borderWidth: 1.5 },
  rowLeft: { gap: 2 },
  zoneLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  zoneCity: { fontSize: 12, color: '#6B7280' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riskBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  riskText: { fontSize: 12, fontWeight: '600' },
  checkmark: { fontSize: 16, color: '#00E5A0', fontWeight: '700' },
  bottom: { paddingBottom: 48, gap: 12 },
  earningsNote: {
    backgroundColor: '#00E5A022',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#00E5A044',
  },
  earningsNoteText: { fontSize: 13, color: '#00E5A0', lineHeight: 18 },
  btn: {
    height: 56, backgroundColor: '#00E5A0', borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#0A0A0F' },
});
