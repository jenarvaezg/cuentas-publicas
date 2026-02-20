import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { exportElementToPng } from "@/utils/export";
import { ExportBlockButton } from "../ExportBlockButton";

vi.mock("@/utils/export", () => ({
  exportElementToPng: vi.fn(),
}));

describe("ExportBlockButton", () => {
  it("exporta el bloque al hacer click", async () => {
    (exportElementToPng as any).mockResolvedValue("ok");
    render(<ExportBlockButton targetId="deuda" filenamePrefix="deuda" />);

    fireEvent.click(screen.getByRole("button", { name: /Exportar PNG/i }));

    await waitFor(() => {
      expect(exportElementToPng).toHaveBeenCalledWith("deuda", "deuda");
    });
  });

  it("muestra error si falla la exportación", async () => {
    (exportElementToPng as any).mockRejectedValue(new Error("boom"));
    render(<ExportBlockButton targetId="deuda" filenamePrefix="deuda" />);

    fireEvent.click(screen.getByRole("button", { name: /Exportar PNG/i }));

    await waitFor(() => {
      expect(screen.getByText("No se pudo exportar")).toBeInTheDocument();
    });
  });
});
