import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useLanguage } from '../directory/Languagecontext';
import api from '../services/api';
import type { PolicySummary } from '../types/policy';

type HistoryScreenProps = {
  isActive?: boolean;
  bottomInset?: number;
};

const STATUS_ACCENTS: Record<string, string> = {
  active: '#00E5A0',
  expired: '#F59E0B',
  pending_payment: '#F97316',
};

const STATUS_BACKGROUNDS: Record<string, string> = {
  active: '#00E5A022',
  expired: '#F59E0B22',
  pending_payment: '#F9731622',
};

const formatCurrency = (value: number, locale: string) =>
  `₹${value.toLocaleString(locale, {
    minimumFractionDigits: Number.isInteger(value) ? 0 : value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`;

const formatDate = (value: string, locale: string) =>
  new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatStatus = (status: string, t: (path: string) => string) => {
  switch (status) {
    case 'active':
      return t('history.statusActive');
    case 'expired':
      return t('history.statusExpired');
    case 'pending_payment':
      return t('history.statusPendingPayment');
    default:
      return status
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

  export default function HistoryScreen({ isActive = false, bottomInset = 40 }: HistoryScreenProps) {
    const { language, t } = useLanguage();
    const [history, setHistory] = useState<PolicySummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const locale = language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN';

    const fetchHistory = async () => {
      try {
        const response = await api.get('/policy/history');
        setHistory(Array.isArray(response.data) ? (response.data as PolicySummary[]) : []);
      } catch {
        setHistory([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    useEffect(() => {
      if (isActive) {
        fetchHistory();
      }
    }, [isActive]);

    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator color="#00E5A0" size="large" />
          <Text style={styles.loadingText}>{t('history.loading')}</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('history.eyebrow')}</Text>
          <Text style={styles.title}>{t('history.title')}</Text>
          <Text style={styles.subtitle}>{t('history.subtitle')}</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchHistory();
              }}
              tintColor="#00E5A0"
            />
          )}
        >
          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('history.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('history.emptyText')}</Text>
            </View>
          ) : (
            history.map((policy) => {
              const claims = policy.claims ?? [];
              const totalPaidOut = claims
                .filter((claim) => claim.status === 'paid' || claim.status === 'auto_approved')
                .reduce((sum, claim) => sum + claim.payoutAmount, 0);
              const accent = STATUS_ACCENTS[policy.status] ?? '#7A8597';
              const badgeBackground = STATUS_BACKGROUNDS[policy.status] ?? '#7A859722';
              const weekStart = formatDate(policy.weekStartDate, locale);
              const weekEnd = formatDate(policy.weekEndDate, locale);

              return (
                <View key={policy.id} style={styles.historyCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.weekLabel}>{t('history.weekOf', { date: weekStart })}</Text>
                      <Text style={styles.periodLabel}>{t('history.dateRange', { start: weekStart, end: weekEnd })}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badgeBackground }]}>
                      <Text style={[styles.statusText, { color: accent }]}>{formatStatus(policy.status, t)}</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{formatCurrency(policy.weeklyPremium, locale)}</Text>
                      <Text style={styles.statLabel}>{t('history.weeklyPremium')}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{formatCurrency(policy.coveragePerDay, locale)}</Text>
                      <Text style={styles.statLabel}>{t('history.coveragePerDay')}</Text>
                    </View>
                  </View>

                  <View style={styles.footerRow}>
                    <Text style={styles.footerText}>{t('history.claimsRecorded', { count: String(claims.length) })}</Text>
                    <Text style={styles.footerHighlight}>{t('history.paidOut', { amount: formatCurrency(totalPaidOut, locale) })}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0A0A0F',
      paddingHorizontal: 20,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0A0A0F',
      gap: 10,
    },
    loadingText: {
      color: '#7A8597',
      fontSize: 13,
      fontWeight: '600',
    },
    header: {
      paddingTop: 60,
      paddingBottom: 24,
    },
    eyebrow: {
      color: '#00E5A0',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    title: {
      color: '#FFFFFF',
      fontSize: 30,
      fontWeight: '800',
      marginBottom: 8,
    },
    subtitle: {
      color: '#7A8597',
      fontSize: 14,
      lineHeight: 20,
    },
    content: {
      gap: 14,
    },
    emptyCard: {
      marginTop: 24,
      backgroundColor: '#13131A',
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: '#1E1E2E',
    },
    emptyTitle: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 10,
    },
    emptyText: {
      color: '#7A8597',
      fontSize: 14,
      lineHeight: 21,
    },
    historyCard: {
      backgroundColor: '#13131A',
      borderRadius: 20,
      padding: 18,
      borderWidth: 1,
      borderColor: '#1E1E2E',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 18,
    },
    cardHeaderText: {
      flex: 1,
    },
    weekLabel: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
      marginBottom: 4,
    },
    periodLabel: {
      color: '#7A8597',
      fontSize: 13,
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
    },
    statCard: {
      flex: 1,
      backgroundColor: '#0F141E',
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: '#202938',
    },
    statValue: {
      color: '#FFFFFF',
      fontSize: 20,
      fontWeight: '800',
      marginBottom: 4,
    },
    statLabel: {
      color: '#7A8597',
      fontSize: 12,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    footerText: {
      flex: 1,
      color: '#98A2B3',
      fontSize: 13,
    },
    footerHighlight: {
      color: '#00E5A0',
      fontSize: 13,
      fontWeight: '700',
    },
  });
