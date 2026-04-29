-- Merchant discovery queue: stores unmatched OSM merchants for later classification
CREATE TABLE IF NOT EXISTS merchant_discovery_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  osm_name        TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  osm_category    TEXT,
  seen_count      INTEGER NOT NULL DEFAULT 1,
  first_seen_at   TIMESTAMPTZ DEFAULT now(),
  last_seen_at    TIMESTAMPTZ DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'added', 'rejected', 'duplicate')),
  notes           TEXT,
  UNIQUE (normalized_name)
);

-- RPC for atomic upsert-with-increment.
-- Plain .upsert() replaces rows; it cannot do seen_count += 1.
CREATE OR REPLACE FUNCTION upsert_discovered_merchants(rows JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r JSONB;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(rows)
  LOOP
    INSERT INTO merchant_discovery_queue (osm_name, normalized_name, osm_category)
    VALUES (r->>'osm_name', r->>'normalized_name', r->>'osm_category')
    ON CONFLICT (normalized_name) DO UPDATE
      SET seen_count   = merchant_discovery_queue.seen_count + 1,
          last_seen_at = now();
  END LOOP;
END;
$$;
