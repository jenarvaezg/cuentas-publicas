import { useState } from "react";
import { RevenueBlock } from "@/components/RevenueBlock";
import { TaxRevenueBlock } from "@/components/TaxRevenueBlock";
import { useTabKeyboardNav } from "@/hooks/useTabKeyboardNav";
import { useI18n } from "@/i18n/I18nProvider";

type RevenueTab = "overview" | "tax";

export function RevenueDashboardBlock() {
  const { msg } = useI18n();
  const [tab, setTab] = useState<RevenueTab>("overview");

  const REVENUE_TABS = ["overview", "tax"] as const;
  const { onKeyDown: tabKeyDown } = useTabKeyboardNav(REVENUE_TABS, tab, setTab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div
          role="tablist"
          onKeyDown={tabKeyDown}
          className="flex items-center rounded-md border border-input bg-background p-0.5"
        >
          <button
            type="button"
            role="tab"
            id="revenue-tab-overview"
            aria-selected={tab === "overview"}
            aria-controls="revenue-panel-overview"
            tabIndex={tab === "overview" ? 0 : -1}
            onClick={() => setTab("overview")}
            className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
              tab === "overview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {msg.blocks.revenue.title}
          </button>
          <button
            type="button"
            role="tab"
            id="revenue-tab-tax"
            aria-selected={tab === "tax"}
            aria-controls="revenue-panel-tax"
            tabIndex={tab === "tax" ? 0 : -1}
            onClick={() => setTab("tax")}
            className={`px-2.5 py-1 text-xs rounded-sm transition-colors ${
              tab === "tax"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {msg.blocks.taxRevenue.title}
          </button>
        </div>
      </div>

      {tab === "overview" ? (
        <div role="tabpanel" id="revenue-panel-overview" aria-labelledby="revenue-tab-overview">
          <RevenueBlock exportTargetId="ingresos-gastos" />
        </div>
      ) : (
        <div role="tabpanel" id="revenue-panel-tax" aria-labelledby="revenue-tab-tax">
          <TaxRevenueBlock exportTargetId="ingresos-gastos" />
        </div>
      )}
    </div>
  );
}

export default RevenueDashboardBlock;
