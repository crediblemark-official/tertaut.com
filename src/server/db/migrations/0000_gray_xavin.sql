CREATE TABLE "builders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"api_key" text NOT NULL,
	"disbursement_account" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "builders_email_unique" UNIQUE("email"),
	CONSTRAINT "builders_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"builder_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"mode" text DEFAULT 'live' NOT NULL,
	"target_price" integer DEFAULT 0 NOT NULL,
	"description" text,
	"headline" text,
	"subheadline" text,
	"media_url" text,
	"value_props" jsonb,
	"cta_text" text DEFAULT 'Beli Sekarang',
	"custom_intent_message" text,
	"page_blocks" jsonb,
	"custom_html" text,
	"capture_config" jsonb,
	"webhook_url" text,
	"redirect_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"builder_id" uuid NOT NULL,
	"xendit_invoice_id" text,
	"xendit_external_id" text NOT NULL,
	"xendit_invoice_url" text,
	"customer_email" text NOT NULL,
	"gross_amount" integer NOT NULL,
	"platform_fee" integer NOT NULL,
	"net_amount" integer NOT NULL,
	"payment_channel" text,
	"payment_status" text DEFAULT 'PENDING' NOT NULL,
	"disbursement_status" text DEFAULT 'PENDING' NOT NULL,
	"disbursement_id" text,
	"grant_days" integer DEFAULT 30,
	"grant_credits" integer DEFAULT 0,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_xendit_invoice_id_unique" UNIQUE("xendit_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "license_activations" (
	"id" text PRIMARY KEY NOT NULL,
	"license_id" text NOT NULL,
	"hwid_hash" text NOT NULL,
	"device_name" text,
	"ip_address" text,
	"last_validated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_license_hwid" UNIQUE("license_id","hwid_hash")
);
--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"transaction_id" text,
	"license_key" text NOT NULL,
	"customer_email" text NOT NULL,
	"hardware_id" text,
	"platform" text DEFAULT 'general',
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"max_seats" integer DEFAULT 3 NOT NULL,
	"expires_at" timestamp with time zone,
	"last_validated_at" timestamp with time zone,
	"offline_jwt_grace_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "licenses_license_key_unique" UNIQUE("license_key")
);
--> statement-breakpoint
CREATE TABLE "ai_app_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"provider_key_id" text,
	"model_alias" text NOT NULL,
	"target_model_name" text NOT NULL,
	"max_requests_per_min" integer DEFAULT 15 NOT NULL,
	"daily_token_limit" integer DEFAULT 100000 NOT NULL,
	"monthly_budget_idr" integer DEFAULT 500000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unique_app_model_alias" UNIQUE("app_id","model_alias")
);
--> statement-breakpoint
CREATE TABLE "ai_provider_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"builder_id" uuid NOT NULL,
	"provider_name" text NOT NULL,
	"key_name" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"iv_vector" text NOT NULL,
	"auth_tag" text,
	"base_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_proxy_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" text NOT NULL,
	"license_key" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"latency_ms" integer DEFAULT 0,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"license_id" text,
	"app_id" text NOT NULL,
	"model_alias" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"response_time_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_vault_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_id" text NOT NULL,
	"provider" text NOT NULL,
	"encrypted_api_key" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"monthly_budget_limit" integer DEFAULT 500000,
	"current_monthly_usage" integer DEFAULT 0,
	"is_kill_switch_active" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apps" ADD CONSTRAINT "apps_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_activations" ADD CONSTRAINT "license_activations_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_app_configs" ADD CONSTRAINT "ai_app_configs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_app_configs" ADD CONSTRAINT "ai_app_configs_provider_key_id_ai_provider_keys_id_fk" FOREIGN KEY ("provider_key_id") REFERENCES "public"."ai_provider_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_keys" ADD CONSTRAINT "ai_provider_keys_builder_id_builders_id_fk" FOREIGN KEY ("builder_id") REFERENCES "public"."builders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_proxy_logs" ADD CONSTRAINT "ai_proxy_logs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_license_id_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."licenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_vault_credentials" ADD CONSTRAINT "ai_vault_credentials_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_apps_builder_id" ON "apps" USING btree ("builder_id");--> statement-breakpoint
CREATE INDEX "idx_apps_mode" ON "apps" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "idx_transactions_builder_payout" ON "transactions" USING btree ("builder_id","payment_status","disbursement_status");--> statement-breakpoint
CREATE INDEX "idx_transactions_app_id" ON "transactions" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_created_at" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_license_activations_license_id" ON "license_activations" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "idx_license_activations_hwid_hash" ON "license_activations" USING btree ("hwid_hash");--> statement-breakpoint
CREATE INDEX "idx_licenses_app_id" ON "licenses" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "idx_licenses_transaction_id" ON "licenses" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_licenses_customer_email" ON "licenses" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "idx_licenses_status" ON "licenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_app_configs_app_id" ON "ai_app_configs" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "idx_ai_app_configs_provider_key_id" ON "ai_app_configs" USING btree ("provider_key_id");--> statement-breakpoint
CREATE INDEX "idx_ai_provider_keys_builder_id" ON "ai_provider_keys" USING btree ("builder_id");--> statement-breakpoint
CREATE INDEX "idx_ai_proxy_logs_app_id" ON "ai_proxy_logs" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "idx_ai_proxy_logs_license_key" ON "ai_proxy_logs" USING btree ("license_key");--> statement-breakpoint
CREATE INDEX "idx_ai_proxy_logs_created_at" ON "ai_proxy_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_license_id" ON "ai_usage_logs" USING btree ("license_id");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_app_id" ON "ai_usage_logs" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_logs_created_at" ON "ai_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_vault_credentials_app_id" ON "ai_vault_credentials" USING btree ("app_id");