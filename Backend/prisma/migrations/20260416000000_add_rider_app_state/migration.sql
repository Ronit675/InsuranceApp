CREATE TABLE "RiderAppState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flagCount" INTEGER NOT NULL DEFAULT 0,
    "currentFlagLevel" TEXT NOT NULL DEFAULT 'none',
    "currentReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentStatusText" TEXT NOT NULL DEFAULT 'GPS check inactive',
    "lastCheckedAt" TIMESTAMP(3),
    "redFlagDetectedAt" TIMESTAMP(3),
    "normalizedAfterRedAt" TIMESTAMP(3),
    "outOfStationActive" BOOLEAN NOT NULL DEFAULT false,
    "outOfStationSince" TIMESTAMP(3),
    "outOfStationUntil" TIMESTAMP(3),
    "outOfStationReturnLabel" TEXT,
    "appBackToNormalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiderAppState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FlagEvent" (
    "id" TEXT NOT NULL,
    "appStateId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlagEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RiderAppState_userId_key" ON "RiderAppState"("userId");
CREATE UNIQUE INDEX "FlagEvent_appStateId_reason_detectedAt_key" ON "FlagEvent"("appStateId", "reason", "detectedAt");
CREATE INDEX "FlagEvent_appStateId_detectedAt_idx" ON "FlagEvent"("appStateId", "detectedAt");

ALTER TABLE "RiderAppState"
ADD CONSTRAINT "RiderAppState_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FlagEvent"
ADD CONSTRAINT "FlagEvent_appStateId_fkey"
FOREIGN KEY ("appStateId") REFERENCES "RiderAppState"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
