
-- 1. Enums
CREATE TYPE public.billing_interval AS ENUM ('monthly', 'yearly');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
CREATE TYPE public.billing_provider AS ENUM ('stripe', 'manual');
CREATE TYPE public.currency_code AS ENUM ('eur', 'usd');

-- 2. subscription_plans (catalog, not account-scoped)
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  currency public.currency_code NOT NULL DEFAULT 'eur',
  billing_interval public.billing_interval NOT NULL DEFAULT 'monthly',
  included_calls_per_month INTEGER NOT NULL DEFAULT 0,
  included_phone_numbers INTEGER NOT NULL DEFAULT 1,
  features_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_price_non_negative CHECK (price_cents >= 0),
  CONSTRAINT chk_included_calls_non_negative CHECK (included_calls_per_month >= 0),
  CONSTRAINT chk_included_phones_positive CHECK (included_phone_numbers >= 1)
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Plans are readable by all authenticated users (catalog)
CREATE POLICY "Authenticated users can view plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE via RLS — managed by service-role only

CREATE INDEX idx_plans_active ON public.subscription_plans(active) WHERE active = true;

-- 3. subscriptions
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  subscription_plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  provider public.billing_provider NOT NULL DEFAULT 'stripe',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  status public.subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Owners can view and manage
CREATE POLICY "Owners can view subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members
    WHERE account_id = subscriptions.account_id AND profile_id = auth.uid() AND role = 'owner'
  ));

CREATE POLICY "Admins can view subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

-- No INSERT/UPDATE/DELETE via authenticated RLS — managed by service-role/webhooks only

CREATE UNIQUE INDEX uq_subscription_account ON public.subscriptions(account_id) WHERE status IN ('trialing', 'active', 'past_due', 'incomplete');
CREATE INDEX idx_subscriptions_provider_customer ON public.subscriptions(provider, provider_customer_id) WHERE provider_customer_id IS NOT NULL;
CREATE INDEX idx_subscriptions_provider_sub ON public.subscriptions(provider, provider_subscription_id) WHERE provider_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. usage_counters
CREATE TABLE public.usage_counters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_month DATE NOT NULL,
  inbound_calls_count INTEGER NOT NULL DEFAULT 0,
  outbound_calls_count INTEGER NOT NULL DEFAULT 0,
  handled_calls_count INTEGER NOT NULL DEFAULT 0,
  escalations_count INTEGER NOT NULL DEFAULT 0,
  booked_appointments_count INTEGER NOT NULL DEFAULT 0,
  assistant_minutes_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_inbound_non_negative CHECK (inbound_calls_count >= 0),
  CONSTRAINT chk_outbound_non_negative CHECK (outbound_calls_count >= 0),
  CONSTRAINT chk_handled_non_negative CHECK (handled_calls_count >= 0),
  CONSTRAINT chk_escalations_non_negative CHECK (escalations_count >= 0),
  CONSTRAINT chk_booked_non_negative CHECK (booked_appointments_count >= 0),
  CONSTRAINT chk_minutes_non_negative CHECK (assistant_minutes_total >= 0),
  CONSTRAINT chk_period_first_of_month CHECK (period_month = date_trunc('month', period_month)::date)
);

ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- All members can view usage (for dashboard)
CREATE POLICY "Members can view usage counters" ON public.usage_counters
  FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

-- No INSERT/UPDATE/DELETE via authenticated RLS — managed by service-role only

CREATE UNIQUE INDEX uq_usage_account_month ON public.usage_counters(account_id, period_month);
CREATE INDEX idx_usage_period ON public.usage_counters(period_month DESC);

CREATE TRIGGER update_usage_counters_updated_at
  BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
