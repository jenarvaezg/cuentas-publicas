import { StatCard } from "@/components/StatCard";
import { fromAttribution } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatNumber } from "@/utils/formatters";

export function InequalityBlock() {
  const { msg } = useI18n();
  const { livingConditions } = useData();
  const t = msg.blocks.inequality;

  if (!livingConditions) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label={t.aropeLabel}
          value={`${formatNumber(livingConditions.arope, 1)}%`}
          tooltip={t.aropeTooltip}
          sources={
            livingConditions.sourceAttribution?.arope
              ? [fromAttribution(livingConditions.sourceAttribution.arope)]
              : []
          }
        />
        <StatCard
          label={t.giniLabel}
          value={formatNumber(livingConditions.gini, 1)}
          tooltip={t.giniTooltip}
          sources={
            livingConditions.sourceAttribution?.gini
              ? [fromAttribution(livingConditions.sourceAttribution.gini)]
              : []
          }
        />
        <StatCard
          label={t.incomeLabel}
          value={`${formatNumber(livingConditions.averageIncome, 0)}€`}
          tooltip={t.incomeLabelTooltip}
          sources={
            livingConditions.sourceAttribution?.averageIncome
              ? [fromAttribution(livingConditions.sourceAttribution.averageIncome)]
              : []
          }
        />
      </div>
    </div>
  );
}

export default InequalityBlock;
