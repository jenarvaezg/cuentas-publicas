import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { exportElementToPng } from "../export";

interface MockImageInstance {
  onload: null | (() => void);
  onerror: null | (() => void);
  decoding: string;
  src: string;
}

class MockImage implements MockImageInstance {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  decoding = "";
  #src = "";

  get src() {
    return this.#src;
  }

  set src(value: string) {
    this.#src = value;
    window.setTimeout(() => this.onload?.(), 0);
  }
}

describe("exportElementToPng", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("falla si no existe el elemento", async () => {
    await expect(exportElementToPng("no-existe", "demo")).rejects.toThrow(
      'No se encontró el elemento con id "no-existe"',
    );
  });

  it("falla si el elemento no tiene tamaño", async () => {
    const section = document.createElement("section");
    section.id = "bloque";
    document.body.appendChild(section);

    vi.spyOn(section, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    } as DOMRect);

    await expect(exportElementToPng("bloque", "demo")).rejects.toThrow(
      'El elemento "bloque" no tiene dimensiones válidas',
    );
  });

  it("genera un PNG y dispara la descarga con nombre consistente", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "bloque";
    source.style.backgroundColor = "rgb(255, 255, 255)";
    source.innerHTML = `
      <div style="padding: 8px; color: rgb(20, 20, 20);">
        <strong>Resumen</strong>
      </div>
    `;
    document.body.appendChild(source);

    vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 180,
      width: 320,
      height: 180,
      toJSON: () => ({}),
    } as DOMRect);

    const drawImage = vi.fn();
    const fillRect = vi.fn();
    const scale = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      fillRect,
      scale,
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D);

    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback) => {
        callback(new Blob(["png"], { type: "image/png" }));
      },
    });

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:test-url"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    const clickedDownloads: Array<{ href: string; download: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clickedDownloads.push({ href: this.href, download: this.download });
    });

    const filename = await exportElementToPng("bloque", "demo");

    expect(filename).toMatch(/^demo-\d{4}-\d{2}-\d{2}\.png$/);
    expect(scale).toHaveBeenCalledOnce();
    expect(fillRect).toHaveBeenCalledWith(0, 0, 320, 180);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(clickedDownloads).toHaveLength(1);
    expect(clickedDownloads[0]).toMatchObject({
      href: "blob:test-url",
      download: filename,
    });
  });
});
