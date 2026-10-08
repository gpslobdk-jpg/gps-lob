import "driver.js/dist/driver.css";

import AIChatButton from "@/components/AIChatButton";
import { AuthProvider } from "@/components/AuthProvider";
import AuthLoadingScreen from "@/components/AuthLoadingScreen";
import DashboardAuthGate from "@/components/DashboardAuthGate";
import DashboardQuickGuide from "@/components/DashboardQuickGuide";
import OnboardingTour from "@/components/OnboardingTour";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import FocusSaveNotice from "@/components/focus/FocusSaveNotice";
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
          description="Et øjeblik – vi henter dine løb."
        />
      }
    >
      <AuthProvider>
        <DashboardAuthGate>
          <div className="relative pb-32 md:pb-0">
            <div className="print:hidden">
              <DashboardHeader />
            </div>
            {children}
            <FocusSaveNotice />
            <div className="print:hidden">
              <AIChatButton />
            </div>
          </div>
          <DashboardQuickGuide />
        </DashboardAuthGate>
        <OnboardingTour />
      </AuthProvider>
    </Suspense>
  );
}
