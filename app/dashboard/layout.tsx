import { redirect } from "next/navigation";

import AIChatButton from "@/components/AIChatButton";
import { createClient } from "@/utils/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <div className="relative">
      {children}
      <AIChatButton />
    </div>
  );
}
