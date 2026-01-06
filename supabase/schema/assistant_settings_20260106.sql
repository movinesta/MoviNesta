-- Assistant settings storage for admin-managed OpenRouter configuration.

CREATE TABLE IF NOT EXISTS public.assistant_settings (
    id integer NOT NULL,
    openrouter_base_url text,
    model_fast text,
    model_creative text,
    model_planner text,
    model_maker text,
    model_critic text,
    fallback_models text[] DEFAULT '{}'::text[] NOT NULL,
    model_catalog text[] DEFAULT '{}'::text[] NOT NULL,
    default_instructions text,
    params jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT assistant_settings_id_check CHECK ((id = 1))
);

ALTER TABLE public.assistant_settings OWNER TO postgres;

ALTER TABLE ONLY public.assistant_settings
    ADD CONSTRAINT assistant_settings_pkey PRIMARY KEY (id);

CREATE TRIGGER trg_assistant_settings_touch
BEFORE UPDATE ON public.assistant_settings
FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

ALTER TABLE public.assistant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY assistant_settings_service_role_rw
    ON public.assistant_settings
    TO service_role
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.assistant_settings TO service_role;
