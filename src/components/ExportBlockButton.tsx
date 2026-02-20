import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import { exportElementToPng } from "@/utils/export";

interface ExportBlockButtonProps {
  targetId: string;
  filenamePrefix: string;
}

export function ExportBlockButton({ targetId, filenamePrefix }: ExportBlockButtonProps) {
  const { msg } = useI18n();
  const [isExporting, setIsExporting] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setHasError(false);

    try {
      await exportElementToPng(targetId, filenamePrefix);
    } catch {
      setHasError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1" data-export-hide>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
      >
        <Download className="h-3.5 w-3.5" />
        {isExporting ? msg.common.exporting : msg.common.exportPng}
      </Button>
      {hasError && <output className="text-[10px] text-rose-500">{msg.common.exportError}</output>}
    </div>
  );
}
