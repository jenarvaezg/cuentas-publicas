import { StatCard } from "@/components/StatCard";
import { fromAttribution } from "@/data/sources";
import { useData } from "@/hooks/useData";
import { useI18n } from "@/i18n/I18nProvider";
import { formatCompact, formatNumber } from "@/utils/formatters";

export function SocialEconomyBlock() {
  const { msg } = useI18n();
  const { socialEconomy } = useData();
  const t = msg.blocks.socialEconomy;

  if (!socialEconomy) return null;

  const source = socialEconomy.sourceAttribution
    ? [fromAttribution(socialEconomy.sourceAttribution)]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t.title}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t.vabLabel}
          value={`${formatCompact(socialEconomy.vab)}€`}
          tooltip={t.vabTooltip}
          sources={source}
        />
        <StatCard
          label={t.pibShare}
          value={`${formatNumber(socialEconomy.pibShare, 1)}%`}
          tooltip={t.pibShareTooltip}
          sources={source}
        />
        <StatCard
          label={t.employmentShare}
          value={`${formatNumber(socialEconomy.employmentShare, 1)}%`}
          tooltip={t.employmentShareTooltip}
          sources={source}
        />
        <StatCard
          label={t.totalJobs}
          value={formatCompact(socialEconomy.totalJobs)}
          tooltip={t.totalJobsTooltip}
          sources={source}
        />
      </div>
    </div>
  );
}

export default SocialEconomyBlock;
