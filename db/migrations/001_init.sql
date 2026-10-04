CREATE TABLE IF NOT EXISTS targets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id     text NOT NULL,
  purl       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cve_id, purl)
);

CREATE TABLE IF NOT EXISTS runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id   uuid NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  status      text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  session_id  text,
  stage       text,
  label       text,
  assessment  jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS runs_target_created ON runs (target_id, created_at DESC);
