import { redirect } from "next/navigation";
export default function LegacyView() {
  redirect("/works?view=years");
}
