# QuickShield - Income Protection for Q‑Commerce Delivery Partners

- **Persona** : An AI-enabled parametric insurance platform that safeguards gig workers against income loss caused by external disruptions such as extreme weather or environmental conditions.
- **Team** : 3Three
- **Github** : 
- **Video Link** : 

## 🎯 Problem & Persona

Q‑commerce riders (Zepto/Blinkit etc.) operate in tight time windows, high-speed, hyperlocal zones.
Their weekly income drops sharply when external disruptions hit:

- Sudden Heavy rain or waterlogging(monsoon: June-Sep) -> orders paused in specific micro-zones.
- Unplanned curfews/strikes → instant “dark” zones
- App Failure or maintainance

*Current Reality* : A typical rider works 7–10 hours/day, 6 days/week.
Losing 2–3 peak hours can mean ₹400–₹700 lost in a single evening, with no safety net

*Our Solution* : Parametric insurance covering hourly lost income from these external triggers, with weekly pricing perfectly to their cashflow cycle.

## 🧩 Core Idea
- Scope: Protect only loss of income from external disruptions (no health, accident,  vehicle repair, or medical coverage).

- Model: Weekly premium aligned to rider payout cycle, with dynamic pricing based on zone risk and forecasted conditions.

- Mechanism: Parametric triggers (weather, curfew, app outage) auto‑initiate claims; payouts are proportional to disrupted time slots, not whole days. 

## Tech Stack

| Layer         | Choice                                                    |
| ------------- | ----------------------------------------------------------|
| Mobile App    | React Native + TypeScript                                 |
| Backend       | NestJS (Node.js + TypeScript)                             |
| ORM / DB      | Prisma + PostgreSQL                                       |
| Payments      | Razorpay / Stripe / UPI sandbox (instant payout)          |
| External Data | Weather APIs, Traffic APIs, mock Q‑commerce platform APIs |

## Solution Architecture

React Native Mobile App  ↔  NestJS + Node.js REST APIs
                               ↓
                    PostgreSQL (Prisma ORM)
                               ↓
   Weather & Traffic APIs · Mock Platform APIs · Payment Gateway Sandbox


## Smart Coverage Selection + Weekly Premium Model

1. *Auto-Calculate Average Daily Earnings from Platform Data*
   We pull last 4-8 weeks earnings from zepto/Blinkit APIs: 
   "Based on your Zepto earnings: Average daily income = ₹850"
   "Recommended protection: ₹750/day (90% of your average)"

2. *Hybrid Selection: Auto Suggest + User Control*
   Default: Auto protect 80-90% of their verified average
   Slider: User can adjust within safe limits (60-120% of average)

   Rider sees:
   "Typical daily earnings: ₹850 (Zepto data)"
   "🔵 Recommended: Protect ₹750/day"  ← Pre-filled slider
   "Slider range: ₹510–₹1,020 (60–120% of average)"

   Why limits?
   • Minimum 60%: Product stays useful
   • Maximum 120%: Prevents over-insurance/fraud

3. *Dynamic Weekly Premium Formula*
  Simple, dynamic pricing calculated at policy creation + weekly renewal:

  Weekly Premium = Base Premium x Risk Factor x Coverage Factor

  *Example for Zepto Bengaluru rider*
   Base Rate: ₹35/week (reference ₹600/day coverage)
   Coverage Factor: 750/600 = 1.25
   Risk Factor: 1.2 (high rain forecast this week)
   → Weekly Premium = ₹35 × 1.25 × 1.2 = ₹52.50 ≈ ₹53

   - Risk factor will be calculated with the help of Risk Score for the upcoming week.
                Risk Score∈[0,1] → Risk Factor ∈ [0.8,1.5]

   - Coverage Factor = Choosen protection rate / reference rate
   For eg. for ₹800/day vs a reference ₹600/day = 800/600 ≈ 1.33.

   - Risk Score inputs :
     - Zone Risk : Historical rain/curfew data for their pincode cluster
     - Forecast Risk : next 7 days of rain/extreme heat, especially in peak delivery slots.
     - Exposure: Their declared weekly hours (8 hrs/day × 6 days)

  For the App Crash:
  claim_amount = policy.hourly_protection × disrupted_hours

  Run Fraud Cheeck: 
    fraud_score = fraud_engine.compute(claim)
      IF fraud_score > 0.6:
        manual_review()
      ELSE:
        approve_auto()

  Scenario: Blinkit outage during evening peak
  ├── Outage detected: 6:30–8:00 PM (1.5 hrs) ✓
  ├── Rider status: Available in S3 slot (4–8 PM) ✓
  ├── Slot overlap: 1.5 hrs ✓
  ├── Hourly coverage: ₹150/hr ✓
  ├── Fraud score: 0.12 (genuine) ✓
  └── Payout: ₹150 × 1.5 = ₹225 💰


## Parametric Triggers
We mode diruptions at time-slot level because Q-commerce is very time sensitive.

4 Daily slots (Q-commerce peak sensitivity):

