-- Cancel duplicate schedules to ensure migration succeeds
WITH RankedSchedules AS (
  SELECT id, ROW_NUMBER() OVER(PARTITION BY "recoveryCaseId" ORDER BY "createdAt" DESC) as rnk
  FROM "RecoverySchedule" WHERE status = 'SCHEDULED'
)
UPDATE "RecoverySchedule" SET status = 'CANCELLED' WHERE id IN (SELECT id FROM RankedSchedules WHERE rnk > 1);

-- Create partial unique index
CREATE UNIQUE INDEX "unique_active_schedule_per_case" 
ON "RecoverySchedule"("recoveryCaseId") 
WHERE status = 'SCHEDULED';