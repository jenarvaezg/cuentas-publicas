const IMAGE_LOAD_TIMEOUT_MS = 15_000;
const MIN_EXPORT_SCALE = 2;
const TRANSPARENT_RGBA = "rgba(0, 0, 0, 0)";

function getExportFilename(filenamePrefix: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${filenamePrefix}-${day}.png`;
}

function isTransparentColor(color: string): boolean {
  const normalizedColor = color.trim().toLowerCase();
  return normalizedColor === "transparent" || normalizedColor === TRANSPARENT_RGBA;
}

function resolveBackgroundColor(node: HTMLElement): string {
  const nodeBackground = window.getComputedStyle(node).backgroundColor;
  if (nodeBackground && !isTransparentColor(nodeBackground)) {
    return nodeBackground;
  }

  const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  if (bodyBackground && !isTransparentColor(bodyBackground)) {
    return bodyBackground;
  }

  return "rgb(255, 255, 255)";
}

function copyComputedStyles(sourceNode: Element, targetNode: Element) {
  const computedStyle = window.getComputedStyle(sourceNode);
  const cssText = Array.from(computedStyle)
    .map((propertyName) => `${propertyName}: ${computedStyle.getPropertyValue(propertyName)};`)
    .join(" ");
  targetNode.setAttribute("style", cssText);

  if (sourceNode instanceof HTMLCanvasElement && targetNode instanceof HTMLCanvasElement) {
    const context = targetNode.getContext("2d");
    if (context) {
      context.drawImage(sourceNode, 0, 0);
    }
  }

  if (sourceNode instanceof HTMLInputElement && targetNode instanceof HTMLInputElement) {
    targetNode.value = sourceNode.value;
    targetNode.checked = sourceNode.checked;
  }

  if (sourceNode instanceof HTMLTextAreaElement && targetNode instanceof HTMLTextAreaElement) {
    targetNode.value = sourceNode.value;
    targetNode.textContent = sourceNode.value;
  }

  if (sourceNode instanceof HTMLSelectElement && targetNode instanceof HTMLSelectElement) {
    targetNode.value = sourceNode.value;
    for (let index = 0; index < sourceNode.options.length; index += 1) {
      const sourceOption = sourceNode.options[index];
      const targetOption = targetNode.options[index];
      if (sourceOption && targetOption) {
        targetOption.selected = sourceOption.selected;
      }
    }
  }

  const sourceChildren = Array.from(sourceNode.children);
  const targetChildren = Array.from(targetNode.children);

  for (let index = 0; index < sourceChildren.length; index += 1) {
    const sourceChild = sourceChildren[index];
    const targetChild = targetChildren[index];
    if (sourceChild && targetChild) {
      copyComputedStyles(sourceChild, targetChild);
    }
  }
}

function getSvgDataUrl(svgContent: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "sync";

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error("Tiempo de espera agotado al renderizar la imagen de exportación"));
    }, IMAGE_LOAD_TIMEOUT_MS);

    image.onload = () => {
      window.clearTimeout(timeoutId);
      resolve(image);
    };

    image.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("No se pudo renderizar la imagen de exportación"));
    };

    image.src = sourceUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo generar el archivo PNG"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

const WATERMARK_HEIGHT = 28;
const WATERMARK_URL = "https://cuentas-publicas.es/";

function prepareCloneForExport(clone: HTMLElement, source: HTMLElement) {
  // Remove elements marked for export hiding (e.g. export buttons)
  for (const el of clone.querySelectorAll("[data-export-hide]")) {
    el.remove();
  }

  // Remove inline SVG icons (lucide-react) — nested SVGs break foreignObject rendering
  for (const svg of clone.querySelectorAll("svg.lucide")) {
    svg.remove();
  }

  // Remove screen-reader-only content that can misrender in foreignObject
  for (const el of clone.querySelectorAll(".sr-only")) {
    el.remove();
  }

  // Replace <select> elements with static text showing selected value
  const sourceSelects = source.querySelectorAll("select");
  const cloneSelects = Array.from(clone.querySelectorAll("select"));
  for (let i = 0; i < cloneSelects.length; i++) {
    const cloneSelect = cloneSelects[i];
    const sourceSelect = sourceSelects[i];
    if (!(sourceSelect instanceof HTMLSelectElement)) continue;

    const selectedText = sourceSelect.selectedOptions[0]?.textContent ?? sourceSelect.value;
    const span = document.createElement("span");
    span.textContent = selectedText;

    const selectStyle = window.getComputedStyle(sourceSelect);
    span.setAttribute(
      "style",
      [
        `font-family: ${selectStyle.fontFamily}`,
        `font-size: ${selectStyle.fontSize}`,
        `font-weight: ${selectStyle.fontWeight}`,
        `color: ${selectStyle.color}`,
        `line-height: ${selectStyle.lineHeight}`,
        "display: inline",
        "border: none",
        "background: none",
        "padding: 0",
        "appearance: none",
      ].join("; "),
    );
    cloneSelect.replaceWith(span);
  }

  // Replace button toggle groups with static text showing active selection
  for (const container of clone.querySelectorAll(".border-input")) {
    if (!(container instanceof HTMLElement)) continue;
    const buttons = Array.from(container.querySelectorAll(":scope > button"));
    if (buttons.length < 2) continue;

    const activeButton = buttons.find((btn) => btn.classList.contains("bg-primary"));
    if (!(activeButton instanceof HTMLElement)) continue;

    const span = document.createElement("span");
    span.textContent = activeButton.textContent?.trim() ?? "";
    span.setAttribute(
      "style",
      [
        `font-family: ${activeButton.style.fontFamily}`,
        `font-size: ${activeButton.style.fontSize}`,
        `font-weight: ${activeButton.style.fontWeight}`,
        `color: ${activeButton.style.color}`,
        `line-height: ${activeButton.style.lineHeight}`,
        "display: inline",
        "border: none",
        "background: none",
        "padding: 0",
        "white-space: nowrap",
      ].join("; "),
    );
    container.replaceWith(span);
  }

  // Disable remaining button interactivity
  for (const btn of clone.querySelectorAll("button")) {
    btn.style.pointerEvents = "none";
  }

  // Allow vertical reflow: foreignObject may render fonts with slightly
  // different metrics, causing text to wrap where it didn't in the browser.
  // Fixed heights from copyComputedStyles prevent elements from growing,
  // so reset them to auto. Skip chart containers that need explicit sizing.
  for (const el of clone.querySelectorAll("*")) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.tagName === "svg" || el.closest("svg")) continue;
    if (el.classList.contains("recharts-responsive-container")) continue;
    if (el instanceof HTMLCanvasElement) continue;
    el.style.height = "auto";
    el.style.overflow = "visible";
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}

export async function exportElementToPng(targetId: string, filenamePrefix: string) {
  const node = document.getElementById(targetId);
  if (!(node instanceof HTMLElement)) {
    throw new Error(`No se encontró el elemento con id "${targetId}"`);
  }

  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (!width || !height) {
    throw new Error(`El elemento "${targetId}" no tiene dimensiones válidas`);
  }

  const clonedNode = node.cloneNode(true) as HTMLElement;
  copyComputedStyles(node, clonedNode);
  prepareCloneForExport(clonedNode, node);

  const serializedHtml = new XMLSerializer().serializeToString(clonedNode);
  const backgroundColor = resolveBackgroundColor(node);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:${backgroundColor};">
          ${serializedHtml}
        </div>
      </foreignObject>
    </svg>
  `;
  const image = await loadImage(getSvgDataUrl(svg));

  const scale = Math.max(window.devicePixelRatio || 1, MIN_EXPORT_SCALE);
  const exportHeight = height + WATERMARK_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(exportHeight * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo crear contexto de canvas");
  }

  ctx.scale(scale, scale);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, exportHeight);
  ctx.drawImage(image, 0, 0, width, height);

  // Draw watermark in the extra space below the content
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(140, 140, 140, 0.7)";
  ctx.textAlign = "right";
  ctx.fillText(WATERMARK_URL, width - 16, height + WATERMARK_HEIGHT - 10);

  const blob = await canvasToBlob(canvas);
  const filename = getExportFilename(filenamePrefix);
  triggerDownload(blob, filename);

  return filename;
}
