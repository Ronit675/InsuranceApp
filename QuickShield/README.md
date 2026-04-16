# QuickShield Mobile App

Expo Router mobile client for the QuickShield prototype.

## Prerequisites

- Node.js 20+
- npm
- Expo development environment
- Backend running on port `3000`

## Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required variables:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

Notes:

- In development, `EXPO_PUBLIC_API_URL` can be omitted and the app will infer the Expo host machine URL.
- Google Sign-In requires a development build. It will not complete inside Expo Go.

## Install and run

```bash
npm install
npx expo start
```

Useful scripts:

- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run lint`

## App structure

- `app/`: Expo Router entrypoints and routes
- `app/(tabs)/src/screens/`: screen implementations
- `app/(tabs)/src/services/`: API, auth, weather, location, and policy helpers
- `app/(tabs)/src/context/`: auth state
- `app/(tabs)/src/directory/`: language state and translations

## Current prototype scope

- Google and phone OTP authentication
- Rider onboarding for platform and service zone
- Premium recommendation and policy purchase
- Policy history and auto-renew toggle
- Mock weather-driven rain disruption tracking

The weather, rider-platform connection, and rain-claim flows are still prototype flows backed by mock data.
