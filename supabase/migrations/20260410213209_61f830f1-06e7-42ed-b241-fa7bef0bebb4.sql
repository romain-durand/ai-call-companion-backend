CREATE TYPE public.assistant_control_mode AS ENUM ('strict_policy', 'model_discretion');

ALTER TABLE public.assistant_modes
ADD COLUMN control_mode public.assistant_control_mode NOT NULL DEFAULT 'strict_policy';