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

  const source = socialEconomy.sourceAttribution?.socialEconomy
    ? [fromAttribution(socialEconomy.sourceAttribution.socialEconomy)]
    : [];
  const vabSparkline = socialEconomy.historical?.vab?.map((point) => point.value) ?? [
    socialEconomy.vab,
  ];
  const pibShareSparkline = socialEconomy.historical?.pibShare?.map((point) => point.value) ?? [
    socialEconomy.pibShare,
  ];
  const employmentShareSparkline = socialEconomy.historical?.employmentShare?.map(
    (point) => point.value,
  ) ?? [socialEconomy.employmentShare];
  const totalJobsSparkline = socialEconomy.historical?.totalJobs?.map((point) => point.value) ?? [
    socialEconomy.totalJobs,
  ];

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
          sparklineData={vabSparkline}
          sources={source}
        />
        <StatCard
          label={t.pibShare}
          value={`${formatNumber(socialEconomy.pibShare, 1)}%`}
          tooltip={t.pibShareTooltip}
          sparklineData={pibShareSparkline}
          sources={source}
        />
        <StatCard
          label={t.employmentShare}
          value={`${formatNumber(socialEconomy.employmentShare, 1)}%`}
          tooltip={t.employmentShareTooltip}
          sparklineData={employmentShareSparkline}
          sources={source}
        />
        <StatCard
          label={t.totalJobs}
          value={formatCompact(socialEconomy.totalJobs)}
          tooltip={t.totalJobsTooltip}
          sparklineData={totalJobsSparkline}
          sources={source}
        />
      </div>
    </div>
  );
}

export default SocialEconomyBlock;
