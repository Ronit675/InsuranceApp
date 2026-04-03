import React, { useCallback, useEffect, useState } from 'react';
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
import { router } from 'expo-router';
import * as Location from 'expo-location';

import api from './src/services/api';
import { useAuth } from './src/context/AuthContext';

type PremiumRecommendation = {
  recommended: number;
  min: number;
  max: number;
  avgDailyIncome: number;
};

type PremiumCalculation = {
  weeklyPremium: number;
  coveragePerDay: number;
  riderContext: {
    avgDailyIncome: number;
    serviceZone: string;
    platform: string;
  };
  composite: number;
  riskSource: 'ml_model' | 'static_fallback';
};

type ForecastDay = {
  id: string;
  dateLabel: string;
  weatherStatus: string;
  temperatureBand: string;
  precipitationRiskPercent: number;
  forecastRisk: number;
};

type CurrentWeatherSnapshot = {
  status: string;
  temperatureLabel: string;
  feelsLikeLabel: string;
  humidityLabel: string;
};

type WeatherLoadState =
  | 'idle'
  | 'locating'
  | 'loading'
  | 'ready'
  | 'permission_denied'
  | 'gps_unavailable'
  | 'error';

// Helper to map Open-Meteo codes to conditions
const getWeatherCondition = (code: number): string => {
  if (code === 0) return 'Clear sky';
  if (code >= 1 && code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 67) return 'Raining';
  if (code >= 71 && code <= 77) return 'Snowing';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Unknown';
};