| Slot | Time       | Weight                 |
| ---- | ---------- | ---------------------- |
| S1   | 6–10 AM    | Morning rush           |
| S2   | 10 AM–4 PM | Off-peak               |
| S3   | 4–8 PM     | Evening peak (highest) |
| S4   | 8 PM–12 AM | Late night             |

3 Automated triggers 

| Trigger      | Source                 | Threshold              | Payout               |
| ------------ | ---------------------- | ---------------------- | -------------------- |
| Heavy Rain   | OpenWeatherMap         | >25mm/hr in zone       | Affected slots       |
| App Failure  | Timeout Errors         | order_volume_drop >70% | Affected slots       |
| Zone Closure | Mock civic/traffic API | Orders drop >70%       | Dark zone            |

Partial payout example: S3 (4–8 PM) rain 6–7 PM → 1 disrupted hour → ₹125 payout (not full day).

## AI/ML Integration Plan
- Phase 2: Dynamic Pricing ML
  XGBoost: zone_history + weather_forecast + slot_pattern → Expected loss next week → Risk Factor

- Phase 3: Fraud Detection 
  1. Anomaly: Rider claims S3 disruption when zone had normal orders
  2. GPS: Must be in affected micro-zone during trigger window
  3. Cohort: Claims > 2σ above peers flagged


## 📱 Key User Flows
1. Onboarding (90 seconds)
   - "Connect Zepto" → Pull earnings data
   - "Your avg: ₹850/day. Recommended: ₹750 protection" ✅ Pre-filled
   - Adjust slider (₹510–₹1,020 range)
   - "Weekly premium: ₹53" → UPI payment

2. Zero touch claims 
   6:30 PM: Rain trigger → S3 partially disrupted (1 hr)
   System: Auto-claim → GPS validates → ₹125 instant payout
   Notification: "Rain protected: ₹125 in your UPI"

3. Weekly Renewal 
   "Next week: ₹5,400 max protection, ₹49 premium (low rain risk)"
   Auto-renew toggle

## 🛠️ Implementation Plan

- Phase 1: Foundation (✅ COMPLETE)
Week 1-2 (Mar 4-20)
✅ README with full strategy + justification
✅ Git repo with readme file
✅ 2-min demo video (screen recording)

- Phase 2: Core Product (Mar 21 - Apr 4)
| Week   | Deliverables                   | Tech Implementation                                                               |
| ------ | ------------------------------ | --------------------------------------------------------------------------------- |
| Week 3 | Registration + Policy Creation | - React Native: Onboarding screens- NestJS: /auth/register,                       |
|        |                                |   /profile/zepto-connect- Prisma: User, Profile tables                            |
| Week 4 | Dynamic Premium + Claims       | - Premium calculator endpoint /policy/calculate- 3 trigger services               |
|        |                                |   (weather.service.ts, traffic.service.ts)- Basic claim flow /claims/auto-trigger |

Phase 2 Demo: 2-min video showing full onboarding → premium calc → simulated rain trigger → claim notification.

- Phase 3: Production Ready (Apr 5 - 17)
| Feature         | Backend                             | Frontend                 | APIs                    |
| --------------- | ----------------------------------- | ------------------------ | ----------------------- |
| Fraud Detection | fraud.service.ts (Isolation Forest) | GPS validation screen    | Location during trigger |
| Instant Payouts | Razorpay webhooks                   | UPI deep links           | /payments/payout        |
| Dashboards      | Admin endpoints                     | Rider dashboard screens  | Charts, metrics         |
| ML Pricing      | XGBoost model (Python → API)        | Live risk factor display | /ml/risk-score          |

Phase 3 Demo: 5-min video with live simulated rainstorm → auto-claim → fraud check → instant UPI payout.

*File Structure*

quickshield/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── auth/             # JWT login/register
│   │   ├── profile/          # Zepto earnings import
│   │   ├── policy/           # Weekly premium calc
│   │   ├── triggers/         # Weather/AQI services
│   │   ├── claims/           # Parametric engine
│   │   └── prisma/
│   │       └── schema.prisma # User, PolicyWeek, Claim
├── mobile/                    # React Native
│   ├── src/
│   │   ├── screens/          # Onboarding, Dashboard
│   │   ├── services/         # API client, push notifications
│   │   └── components/       # Coverage slider, slot picker
├── docs/                      # Wireframes, API docs
└── README.md                  # This file


## Success Metrices (For Dashboard)
Rider App: 
 - "This week: ₹1,050 protected (7 disrupted hours)."
 - "Active coverage: ₹150/hr, max 6 hours/day."
 - Timeline of disruptions (rain, curfew, outage).

Admin Portal (later phase):
 - Loss ratio by zone, trigger type, rider segment.
 - Heatmap of disruptions frequency across city.
 - Fraud/anamoly alerts.

## Adversarial Defense & Anti-Spoofing Strategy
If a user claims for the protection by using advanced GPS-spoofing applications to fake their locations. While resting safely at home, they are tricking the system into believing they are trapped in a severe, red-alert weather zone, triggering mass false payouts and instantly draining the liquidity pool.

In this situation 
