CREATE TABLE "income_amounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"effective_month" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "income_amounts_amount_check" CHECK ("income_amounts"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "income_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"received_on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "income_deposits_amount_check" CHECK ("income_deposits"."amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "income_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"start_month" date NOT NULL,
	"archived_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "income_amounts" ADD CONSTRAINT "income_amounts_source_id_income_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."income_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_amounts" ADD CONSTRAINT "income_amounts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_deposits" ADD CONSTRAINT "income_deposits_source_id_income_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."income_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_deposits" ADD CONSTRAINT "income_deposits_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_sources" ADD CONSTRAINT "income_sources_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "income_amounts_source_month_idx" ON "income_amounts" USING btree ("source_id","effective_month");--> statement-breakpoint
CREATE INDEX "income_deposits_source_received_idx" ON "income_deposits" USING btree ("source_id","received_on");--> statement-breakpoint
CREATE UNIQUE INDEX "income_sources_active_name_idx" ON "income_sources" USING btree ("member_id",lower("name")) WHERE "income_sources"."archived_from" is null;--> statement-breakpoint
CREATE INDEX "income_sources_household_id_idx" ON "income_sources" USING btree ("household_id");