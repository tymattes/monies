CREATE TABLE "goal_amounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"effective_month" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goal_amounts_amount_check" CHECK ("goal_amounts"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "goal_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"month" date NOT NULL,
	"checked_by" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"position" integer NOT NULL,
	"start_month" date NOT NULL,
	"archived_from" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_type_check" CHECK ("goals"."type" in ('saving', 'debt payoff'))
);
--> statement-breakpoint
-- Data migration (spec 014): move every existing saving/debt-payoff
-- category into the new goals tables, keeping its id (so amounts copy
-- without a lookup) and its full amount history, before categories.type is
-- dropped below. Verified against the real household: no bill references a
-- saving/debt-payoff category, so the delete cannot hit the restrictive
-- bill_versions -> categories foreign key.
INSERT INTO "goals" ("id", "household_id", "name", "type", "position", "start_month", "archived_from", "created_at")
SELECT "id", "household_id", "name", "type", "position", "start_month", "archived_from", "created_at"
FROM "categories"
WHERE "type" IN ('saving', 'debt payoff');
--> statement-breakpoint
INSERT INTO "goal_amounts" ("id", "goal_id", "effective_month", "amount_cents", "created_by", "created_at")
SELECT "id", "category_id", "effective_month", "amount_cents", "created_by", "created_at"
FROM "budget_allocations"
WHERE "category_id" IN (SELECT "id" FROM "categories" WHERE "type" IN ('saving', 'debt payoff'));
--> statement-breakpoint
DELETE FROM "categories" WHERE "type" IN ('saving', 'debt payoff');
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_type_check";--> statement-breakpoint
ALTER TABLE "goal_amounts" ADD CONSTRAINT "goal_amounts_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_amounts" ADD CONSTRAINT "goal_amounts_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_checkins" ADD CONSTRAINT "goal_checkins_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_checkins" ADD CONSTRAINT "goal_checkins_checked_by_user_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "goal_amounts_goal_month_idx" ON "goal_amounts" USING btree ("goal_id","effective_month");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_checkins_goal_month_idx" ON "goal_checkins" USING btree ("goal_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_active_name_idx" ON "goals" USING btree ("household_id",lower("name")) WHERE "goals"."archived_from" is null;--> statement-breakpoint
CREATE INDEX "goals_household_id_idx" ON "goals" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN "type";
