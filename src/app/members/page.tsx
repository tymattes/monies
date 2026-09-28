import { redirect } from "next/navigation";

// Renamed Household (spec 044): keeps the old bookmark/link working.
export default function MembersRedirect() {
  redirect("/household");
}
