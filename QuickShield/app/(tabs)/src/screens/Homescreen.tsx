import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Pressable,
  StatusBar, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/auth.service';
import ProfileAvatar from '../components/ProfileAvatar';

interface Policy {
  id: string;
  status: string;
  coveragePerDay: number;
  weeklyPremium: number;
  weekEndDate: string;
  claims: { payoutAmount: number; triggerType: string; status: string; createdAt: string }[];
}

const TRIGGER_LABELS: Record<string, string> = {
  rain: '🌧 Heavy rain',
  app_outage: '📵 App outage',
  zone_closure: '🚧 Zone closure',
};

const formatPlatformName = (platform: string | null) => {
  if (!platform) {
    return 'platform';
  }

  return platform
    .split(/[_-]/g)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export default function HomeScreen() {
  const { user, setUser } = useAuth();
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const fetchPolicy = async () => {
    try {
      const res = await api.get('/policy/active');
      setPolicy(res.data);
    } catch {
      setPolicy(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchPolicy(); }, []);

  const daysLeft = policy
    ? Math.max(0, Math.ceil((new Date(policy.weekEndDate).getTime() - Date.now()) / 86400000))
    : 0;

  const totalPaidOut = policy?.claims
    .filter(c => c.status === 'paid' || c.status === 'auto_approved')
    .reduce((s, c) => s + c.payoutAmount, 0) ?? 0;

  const displayName = user?.fullName?.trim() || 'Complete your profile';
  const contactLine = user?.email || user?.phone || 'Add your details';
  const platformLabel = formatPlatformName(user?.platform ?? null);

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00E5A0" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      {profileMenuVisible && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setProfileMenuVisible(false)} />
          <View style={styles.profileMenu}>
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                router.push('/profile');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.profileMenuLabel}>My profile</Text>
              <Text style={styles.profileMenuHint}>View and edit your details</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileMenuItem}
              onPress={() => {
                setProfileMenuVisible(false);
                router.push('/platform-connect');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.profileMenuLabel}>Connect {platformLabel}</Text>
              <Text style={styles.profileMenuHint}>Go to your selected q-commerce platform</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.profileEntry}>
          <TouchableOpacity
            onPress={() => setProfileMenuVisible((current) => !current)}
            activeOpacity={0.85}
            style={styles.avatarButton}
          >
            <ProfileAvatar uri={user?.profilePhoto} size={48} borderRadius={16} />
          </TouchableOpacity>
          <View style={styles.profileTextWrap}>
            <Text style={styles.greeting}>Good morning 👋</Text>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.email}>{contactLine}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPolicy(); }} tintColor="#00E5A0" />}
      >
        {policy?.status === 'active' ? (
          <>
            {/* Active policy card */}
            <View style={styles.policyCard}>
              <View style={styles.policyCardHeader}>
                <Text style={styles.policyCardTitle}>Active protection</Text>
                <View style={styles.activeBadge}>
                  <View style={styles.activeDot} />
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              </View>

              <Text style={styles.coverageAmount}>₹{policy.coveragePerDay.toLocaleString('en-IN')}</Text>
              <Text style={styles.coverageLabel}>per day coverage</Text>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{daysLeft}</Text>
                  <Text style={styles.statLabel}>Days left</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statVal}>₹{policy.weeklyPremium.toFixed(0)}</Text>
                  <Text style={styles.statLabel}>Weekly premium</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statVal, { color: '#00E5A0' }]}>₹{totalPaidOut.toFixed(0)}</Text>
                  <Text style={styles.statLabel}>Paid out</Text>
                </View>
              </View>
            </View>

            {/* Recent claims */}
            <Text style={styles.sectionTitle}>Recent claims</Text>
            {policy.claims.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No disruptions this week. Stay protected!</Text>
              </View>
            ) : (
              policy.claims.map((claim, i) => (
                <View key={i} style={styles.claimRow}>
                  <Text style={styles.claimType}>{TRIGGER_LABELS[claim.triggerType] ?? claim.triggerType}</Text>
                  <View style={styles.claimRight}>
                    <Text style={styles.claimAmount}>+₹{claim.payoutAmount.toFixed(2)}</Text>
                    <View style={[styles.claimBadge, claim.status === 'paid' && styles.claimBadgePaid]}>
                      <Text style={styles.claimBadgeText}>{claim.status === 'paid' ? 'Paid' : 'Processing'}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          /* No active policy CTA */
          <View style={styles.ctaCard}>
            <Text style={styles.ctaTitle}>You&apos;re not protected yet</Text>
            <Text style={styles.ctaSubtitle}>
              Get weekly income protection from ₹20/week. Auto-payouts when disruptions hit your zone.
            </Text>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.push('/create-policy')}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaBtnText}>Get protected now</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', paddingHorizontal: 20 },
  center: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  profileMenu: {
    position: 'absolute',
    top: 116,
    left: 20,
    width: 250,
    backgroundColor: '#11141B',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1C2432',
    padding: 8,
    zIndex: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  profileMenuItem: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#131923',
    marginBottom: 8,
  },
  profileMenuLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileMenuHint: {
    color: '#7A8597',
    fontSize: 12,
    lineHeight: 18,
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 60, paddingBottom: 24,
  },
  profileEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 14,
  },
  avatarButton: {
    borderRadius: 16,
  },
  profileTextWrap: {
    flex: 1,
  },
  greeting: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  profileName: { fontSize: 15, fontWeight: '700', color: '#D1D5DB', marginBottom: 2 },
  email: { fontSize: 12, color: '#6B7280' },
  signOutBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E1E2E' },
  signOutText: { fontSize: 12, color: '#6B7280' },

  policyCard: {
    backgroundColor: '#0F1F18', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: '#00E5A033', marginBottom: 24,
  },
  policyCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  policyCardTitle: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#00E5A022', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00E5A0' },
  activeBadgeText: { fontSize: 12, color: '#00E5A0', fontWeight: '600' },
  coverageAmount: { fontSize: 42, fontWeight: '700', color: '#FFFFFF', letterSpacing: -1 },
  coverageLabel: { fontSize: 13, color: '#6B7280', marginBottom: 20 },
  divider: { height: 1, backgroundColor: '#1E2E26', marginBottom: 20 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#6B7280' },
  statDivider: { width: 1, height: 32, backgroundColor: '#1E2E26' },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 12 },
  claimRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#13131A', borderRadius: 12, padding: 16,
    marginBottom: 8, borderWidth: 1, borderColor: '#1E1E2E',
  },
  claimType: { fontSize: 14, color: '#D1D5DB', fontWeight: '500' },
  claimRight: { alignItems: 'flex-end', gap: 4 },
  claimAmount: { fontSize: 15, fontWeight: '700', color: '#00E5A0' },
  claimBadge: { backgroundColor: '#F59E0B22', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  claimBadgePaid: { backgroundColor: '#00E5A022' },
  claimBadgeText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },

  emptyCard: {
    backgroundColor: '#13131A', borderRadius: 12, padding: 20,
    borderWidth: 1, borderColor: '#1E1E2E', alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },

  ctaCard: {
    backgroundColor: '#13131A', borderRadius: 20, padding: 28,
    borderWidth: 1, borderColor: '#1E1E2E', marginTop: 20,
  },
  ctaTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 },
  ctaSubtitle: { fontSize: 14, color: '#6B7280', lineHeight: 20, marginBottom: 24 },
  ctaBtn: { backgroundColor: '#00E5A0', borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#0A0A0F' },
});
