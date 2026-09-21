CREATE TABLE "bill_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"effective_month" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"interval_months" smallint DEFAULT 1 NOT NULL,
	"category_id" uuid NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_versions_amount_check" CHECK ("bill_versions"."amount_cents" >= 0),
	CONSTRAINT "bill_versions_interval_check" CHECK ("bill_versions"."interval_months" in (1, 3, 6, 12))
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"paid_with" text,
	"note" text,
	"added_by" text,
	"start_month" date NOT NULL,
	"archived_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bill_versions" ADD CONSTRAINT "bill_versions_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_versions" ADD CONSTRAINT "bill_versions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_versions" ADD CONSTRAINT "bill_versions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_added_by_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bill_versions_bill_month_idx" ON "bill_versions" USING btree ("bill_id","effective_month");--> statement-breakpoint
CREATE INDEX "bill_versions_category_id_idx" ON "bill_versions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "bills_household_id_idx" ON "bills" USING btree ("household_id");