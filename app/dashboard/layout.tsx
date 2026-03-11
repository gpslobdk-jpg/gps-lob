import AIChatButton from "@/components/AIChatButton";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import DashboardAuthGate from "@/components/DashboardAuthGate";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Suspense
      fallback={
        <AuthLoadingScreen
          title="Åbner dashboardet"
          description="Vi læser sessionen og gør kontroltårnet klar."
        />
      }
    >
      <DashboardAuthGate>
        <div className="relative pb-32 md:pb-0">
          {children}
          <AIChatButton />
        </div>
      </DashboardAuthGate>
    </Suspense>
  );
}
