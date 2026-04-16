# QuickShield

QuickShield is a monorepo prototype for a parametric insurance product aimed at gig-delivery riders. The current repository contains a working mobile app, a NestJS backend, and a Python ML microservice, but several rider-income and disruption flows are still backed by mock data.

## Repository layout

- `QuickShield/`: Expo Router mobile app
- `Backend/`: NestJS API with Prisma/PostgreSQL
- `ml-service/`: FastAPI risk-scoring service

## Architecture

```text
Expo mobile app -> NestJS API -> PostgreSQL
                       |
                       -> FastAPI ML service
```

## Current implemented flow

1. User signs in with Google or phone OTP.
2. User selects platform and service zone.
3. Backend stores a rider profile and computes coverage recommendations.
4. Policy purchase calls the ML service for pricing inputs.
5. The app can simulate rain-triggered claim credit using mock weather data.

## Important prototype limitations

- Platform connection currently generates mock earnings and working shifts.
- Weather and rain-disruption monitoring use mock forecast data.
- The dedicated claims and trigger services are not fully implemented yet.
- ML training uses synthetic data rather than production historical data.

## Setup

### 1. Backend

```bash
cd Backend
cp .env.example .env
npm install
npm run dev
```

Required backend env vars:

- `DATABASE_URL`
- `JWT_SECRET`
- `GOOGLE_WEB_CLIENT_ID`
- `ML_SERVICE_URL`

### 2. ML service

```bash
cd ml-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python train.py
uvicorn main:app --reload --port 5001
```

### 3. Mobile app

```bash
cd QuickShield
cp .env.example .env
npm install
npx expo start
```

Required mobile env vars:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

## Verification

- Mobile lint: `cd QuickShield && npm run lint`
- Backend typecheck: `cd Backend && npx tsc --noEmit`
- ML syntax check: `cd ml-service && python3 -m py_compile main.py train.py`

Week 1-2:

- Define schema
- Setup backend APIs
- Mock trigger services

Week 3-4:

- Implement policy engine
- Integrate APIs
- Build claims system

### Phase 1: Foundation

Completed deliverables:

- Product strategy and concept definition
- Repository setup and documentation
- Initial demo planning

### Phase 2: Core Product

Planned deliverables:

- Registration and authentication
- Earnings import and rider profile creation
- Policy creation and premium calculation
- Trigger detection services
- Basic automated claims flow

### Phase 3: Production Readiness

Planned deliverables:

- Fraud detection services
- Instant payout workflows
- Admin and rider dashboards
- ML-assisted pricing refinement

## Target Project Structure

The structure below represents the intended implementation layout for the full product:

```text
quickshield/
├── backend/
│   ├── src/
│   │   ├── auth/
│   │   ├── profile/
│   │   ├── policy/
│   │   ├── triggers/
│   │   ├── claims/
│   │   └── prisma/
│   │       └── schema.prisma
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── services/
│   │   └── components/
├── docs/
└── README.md
```

## Success Metrics

### Rider App

- Weekly income protected
- Number of disrupted hours covered
- Active protection rate and daily cap
- Timeline of rain, app outage, and closure events

### Admin Dashboard

- Loss ratio by zone
- Trigger type distribution
- Rider segment performance
- Fraud and anomaly alerts

## Adversarial Defense and Anti-Spoofing Strategy

### Threat Model

Some malicious riders may use GPS-spoofing tools to fake presence inside an affected zone during a disruption window. If the system trusts location data blindly, it could approve false payouts and weaken the sustainability of the pool.

### Core Defense Principle

No payout decision should rely on a single signal. QuickShield should validate claims using multiple independent signals across location, activity, device behavior, and service-zone consistency.

### Validation Layers

- GPS validation: Confirm the rider device was present inside the impacted micro-zone during the disruption window.
- Platform activity correlation: Match pickup, drop, or order-assignment logs against the same zone and time range.
- Operating-area consistency: Compare the impacted zone against the rider's registered service area and historical working zone.
- Behavioral consistency: Detect impossible jumps, static spoof patterns, or unrealistic speeds.
- Device and network checks: Review location drift, sensor consistency, and abrupt cross-zone changes that suggest manipulation.

### Advanced Differentiation Logic

QuickShield differentiates between genuine riders and spoofers using behavioral and contextual validation.

- Movement consistency: Real riders show continuous movement across delivery routes, while spoofers often show static positions or unrealistic jumps.
- Order activity correlation: Genuine riders usually have matching pickup or drop activity during the disruption window. Missing or contradictory activity increases fraud risk.

### Multi-Signal Data Validation

Beyond GPS, the system should analyze:

- Platform order logs (pickup/drop timestamps)
- Historical rider activity patterns
- Device-level signals (speed, location drift)
- Network consistency (sudden jumps across distant zones)

This multi-signal approach reduces reliance on spoofable GPS data.

### Fair UX for Flagged Claims

To avoid penalizing honest riders, the review flow should remain user-safe and explainable.

- Soft flagging: Suspicious claims are held for review instead of being rejected immediately.
- Manual review: Flagged cases are checked using additional evidence and rule-based audit trails.
- User transparency: Riders are informed that the claim is under verification because of unusual activity.
- Retry mechanism: Riders can revalidate by sharing additional supporting data or activity evidence.

### Decision Outcomes

- Approve automatically when signals are consistent across zone, time, and rider activity.
- Hold for review when one or more signals conflict but fraud is not yet certain.
- Reject when evidence strongly indicates spoofing, impossible movement, or zone mismatch.

## Why This Product Matters

Gig workers face income volatility from events they cannot control. Traditional insurance models are poorly aligned with short-term, hourly income interruptions. QuickShield addresses that gap with a product that is:

- Fast to activate
- Easy to price weekly
- Automated in claims handling
- Grounded in verifiable external data

The long-term goal is to create a reliable financial safety net for high-frequency, low-margin workers who are currently underserved by mainstream insurance products.

## One-Line Summary

AI-powered parametric insurance that automatically compensates gig workers for hourly income loss using real-time disruption triggers.
