import AIChatButton from "@/components/AIChatButton";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative">
      {children}
      <AIChatButton />
    </div>
  );
}
