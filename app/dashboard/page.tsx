import DashboardHomeClient from "./DashboardHomeClient";

import { getTeacherToolRegistry } from "@/lib/teacherTools/registry";

export default function DashboardPage() {
  return <DashboardHomeClient tools={getTeacherToolRegistry()} />;
}
