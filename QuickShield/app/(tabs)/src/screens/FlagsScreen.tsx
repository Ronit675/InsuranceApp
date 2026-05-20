import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useLanguage } from '../directory/Languagecontext';
import type { LocationIntegrityState, LocationIntegrityReason } from '../hooks/useLocationIntegrityMonitor';
import { raiseSuspiciousQuery } from '../services/app-state.service';

type FlagsScreenProps = {
  isActive?: boolean;
  bottomInset?: number;
  locationIntegrity: LocationIntegrityState;
};

const INITIAL_VISIBLE_HISTORY_COUNT = 5;
const HISTORY_PAGE_SIZE = 5;

const formatReason = (reason: LocationIntegrityReason, t: (path: string) => string) => {
  switch (reason) {
    case 'mock_location_detected':
      return { text: t('flags.mockLocationDetected'), icon: 'alert-circle' as const };
    case 'teleportation':
      return { text: t('flags.teleportation'), icon: 'location' as const };
    case 'unnatural_velocity_curve':
      return { text: t('flags.unnaturalVelocityCurve'), icon: 'trending-up' as const };
    case 'outside_working_area':
      return { text: t('flags.outsideWorkingArea'), icon: 'warning' as const };
    case 'suspicious_outside_working_area':
      return {
        text: t('flags.suspiciousOutsideWorkingArea'),
        icon: 'shield' as const,
      };
    case 'suspicious_query_raised':
      return {
        text: t('flags.suspiciousQueryRaised'),
        icon: 'chatbubble-ellipses' as const,
      };
    case 'invigilating_location_fluctuation':
      return { text: t('flags.invigilatingLocationFluctuation'), icon: 'eye' as const };
    case 'account_suspended_location_pattern':
      return { text: t('flags.accountSuspendedLocationPattern'), icon: 'ban' as const };
    case 'permission_denied':
      return { text: t('flags.permissionDenied'), icon: 'lock-closed' as const };
    case 'gps_unavailable':
      return { text: t('flags.gpsUnavailable'), icon: 'alert-circle' as const };
    case 'location_error':
      return { text: t('flags.locationError'), icon: 'alert-circle' as const };
    default:
      return { text: reason, icon: 'alert-circle' as const };
  }
};

const formatDetectionTime = (timestamp: number, locale: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: 'short',
  });
};

const formatTimeAgo = (
  timestamp: number,
  locale: string,
  t: (path: string, vars?: Record<string, string>) => string,
) => {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 60) {
    return t('flags.secondsAgo', { count: String(diffSeconds) });
  }
  if (diffMinutes < 60) {
    return t('flags.minutesAgo', { count: String(diffMinutes) });
  }
  if (diffHours < 24) {
    return t('flags.hoursAgo', { count: String(diffHours) });
  }
  return formatDetectionTime(timestamp, locale);
};