const formatZoneName = (value: string | null | undefined) => {
  if (!value) return 'Not selected';
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const buildRecommendationFromIncome = (avgDailyIncome: number): PremiumRecommendation => ({
  avgDailyIncome,
  recommended: Math.round(avgDailyIncome * 0.9),
  min: Math.round(avgDailyIncome * 0.6),
  max: Math.round(avgDailyIncome * 1.2),
});

const WEATHER_TINTS: Record<string, string> = {
  Sunny: '#F59E0B',
  Cloudy: '#60A5FA',
  Stormy: '#F97316',
  Rain: '#38BDF8',
  Clear: '#F59E0B',
};

const getWeatherTint = (status: string) => {
  if (/storm|thunder/i.test(status)) return '#F97316';
  if (/rain|shower/i.test(status)) return '#38BDF8';
  if (/cloud/i.test(status)) return '#60A5FA';
  if (/clear|sun/i.test(status)) return '#F59E0B';
  return WEATHER_TINTS[status] ?? '#34D399';
};

function WeatherForecastCard({
  currentWeather,
  forecast,
}: {
  currentWeather: CurrentWeatherSnapshot;
  forecast: ForecastDay[];
}) {
  return (
    <View style={styles.forecastCard}>
      <Text style={styles.cardEyebrow}>Next 7 days</Text>
      <Text style={styles.forecastTitle}>Live weather outlook</Text>
      <Text style={styles.forecastSubtitle}>
        Pulled from your current GPS location for risk assessment.
      </Text>

      <View style={styles.currentWeatherCard}>
        <View>
          <Text style={styles.currentWeatherLabel}>Current conditions</Text>
          <Text style={styles.currentWeatherValue}>{currentWeather.status}</Text>
          <Text style={styles.currentWeatherMeta}>{currentWeather.humidityLabel}</Text>
        </View>
        <View style={styles.currentWeatherRight}>
          <Text style={styles.currentWeatherTemp}>{currentWeather.temperatureLabel}</Text>
          <Text style={styles.currentWeatherFeelsLike}>Feels like {currentWeather.feelsLikeLabel}</Text>
        </View>
      </View>

      <View style={styles.forecastList}>
        {forecast.map((day) => (
          <View key={day.id} style={styles.forecastRow}>
            <View>
              <Text style={styles.forecastDate}>{day.dateLabel}</Text>
              <Text style={styles.forecastHint}>
                {day.temperatureBand} | Rain chance {day.precipitationRiskPercent}%
              </Text>
            </View>
            <View
              style={[
                styles.forecastBadge,
                { backgroundColor: `${getWeatherTint(day.weatherStatus)}22`, borderColor: `${getWeatherTint(day.weatherStatus)}55` },
              ]}
            >
              <Text style={[styles.forecastBadgeText, { color: getWeatherTint(day.weatherStatus) }]}>
                {day.weatherStatus}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeatherStateCard({
  title,
  description,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.forecastCard}>
      <Text style={styles.cardEyebrow}>Live weather</Text>
      <Text style={styles.forecastTitle}>{title}</Text>
      <Text style={styles.forecastSubtitle}>{description}</Text>

      {loading ? (
        <View style={styles.weatherLoadingRow}>
          <ActivityIndicator color="#00E5A0" />
          <Text style={styles.weatherLoadingText}>Loading weather for your location</Text>
        </View>
      ) : null}

      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.weatherActionBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={styles.weatherActionBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function CreatePolicyRoute() {
  const { user } = useAuth();
  const [recommendation, setRecommendation] = useState<PremiumRecommendation | null>(null);
  const [coveragePerDay, setCoveragePerDay] = useState(0);
  const [premium, setPremium] = useState<PremiumCalculation | null>(null);
  const [lastForecastRisk, setLastForecastRisk] = useState<number | undefined>(undefined);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [currentWeather, setCurrentWeather] = useState<CurrentWeatherSnapshot | null>(null);
  const [weatherLoadState, setWeatherLoadState] = useState<WeatherLoadState>('idle');
  const [weatherErrorMessage, setWeatherErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [buying, setBuying] = useState(false);

  const fetchRecommendation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/premium/recommendation');
      const data = response.data as PremiumRecommendation;
      const hasValidRecommendation =
        Number.isFinite(data?.avgDailyIncome)
        && Number.isFinite(data?.recommended)
        && Number.isFinite(data?.min)
        && Number.isFinite(data?.max)
        && data.avgDailyIncome > 0
        && data.recommended > 0
        && data.max >= data.min;

      const nextRecommendation = hasValidRecommendation
        ? data
        : (
          typeof user?.avgDailyIncome === 'number' && user.avgDailyIncome > 0
            ? buildRecommendationFromIncome(user.avgDailyIncome)
            : null
        );

      if (!nextRecommendation) {
        throw new Error('Coverage recommendation unavailable. Connect rider income first.');
      }
      setRecommendation(nextRecommendation);
      setCoveragePerDay(nextRecommendation.recommended);
    } catch (err: any) {
      if (typeof user?.avgDailyIncome === 'number' && user.avgDailyIncome > 0) {
        const fallbackRecommendation = buildRecommendationFromIncome(user.avgDailyIncome);
        setRecommendation(fallbackRecommendation);
        setCoveragePerDay(fallbackRecommendation.recommended);
      } else {
        Alert.alert(
          'Premium unavailable',
          err.response?.data?.message || err.message || 'Could not load policy recommendation.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [user?.avgDailyIncome]);

  useEffect(() => {
    fetchRecommendation();
  }, [fetchRecommendation]);

  const loadLiveWeather = async () => {
    setWeatherLoadState('locating');
    setWeatherErrorMessage(null);

    try {
      // 1. Get foreground permission (direct check for more reliability)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setWeatherLoadState('permission_denied');
        setWeatherErrorMessage('Location access denied.');
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setWeatherLoadState('gps_unavailable');
        setWeatherErrorMessage('GPS is disabled.');
        return;
      }

      // 2. Get location with fallback
      setWeatherLoadState('loading');
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch {
        location = await Location.getLastKnownPositionAsync({});
      }

      if (!location) {
        throw new Error('GPS position unavailable.');
      }

      const { latitude, longitude } = location.coords;

      // 3. Fetch from Open-Meteo
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relativehumidity_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather API failed.');

      const data = await response.json();

      const currentHourIndex = new Date().getHours();
      setCurrentWeather({
        status: getWeatherCondition(data.hourly.weathercode[currentHourIndex]),
        temperatureLabel: `${Math.round(data.hourly.temperature_2m[currentHourIndex])}°C`,
        feelsLikeLabel: `${Math.round(data.hourly.temperature_2m[currentHourIndex])}°C`,
        humidityLabel: `${data.hourly.relativehumidity_2m[currentHourIndex]}% humidity`
      });

      const mappedForecast: ForecastDay[] = data.daily.time.map((time: string, index: number) => {
        const dateObj = new Date(time);
        const precipitationRisk = data.daily.precipitation_probability_max[index] || 0;

        return {
          id: time,
          dateLabel: index === 0 ? 'Today' : dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
          weatherStatus: getWeatherCondition(data.daily.weathercode[index]),
          temperatureBand: `${Math.round(data.daily.temperature_2m_min[index])}° / ${Math.round(data.daily.temperature_2m_max[index])}°`,
          precipitationRiskPercent: precipitationRisk,
          forecastRisk: clamp(precipitationRisk / 100, 0, 1)
        };
      });

      setForecast(mappedForecast);
      setWeatherLoadState('ready');
      return { forecastDays: mappedForecast };
    } catch (err: any) {
      console.error('Weather error:', err);
      setWeatherLoadState('error');
      setWeatherErrorMessage(err?.message || 'Failed to load weather.');
      throw err;
    }
  };

  const adjustCoverage = (delta: number) => {
    if (!recommendation) return;
    setCoveragePerDay((current) => clamp(current + delta, recommendation.min, recommendation.max));
    setPremium(null);
    setCurrentWeather(null);
    setForecast(null);
    setWeatherLoadState('idle');
  };

  const handleCalculatePremium = async () => {
    setCalculating(true);
    try {
      let forecastRisk: number | undefined;

      try {
        const weatherResult = await loadLiveWeather();
        if (weatherResult && weatherResult.forecastDays.length > 0) {
          forecastRisk = weatherResult.forecastDays[0]?.forecastRisk;
        }
      } catch (weatherErr) {
        console.warn('Weather fetch failed during calculation:', weatherErr);
        forecastRisk = undefined;
      }

      const response = await api.post('/premium/calculate', {
        coveragePerDay,
        forecastRisk,
      });
      setLastForecastRisk(forecastRisk);
      setPremium(response.data as PremiumCalculation);
    } catch (err: any) {
      Alert.alert(
        'Calculation failed',
        err.response?.data?.message || err.message || 'Could not calculate premium.',
      );
    } finally {
      setCalculating(false);
    }
  };

  const handleBuyPremium = async () => {
    if (!premium) return;
    setBuying(true);
    try {
      await api.post('/policy/purchase', {
        coveragePerDay: premium.coveragePerDay,
        forecastRisk: lastForecastRisk,
      });

      Alert.alert('Protection activated', 'Your weekly premium has been purchased.', [
        { text: 'Go to Home', onPress: () => router.replace('/home') },
      ]);
    } catch (err: any) {
      Alert.alert('Purchase failed', err.response?.data?.message || err.message);
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#00E5A0" size="large" />
      </View>
    );
  }

  if (!recommendation) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyTitle}>Policy creation unavailable</Text>
        <TouchableOpacity onPress={() => router.replace('/home')} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Back to home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create policy</Text>
        <Text style={styles.subtitle}>
          Your premium is calculated from your rider profile and live weather data.
        </Text>

        <View style={styles.contextCard}>
          <Text style={styles.cardEyebrow}>Rider context</Text>
          <Text style={styles.contextLine}>Platform: {user?.platform ? user.platform.toUpperCase() : 'Not set'}</Text>
          <Text style={styles.contextLine}>Zone: {formatZoneName(user?.serviceZone)}</Text>
          <Text style={styles.contextLine}>Avg daily income: Rs {recommendation.avgDailyIncome}</Text>
        </View>

        <View style={styles.coverageCard}>
          <Text style={styles.sectionTitle}>Coverage per day</Text>
          <Text style={styles.coverageValue}>Rs {coveragePerDay}</Text>
          <Text style={styles.coverageHint}>
            Recommended: Rs {recommendation.recommended} | Range: Rs {recommendation.min} to Rs {recommendation.max}
          </Text>

          <View style={styles.adjustRow}>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustCoverage(-50)}>
              <Text style={styles.adjustBtnText}>- 50</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustCoverage(50)}>
              <Text style={styles.adjustBtnText}>+ 50</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, calculating && styles.primaryBtnDisabled]}
            onPress={handleCalculatePremium}
            disabled={calculating}
          >
            {calculating ? (
              <ActivityIndicator color="#08110F" />
            ) : (
              <Text style={styles.primaryBtnText}>Calculate premium</Text>
            )}
          </TouchableOpacity>
        </View>

        {premium && (
          <>
            <View style={styles.resultCard}>
              <Text style={styles.cardEyebrow}>Premium result</Text>
              <Text style={styles.premiumValue}>Rs {premium.weeklyPremium.toFixed(2)}</Text>
              <Text style={styles.premiumMeta}>weekly premium for Rs {premium.coveragePerDay} daily coverage</Text>

              <View style={styles.resultGrid}>
                <View style={styles.resultStat}>
                  <Text style={styles.resultStatLabel}>Risk source</Text>
                  <Text style={styles.resultStatValue}>{premium.riskSource === 'ml_model' ? 'ML model' : 'Static fallback'}</Text>
                </View>
                <View style={styles.resultStat}>
                  <Text style={styles.resultStatLabel}>Composite risk</Text>
                  <Text style={styles.resultStatValue}>{premium.composite.toFixed(2)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.purchaseBtn, buying && styles.primaryBtnDisabled]}
                onPress={handleBuyPremium}
                disabled={buying}
              >
                {buying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.purchaseBtnText}>Buy this weekly premium</Text>
                )}
              </TouchableOpacity>
            </View>

            {weatherLoadState === 'locating' && (
              <WeatherStateCard title="Locating..." description="Getting your GPS coordinates." loading />
            )}
            {weatherLoadState === 'loading' && (
              <WeatherStateCard title="Fetching..." description="Loading live weather data." loading />
            )}
            {weatherLoadState === 'permission_denied' && (
              <WeatherStateCard title="Permission Denied" description="Please enable GPS to view weather." actionLabel="Allow access" onAction={loadLiveWeather} />
            )}
            {weatherLoadState === 'ready' && currentWeather && forecast && (
              <WeatherForecastCard currentWeather={currentWeather} forecast={forecast} />
            )}
            {weatherLoadState === 'error' && (
              <WeatherStateCard title="Weather Unavailable" description={weatherErrorMessage || 'Failed to load weather.'} actionLabel="Retry" onAction={loadLiveWeather} />
            )}
            {weatherLoadState === 'gps_unavailable' && (
              <WeatherStateCard title="GPS Disabled" description="Please turn on location services." actionLabel="Retry" onAction={loadLiveWeather} />
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F', paddingHorizontal: 24, gap: 18 },
  content: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  backBtn: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#202634', backgroundColor: '#111723', marginBottom: 18 },
  backBtnText: { color: '#D1D5DB', fontSize: 13, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#7A8597', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  contextCard: { backgroundColor: '#11141B', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#1C2432', marginBottom: 18 },
  cardEyebrow: { color: '#00E5A0', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },
  contextLine: { color: '#D1D5DB', fontSize: 14, marginBottom: 8 },
  coverageCard: { backgroundColor: '#13131A', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1E1E2E', marginBottom: 18 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 14 },
  coverageValue: { color: '#FFFFFF', fontSize: 38, fontWeight: '800', marginBottom: 6 },
  coverageHint: { color: '#7A8597', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  adjustRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  adjustBtn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#293141', backgroundColor: '#0B1017' },
  adjustBtnText: { color: '#D1D5DB', fontSize: 14, fontWeight: '700' },
  primaryBtn: { height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#00E5A0', minWidth: 180 },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: '#08110F', fontSize: 15, fontWeight: '700' },
  resultCard: { backgroundColor: '#0F1F18', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#00E5A033', marginBottom: 18 },
  premiumValue: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', marginBottom: 6 },
  premiumMeta: { color: '#8BA798', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  resultGrid: { flexDirection: 'row', gap: 12 },
  resultStat: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#0B1512' },
  resultStatLabel: { color: '#8BA798', fontSize: 12, marginBottom: 8 },
  resultStatValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  purchaseBtn: { marginTop: 18, height: 54, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1D4ED8' },
  purchaseBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  forecastCard: { backgroundColor: '#13131A', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1E1E2E' },
  forecastTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  forecastSubtitle: { color: '#7A8597', fontSize: 13, lineHeight: 19, marginBottom: 16 },
  currentWeatherCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 16, padding: 16, backgroundColor: '#0B1512', borderWidth: 1, borderColor: '#1E2E26', marginBottom: 14, gap: 12 },
  currentWeatherLabel: { color: '#8BA798', fontSize: 12, marginBottom: 6 },
  currentWeatherValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  currentWeatherMeta: { color: '#9FB7AB', fontSize: 12 },
  currentWeatherRight: { alignItems: 'flex-end' },
  currentWeatherTemp: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 4 },
  currentWeatherFeelsLike: { color: '#9FB7AB', fontSize: 12 },
  forecastList: { gap: 10 },
  forecastRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, backgroundColor: '#0B1017', borderWidth: 1, borderColor: '#1C2432' },
  forecastDate: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  forecastHint: { color: '#6B7280', fontSize: 12 },
  forecastBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  forecastBadgeText: { fontSize: 12, fontWeight: '700' },
  weatherLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  weatherLoadingText: { color: '#9FB7AB', fontSize: 13 },
  weatherActionBtn: { alignSelf: 'flex-start', marginTop: 4, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#00E5A0' },
  weatherActionBtnText: { color: '#08110F', fontSize: 13, fontWeight: '700' },
  emptyTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', textAlign: 'center' },
});
