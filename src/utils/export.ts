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
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo crear contexto de canvas");
  }

  ctx.scale(scale, scale);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas);
  const filename = getExportFilename(filenamePrefix);
  triggerDownload(blob, filename);

  return filename;
}