export default function FlagsScreen({ bottomInset = 40, locationIntegrity }: FlagsScreenProps) {
  const { language, t } = useLanguage();
  const isFlagged = locationIntegrity.isFlagged;
  const flagLevel = locationIntegrity.flagLevel;
  const isYellowFlag = flagLevel === 'yellow';
  const isRedFlag = flagLevel === 'red';
  const isGreenFlag = flagLevel === 'green';
  const checksLeft = Math.max(0, 5 - locationIntegrity.consecutiveInnerRadiusPoints);
  const [isSubmittingSuspiciousQuery, setIsSubmittingSuspiciousQuery] = useState(false);
  const [hasRaisedSuspiciousQueryLocally, setHasRaisedSuspiciousQueryLocally] = useState(false);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(INITIAL_VISIBLE_HISTORY_COUNT);
  // Sort history by most recent first
  const sortedHistory = [...locationIntegrity.history].reverse();
  const visibleHistory = sortedHistory.slice(0, visibleHistoryCount);
  const hiddenHistoryCount = Math.max(0, sortedHistory.length - visibleHistory.length);
  const hasMoreHistory = hiddenHistoryCount > 0;
  const hasActiveSuspiciousCase = Boolean(
    locationIntegrity.lastSuspiciousDetectedAt
    && locationIntegrity.suspiciousHoldUntilMs
    && Date.now() < locationIntegrity.suspiciousHoldUntilMs,
  );
  const hasRaisedSuspiciousQueryForCurrentCase = useMemo(() => {
    if (!locationIntegrity.lastSuspiciousDetectedAt) {
      return false;
    }

    return locationIntegrity.history.some((entry) =>
      entry.reason === 'suspicious_query_raised'
      && entry.detectedAt >= locationIntegrity.lastSuspiciousDetectedAt!,
    );
  }, [locationIntegrity.history, locationIntegrity.lastSuspiciousDetectedAt]);
  const canRaiseSuspiciousQuery = hasActiveSuspiciousCase
    && !hasRaisedSuspiciousQueryForCurrentCase
    && !hasRaisedSuspiciousQueryLocally;

  useEffect(() => {
    setHasRaisedSuspiciousQueryLocally(false);
  }, [locationIntegrity.lastSuspiciousDetectedAt]);

  useEffect(() => {
    setVisibleHistoryCount((currentCount) =>
      Math.min(Math.max(currentCount, INITIAL_VISIBLE_HISTORY_COUNT), sortedHistory.length || INITIAL_VISIBLE_HISTORY_COUNT),
    );
  }, [sortedHistory.length]);

  const handleShowMoreHistory = () => {
    setVisibleHistoryCount((currentCount) =>
      Math.min(currentCount + HISTORY_PAGE_SIZE, sortedHistory.length),
    );
  };

  const handleRaiseSuspiciousQuery = async () => {
    if (!canRaiseSuspiciousQuery || isSubmittingSuspiciousQuery) {
      return;
    }

    setIsSubmittingSuspiciousQuery(true);

    try {
      await raiseSuspiciousQuery();
      setHasRaisedSuspiciousQueryLocally(true);
      Alert.alert(t('flags.queryRaised'), t('flags.suspiciousCaseDescription'));
    } catch (error: any) {
      Alert.alert(
        t('flags.raiseQueryFailed'),
        error?.response?.data?.message || error?.message || t('login.retry'),
      );
    } finally {
      setIsSubmittingSuspiciousQuery(false);
    }
  };

  const locale = language === 'hi' ? 'hi-IN' : language === 'kn' ? 'kn-IN' : 'en-IN';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.eyebrow}>{t('flags.eyebrow')}</Text>
              <Text style={styles.title}>{t('flags.title')}</Text>
            </View>
            <View
              style={[
                styles.badge,
                isRedFlag
                  ? styles.badgeDanger
                  : isYellowFlag
                    ? styles.badgeWarning
                    : isGreenFlag
                      ? styles.badgeRecovery
                      : styles.badgeSafe,
              ]}
            >
              <Ionicons
                name={isFlagged ? 'warning' : 'checkmark-circle'}
                size={16}
                color={
                  isRedFlag
                    ? '#FCA5A5'
                    : isYellowFlag
                      ? '#FDE68A'
                      : isGreenFlag
                        ? '#86EFAC'
                        : '#86EFAC'
                }
              />
              <Text style={styles.badgeText}>
                {isRedFlag ? t('flags.redFlag') : isYellowFlag ? t('flags.yellowFlag') : isGreenFlag ? t('flags.recovered') : t('flags.normal')}
              </Text>
            </View>
          </View>

          <View style={styles.countRow}>
            <Text style={styles.countValue}>{locationIntegrity.redFlagCount}</Text>
            <Text style={styles.countLabel}>{t('flags.breachesDetected', { count: String(locationIntegrity.redFlagCount) })}</Text>
          </View>

          {(isRedFlag || isGreenFlag) && (
            <View style={styles.recoveryRow}>
              <Text style={styles.recoveryLabel}>{t('flags.recoveryProgress')}</Text>
              <Text style={styles.recoveryText}>
                {t('flags.recoveryChecks', { completed: String(locationIntegrity.consecutiveInnerRadiusPoints) })}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(locationIntegrity.consecutiveInnerRadiusPoints / 5) * 100}%`,
                      backgroundColor: isGreenFlag ? '#86EFAC' : '#FCA5A5',
                    },
                  ]}
                />
              </View>
              <Text style={styles.checksLeft}>
                {checksLeft === 0
                  ? `✓ ${t('flags.fullyRecovered')}`
                  : t('flags.checksRemaining', { count: String(checksLeft) })}
              </Text>
            </View>
          )}

          <Text style={styles.summary}>{locationIntegrity.statusText}</Text>
          <Text style={styles.meta}>
            {t('flags.lastChecked', { time: formatDetectionTime(locationIntegrity.lastCheckedAt ?? Date.now(), locale) })}
          </Text>
          {hasActiveSuspiciousCase && (
            <View style={styles.queryCard}>
              <Text style={styles.queryTitle}>{t('flags.suspiciousCaseTitle')}</Text>
              <Text style={styles.querySubtitle}>{t('flags.suspiciousCaseDescription')}</Text>
              <TouchableOpacity
                style={[
                  styles.queryButton,
                  (!canRaiseSuspiciousQuery || isSubmittingSuspiciousQuery) && styles.queryButtonDisabled,
                ]}
                activeOpacity={0.88}
                onPress={() => {
                  void handleRaiseSuspiciousQuery();
                }}
                disabled={!canRaiseSuspiciousQuery || isSubmittingSuspiciousQuery}
              >
                {isSubmittingSuspiciousQuery ? (
                  <ActivityIndicator color="#08110F" />
                ) : (
                  <Text style={styles.queryButtonText}>
                    {hasRaisedSuspiciousQueryForCurrentCase || hasRaisedSuspiciousQueryLocally
                      ? t('flags.queryRaised')
                      : t('flags.raiseQuery')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>{t('flags.detectionHistory')}</Text>
          {sortedHistory.length > 0 ? (
            <>
              <View style={styles.timelineContainer}>
                {visibleHistory.map((entry, index) => {
                  const reason = formatReason(entry.reason, t);
                  const isLast = index === visibleHistory.length - 1;
                  return (
                    <View key={`${entry.detectedAt}-${index}`} style={[styles.timelineItem, isLast && styles.timelineItemLast]}>
                      <View style={styles.timelineDot} />
                      {!isLast && <View style={styles.timelineLine} />}

                      <View style={[styles.timelineContent, isLast && styles.timelineContentLast]}>
                        <View style={styles.flagEntryHeader}>
                          <View style={styles.flagEntryIcon}>
                            <Ionicons name={reason.icon} size={16} color="#FDE68A" />
                          </View>
                          <View style={styles.flagEntryInfo}>
                            <Text style={styles.flagEntryReason}>{reason.text}</Text>
                            <Text style={styles.flagEntryTime}>{formatTimeAgo(entry.detectedAt, locale, t)}</Text>
                          </View>
                        </View>
                        <Text style={styles.flagEntryTimestamp}>{formatDetectionTime(entry.detectedAt, locale)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {hasMoreHistory && (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  activeOpacity={0.85}
                  onPress={handleShowMoreHistory}
                >
                  <Ionicons name="chevron-down" size={16} color="#08110F" />
                  <Text style={styles.showMoreButtonText}>
                    {t('flags.showMoreHistory', { count: String(Math.min(HISTORY_PAGE_SIZE, hiddenHistoryCount)) })}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#86EFAC" />
              <Text style={styles.emptyText}>{t('flags.emptyHistoryTitle')}</Text>
              <Text style={styles.emptySubtext}>{t('flags.emptyHistorySubtitle')}</Text>
            </View>
          )}
        </View>
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
  content: {
    paddingTop: 60,
  },
  heroCard: {
    backgroundColor: '#13131A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2A3649',
    padding: 20,
    marginBottom: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  eyebrow: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  badgeSafe: {
    backgroundColor: '#0C2B1F',
    borderColor: '#14532D',
  },
  badgeRecovery: {
    backgroundColor: '#0F3B2E',
    borderColor: '#1DAA6E',
  },
  badgeWarning: {
    backgroundColor: '#3D2F0C',
    borderColor: '#92400E',
  },
  badgeDanger: {
    backgroundColor: '#321118',
    borderColor: '#7F1D1D',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  countRow: {
    marginBottom: 12,
  },
  countValue: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
  },
  countLabel: {
    color: '#8FAECC',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  recoveryRow: {
    marginVertical: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#2A3649',
    borderBottomColor: '#2A3649',
  },
  recoveryLabel: {
    color: '#8FAECC',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  recoveryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#1C2432',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  checksLeft: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '500',
  },
  summary: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  meta: {
    color: '#7A8597',
    fontSize: 12,
  },
  queryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2E4B44',
    backgroundColor: '#10231E',
    gap: 10,
  },
  queryTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },
  querySubtitle: {
    color: '#A7C1B5',
    fontSize: 13,
    lineHeight: 19,
  },
  queryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#00E5A0',
    paddingHorizontal: 16,
    paddingVertical: 11,
    minWidth: 126,
    alignItems: 'center',
  },
  queryButtonDisabled: {
    opacity: 0.55,
  },
  queryButtonText: {
    color: '#08110F',
    fontSize: 13,
    fontWeight: '800',
  },
  historySection: {
    marginBottom: 20,
  },
  historyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  timelineContainer: {
    backgroundColor: '#11141B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1C2432',
    overflow: 'hidden',
  },
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: 20,
    paddingRight: 16,
    paddingVertical: 16,
    position: 'relative',
  },
  timelineItemLast: {
    borderBottomWidth: 0,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#FDE68A',
    marginRight: 16,
    marginTop: 2,
    zIndex: 2,
  },
  timelineLine: {
    position: 'absolute',
    left: 25,
    top: 28,
    bottom: -16,
    width: 2,
    backgroundColor: '#2A3F54',
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1C2432',
  },
  timelineContentLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  flagEntryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  flagEntryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagEntryInfo: {
    flex: 1,
  },
  flagEntryReason: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  flagEntryTime: {
    color: '#8FAECC',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  flagEntryTimestamp: {
    color: '#7A8597',
    fontSize: 11,
    marginLeft: 38,
  },
  showMoreButton: {
    alignSelf: 'center',
    marginTop: 14,
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00E5A0',
  },
  showMoreButtonText: {
    color: '#08110F',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: '#D1D5DB',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#8FAECC',
    fontSize: 13,
    textAlign: 'center',
  },
});
