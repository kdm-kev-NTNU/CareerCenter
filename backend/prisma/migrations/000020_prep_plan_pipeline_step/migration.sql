ALTER TABLE "InterviewPrepPlan" ADD COLUMN "pipelineStep" TEXT NOT NULL DEFAULT 'created';

UPDATE "InterviewPrepPlan"
SET "pipelineStep" = CASE "status"
  WHEN 'researching' THEN 'searching'
  WHEN 'awaiting_answers' THEN 'awaiting_answers'
  WHEN 'curating' THEN 'curating_questions'
  WHEN 'ready' THEN 'ready'
  ELSE 'created'
END;
