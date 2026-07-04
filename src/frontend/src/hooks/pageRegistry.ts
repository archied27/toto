import DashboardPage from "@/dashboard/DashboardPage";
import { plugins } from "@/plugins";

export interface AppPage {
  id: string;
  component: React.ComponentType;
}

export const pageRegistry: Record<string, React.ComponentType> = {
  dashboard: DashboardPage,
  ...Object.fromEntries(
    plugins.map(plugin => [plugin.id, plugin.page])
  ),
};