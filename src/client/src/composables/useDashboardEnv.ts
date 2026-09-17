import { watch } from "vue";
import { dashboardEnv } from "@/lib/environment";

export function useDashboardEnv(onChange: () => void) {
  watch(dashboardEnv, () => {
    onChange();
  });
}
