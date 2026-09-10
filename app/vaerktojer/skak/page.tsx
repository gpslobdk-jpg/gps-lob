import { redirect } from "next/navigation";

/** Keeps the short public route stable while the tool stays inside the teacher dashboard. */
export default function SkakShortcutPage() {
  redirect("/dashboard/laerervaerktoejer/skak");
}
