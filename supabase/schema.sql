-- KRB Supabase schema
-- Run this in the Supabase SQL editor after creating a new project

-- Designs table
CREATE TABLE IF NOT EXISTS designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled Design',
  canvas_json text,
  paper_size text NOT NULL DEFAULT 'A5',
  numbering_config jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: users can only see/edit their own designs
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "designs: user owns row"
  ON designs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'starter', 'pro')),
  status text NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  UNIQUE (user_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions: user reads own"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_monthly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL,  -- YYYY-MM
  designs_created integer NOT NULL DEFAULT 0,
  ai_generations_used integer NOT NULL DEFAULT 0,
  UNIQUE (user_id, month)
);

ALTER TABLE usage_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_monthly: user reads own"
  ON usage_monthly FOR SELECT
  USING (auth.uid() = user_id);

-- Atomic AI usage increment function (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id uuid)
RETURNS void AS $$
  INSERT INTO usage_monthly (user_id, month, ai_generations_used)
  VALUES (p_user_id, to_char(now(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET ai_generations_used = usage_monthly.ai_generations_used + 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto-update updated_at on designs
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER designs_updated_at
  BEFORE UPDATE ON designs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
