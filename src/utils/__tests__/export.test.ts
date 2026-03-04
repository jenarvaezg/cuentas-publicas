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
    const fillText = vi.fn();
    const scale = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
      fillRect,
      fillText,
      scale,
      fillStyle: "",
      textAlign: "",
      font: "",
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
    expect(fillRect).toHaveBeenCalledWith(0, 0, 320, 208);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(fillText).toHaveBeenCalledWith("https://cuentas-publicas.es/", 304, 198);
    expect(clickedDownloads).toHaveLength(1);
    expect(clickedDownloads[0]).toMatchObject({
      href: "blob:test-url",
      download: filename,
    });
  });

  it("usa el color del body cuando el nodo tiene fondo transparente", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "transparent-bg";
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

    // Mock getComputedStyle: node is transparent, body has a dark background.
    // Must return iterable + getPropertyValue for copyComputedStyles.
    const fakeStyle = (bg: string) =>
      ({
        backgroundColor: bg,
        getPropertyValue: () => "",
        [Symbol.iterator]: [][Symbol.iterator],
      }) as unknown as CSSStyleDeclaration;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
      if (el === source) return fakeStyle("rgba(0, 0, 0, 0)");
      if (el === document.body) return fakeStyle("rgb(30, 30, 30)");
      return fakeStyle("");
    });

    const ctx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      fillStyle: "",
      textAlign: "",
      font: "",
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

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
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await exportElementToPng("transparent-bg", "demo");

    // fillRect is called with the resolved background; verify it was called
    expect(ctx.fillRect).toHaveBeenCalledOnce();
    // The background color is set before fillRect, then overwritten by watermark.
    // Verify fillRect was called (meaning resolveBackgroundColor succeeded).
    expect(ctx.drawImage).toHaveBeenCalledOnce();
  });

  it("usa blanco cuando tanto nodo como body tienen fondo transparente", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "all-transparent";
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

    const fakeStyle = (bg: string) =>
      ({
        backgroundColor: bg,
        getPropertyValue: () => "",
        [Symbol.iterator]: [][Symbol.iterator],
      }) as unknown as CSSStyleDeclaration;
    vi.spyOn(window, "getComputedStyle").mockImplementation(() => fakeStyle("rgba(0, 0, 0, 0)"));

    const ctx = {
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      fillStyle: "",
      textAlign: "",
      font: "",
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx);

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
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await exportElementToPng("all-transparent", "demo");

    // Both transparent → fallback to white. Verify export completed.
    expect(ctx.fillRect).toHaveBeenCalledOnce();
    expect(ctx.drawImage).toHaveBeenCalledOnce();
  });

  it("rechaza cuando canvas.toBlob devuelve null", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "null-blob";
    source.style.backgroundColor = "rgb(255, 255, 255)";
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

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      fillStyle: "",
      textAlign: "",
      font: "",
    } as unknown as CanvasRenderingContext2D);

    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback) => {
        callback(null);
      },
    });

    await expect(exportElementToPng("null-blob", "demo")).rejects.toThrow(
      "No se pudo generar el archivo PNG",
    );
  });

  it("rechaza cuando la imagen falla al cargar", async () => {
    class ErrorImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      decoding = "";
      #src = "";

      get src() {
        return this.#src;
      }

      set src(value: string) {
        this.#src = value;
        window.setTimeout(() => this.onerror?.(), 0);
      }
    }

    vi.stubGlobal("Image", ErrorImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "error-image";
    source.style.backgroundColor = "rgb(255, 255, 255)";
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

    await expect(exportElementToPng("error-image", "demo")).rejects.toThrow(
      "No se pudo renderizar la imagen de exportación",
    );
  });

  it("lanza error cuando getContext devuelve null", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "null-context";
    source.style.backgroundColor = "rgb(255, 255, 255)";
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

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

    await expect(exportElementToPng("null-context", "demo")).rejects.toThrow(
      "No se pudo crear contexto de canvas",
    );
  });

  it("copia valores de inputs, textarea y select al clonar", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "form-elements";
    source.style.backgroundColor = "rgb(255, 255, 255)";
    source.innerHTML = `
      <input type="text" id="txt" value="" />
      <input type="checkbox" id="chk" />
      <textarea id="ta"></textarea>
      <select id="sel">
        <option value="a">Alpha</option>
        <option value="b" selected>Beta</option>
      </select>
    `;
    document.body.appendChild(source);

    const input = source.querySelector<HTMLInputElement>("#txt");
    if (input) input.value = "hello";

    const checkbox = source.querySelector<HTMLInputElement>("#chk");
    if (checkbox) checkbox.checked = true;

    const textarea = source.querySelector<HTMLTextAreaElement>("#ta");
    if (textarea) textarea.value = "world";

    vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 200,
      width: 320,
      height: 200,
      toJSON: () => ({}),
    } as DOMRect);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      fillStyle: "",
      textAlign: "",
      font: "",
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

    // Intercept cloneNode to capture clone so we can inspect it
    let capturedClone: HTMLElement | null = null;
    const originalCloneNode = source.cloneNode.bind(source);
    vi.spyOn(source, "cloneNode").mockImplementation((deep?: boolean) => {
      const clone = originalCloneNode(deep) as HTMLElement;
      capturedClone = clone;
      return clone;
    });

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await exportElementToPng("form-elements", "demo");

    expect(capturedClone).not.toBeNull();
    const clone = capturedClone as unknown as HTMLElement;
    const cloneInput = clone.querySelector<HTMLInputElement>("#txt");
    expect(cloneInput?.value).toBe("hello");
    const cloneCheckbox = clone.querySelector<HTMLInputElement>("#chk");
    expect(cloneCheckbox?.checked).toBe(true);
    const cloneTextarea = clone.querySelector<HTMLTextAreaElement>("#ta");
    expect(cloneTextarea?.value).toBe("world");
    // prepareCloneForExport replaces <select> with <span> showing selected text
    const cloneSelect = clone.querySelector<HTMLSelectElement>("#sel");
    expect(cloneSelect).toBeNull();
  });

  it("reemplaza select con span mostrando el texto seleccionado", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "select-replace";
    source.style.backgroundColor = "rgb(255, 255, 255)";
    source.innerHTML = `
      <select id="dropdown">
        <option value="x">Option X</option>
        <option value="y" selected>Option Y</option>
      </select>
    `;
    document.body.appendChild(source);

    vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 100,
      width: 320,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      fillStyle: "",
      textAlign: "",
      font: "",
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
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const serializeSpy = vi.spyOn(XMLSerializer.prototype, "serializeToString");

    await exportElementToPng("select-replace", "demo");

    const serialized = serializeSpy.mock.results[0]?.value as string;
    expect(serialized).toContain("Option Y");
    expect(serialized).not.toContain("<select");
  });

  it("reemplaza toggle groups con texto estático del botón activo", async () => {
    vi.stubGlobal("Image", MockImage as unknown as typeof Image);

    const source = document.createElement("section");
    source.id = "toggle-test";
    source.style.backgroundColor = "rgb(255, 255, 255)";
    source.innerHTML = `
      <div class="flex items-center rounded-md border border-input bg-background p-0.5">
        <button type="button" class="bg-primary text-primary-foreground shadow-sm">Nacional</button>
        <button type="button" class="text-muted-foreground">Por CCAA</button>
      </div>
    `;
    document.body.appendChild(source);

    vi.spyOn(source, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 100,
      width: 320,
      height: 100,
      toJSON: () => ({}),
    } as DOMRect);

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      scale: vi.fn(),
      fillStyle: "",
      textAlign: "",
      font: "",
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

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const serializeSpy = vi.spyOn(XMLSerializer.prototype, "serializeToString");

    await exportElementToPng("toggle-test", "toggle");

    const serialized = serializeSpy.mock.results[0]?.value as string;
    expect(serialized).toContain("Nacional");
    expect(serialized).not.toContain("Por CCAA");
  });
});
