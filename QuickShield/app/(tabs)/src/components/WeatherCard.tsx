import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type HourlyData = {
  time: string;
  temp: number;
  icon: keyof typeof Ionicons.glyphMap;
};

type WeatherDay = {
  date: string;
  fullDate: string;
  temp: number;
  condition: string;
  icon: keyof typeof Ionicons.glyphMap;
  hourly: HourlyData[];
};

const getWeatherIcon = (code: number): keyof typeof Ionicons.glyphMap => {
  if (code === 0) return 'sunny';
  if (code >= 1 && code <= 3) return 'partly-sunny';
  if (code === 45 || code === 48) return 'cloudy';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rainy';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'thunderstorm';
  return 'help-circle';
};

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

export default function WeatherCard() {
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState<WeatherDay[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Get permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Please enable location in settings.');
        setLoading(false);
        return;
      }

      // 2. Get location with timeout and lower accuracy for speed
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (locErr) {
        // Fallback to last known position if current is failing
        location = await Location.getLastKnownPositionAsync({});
      }

      if (!location) {
        setError('Could not determine your location. Please check your GPS.');
        setLoading(false);
        return;
      }

      const { latitude, longitude } = location.coords;

      // 3. Fetch from Open-Meteo using native fetch
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const { daily, hourly } = data;

      if (!daily || !hourly) {
        throw new Error('Invalid data format received from weather service');
      }

      // 4. Process data
      const processedDays: WeatherDay[] = daily.time.map((dateStr: string, index: number) => {
        const dateObj = new Date(dateStr);
        const dayName = index === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

        // Open-Meteo dates are YYYY-MM-DD. Hourly times are YYYY-MM-DDTHH:mm.
        // We can filter by checking if hTime starts with dateStr.
        const dayHourly: HourlyData[] = hourly.time
          .map((hTime: string, hIndex: number) => ({
            time: hTime,
            temp: Math.round(hourly.temperature_2m[hIndex]),
            icon: getWeatherIcon(hourly.weathercode[hIndex]),
          }))
          .filter((h: any) => h.time.startsWith(dateStr))
          .map((h: any) => {
            // Extract HH:mm from "2023-10-27T14:00"
            const timePart = h.time.split('T')[1];
            return {
              ...h,
              time: timePart,
            };
          })
          .filter((_: any, i: number) => i % 3 === 0); // Sample every 3 hours

        return {
          date: dayName,
          fullDate: dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
          temp: Math.round(daily.temperature_2m_max[index]),
          condition: getWeatherCondition(daily.weathercode[index]),
          icon: getWeatherIcon(daily.weathercode[index]),
          hourly: dayHourly,
        };
      });

      setWeatherData(processedDays);
    } catch (err: any) {
      console.error('Weather Fetch Error:', err);
      setError(err.message || 'Failed to fetch real-time weather. Tap to retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const handleDayPress = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedDayIndex(selectedDayIndex === index ? null : index);
  };

  if (loading) {
    return (
      <View style={[styles.card, styles.center]}>
        <ActivityIndicator color="#00E5A0" />
        <Text style={styles.loadingText}>Fetching live weather...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <TouchableOpacity onPress={fetchWeather} activeOpacity={0.8} style={[styles.card, styles.center]}>
        <Ionicons name="cloud-offline" size={40} color="#FCA5A5" />
        <Text style={styles.errorText}>{error}</Text>
        <View style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const selectedDay = selectedDayIndex !== null ? weatherData[selectedDayIndex] : null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Live Forecast</Text>
          <Text style={styles.title}>7-Day Outlook</Text>
        </View>
        <TouchableOpacity onPress={fetchWeather} activeOpacity={0.6} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color="#00E5A0" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.forecastContainer}
      >
        {weatherData.map((day, index) => {
          const isSelected = selectedDayIndex === index;
          return (
            <TouchableOpacity
              key={index}
              activeOpacity={0.7}
              onPress={() => handleDayPress(index)}
              style={[
                styles.dayColumn,
                isSelected && styles.dayColumnSelected
              ]}
            >
              <Text style={[styles.dayDate, isSelected && styles.textActive]}>{day.date}</Text>
              <Ionicons
                name={day.icon}
                size={24}
                color={isSelected ? "#00E5A0" : "#FFFFFF"}
                style={styles.icon}
              />
              <Text style={[styles.dayTemp, isSelected && styles.textActive]}>{day.temp}°</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {selectedDay && (
        <View style={styles.hourlyContainer}>
          <View style={styles.hourlyHeader}>
            <Text style={styles.hourlyTitle}>Hourly: {selectedDay.fullDate}</Text>
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionText}>{selectedDay.condition}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyScroll}>
            {selectedDay.hourly.map((hour, idx) => (
              <View key={idx} style={styles.hourItem}>
                <Text style={styles.hourTime}>{hour.time}</Text>
                <Ionicons
                  name={hour.icon}
                  size={22}
                  color={hour.icon === 'sunny' ? '#FCD34D' : (hour.icon.includes('rain') ? '#60A5FA' : '#8B949E')}
                  style={styles.hourIcon}
                />
                <Text style={styles.hourTemp}>{hour.temp}°</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.footer}>
        <Ionicons name="information-circle-outline" size={14} color="#8B949E" style={{ marginRight: 6 }} />
        <Text style={styles.caption}>
          {selectedDayIndex === 0 ? 'Showing data for your current location.' : `Forecast for ${selectedDay?.date}.`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161B22',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#30363D',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  center: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8B949E',
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#FCA5A5',
    marginTop: 12,
    textAlign: 'center',
    fontSize: 14,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#21262D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  refreshBtn: {
    padding: 4,
  },
  eyebrow: {
    color: '#00E5A0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  forecastContainer: {
    gap: 12,
    paddingRight: 10,
    paddingBottom: 4,
  },
  dayColumn: {
    alignItems: 'center',
    minWidth: 54,
    backgroundColor: '#1C2128',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#30363D',
  },
  dayColumnSelected: {
    borderColor: '#00E5A0',
    backgroundColor: '#00E5A015',
  },
  textActive: {
    color: '#00E5A0',
    fontWeight: '700',
  },
  dayDate: {
    color: '#8B949E',
    fontSize: 12,
    marginBottom: 6,
  },
  icon: {
    marginVertical: 10,
  },
  dayTemp: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  hourlyContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
  },
  hourlyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  hourlyTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  conditionBadge: {
    backgroundColor: '#00E5A015',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  conditionText: {
    color: '#00E5A0',
    fontSize: 12,
    fontWeight: '700',
  },
  hourlyScroll: {
    paddingRight: 10,
    paddingBottom: 4,
  },
  hourItem: {
    alignItems: 'center',
    marginRight: 14,
    backgroundColor: '#0D1117',
    padding: 12,
    borderRadius: 14,
    minWidth: 64,
    borderWidth: 1,
    borderColor: '#21262D',
  },
  hourTime: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  hourIcon: {
    marginVertical: 4,
  },
  hourTemp: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#30363D',
    flexDirection: 'row',
    alignItems: 'center',
  },
  caption: {
    color: '#8B949E',
    fontSize: 13,
    lineHeight: 18,
  },
});
