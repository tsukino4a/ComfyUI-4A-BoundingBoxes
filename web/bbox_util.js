export const clamp01 = (v) => Math.max(0, Math.min(1, v));

function normalizeBox(b) {
  let { x, y, w, h } = b;
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  x = clamp01(x);
  y = clamp01(y);
  w = Math.min(w, 1 - x);
  h = Math.min(h, 1 - y);
  return { ...b, x, y, w: Math.max(0, w), h: Math.max(0, h) };
}

function rectHitTest(mx, my, x1, y1, x2, y2, rx, ry) {
  const near = (cx, cy) => Math.abs(mx - cx) < rx && Math.abs(my - cy) < ry;
  if (near(x1, y1)) return "resize-tl";
  if (near(x2, y1)) return "resize-tr";
  if (near(x1, y2)) return "resize-bl";
  if (near(x2, y2)) return "resize-br";
  if (mx >= x1 && mx <= x2 && Math.abs(my - y1) < ry) return "resize-t";
  if (mx >= x1 && mx <= x2 && Math.abs(my - y2) < ry) return "resize-b";
  if (my >= y1 && my <= y2 && Math.abs(mx - x1) < rx) return "resize-l";
  if (my >= y1 && my <= y2 && Math.abs(mx - x2) < rx) return "resize-r";
  if (mx >= x1 && mx <= x2 && my >= y1 && my <= y2) return "move";
  return null;
}

export function applyDrag(mode, start, dx, dy) {
  let { x, y, w, h } = start;
  switch (mode) {
    case "move":
      x = clamp01(Math.min(x + dx, 1 - w));
      y = clamp01(Math.min(y + dy, 1 - h));
      break;
    case "draw":
    case "resize-br":
      w += dx;
      h += dy;
      break;
    case "resize-tl":
      x += dx;
      y += dy;
      w -= dx;
      h -= dy;
      break;
    case "resize-tr":
      y += dy;
      w += dx;
      h -= dy;
      break;
    case "resize-bl":
      x += dx;
      w -= dx;
      h += dy;
      break;
    case "resize-t":
      y += dy;
      h -= dy;
      break;
    case "resize-b":
      h += dy;
      break;
    case "resize-l":
      x += dx;
      w -= dx;
      break;
    case "resize-r":
      w += dx;
      break;
  }
  return mode === "move" ? { ...start, x, y } : normalizeBox({ ...start, x, y, w, h });
}

export function boxesAt(regions, mxN, myN, handlePx, logW, logH, activeIdx) {
  const rx = handlePx / Math.max(1, logW);
  const ry = handlePx / Math.max(1, logH);
  const res = [];
  regions.forEach((b, index) => {
    const mode = rectHitTest(mxN, myN, b.x, b.y, b.x + b.w, b.y + b.h, rx, ry);
    if (mode) res.push({ index, mode });
  });
  const ai = res.findIndex((c) => c.index === activeIdx);
  if (ai > 0) res.unshift(res.splice(ai, 1)[0]);
  return res;
}

export function tagRects(regions, logW, logH, measureWidth, height = 14) {
  const placed = [];
  const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  return regions.map((b, i) => {
    const x1 = b.x * logW;
    const y1 = b.y * logH;
    const x2 = (b.x + b.w) * logW;
    const y2 = (b.y + b.h) * logH;
    const tag = String(i + 1).padStart(2, "0");
    const w = measureWidth(tag) + 8;
    const corners = [[x1, y1], [x2 - w, y1], [x2 - w, y2 - height], [x1, y2 - height]];
    const [px, py] = corners.find(([cx, cy]) => (
      !placed.some((p) => hits({ x: cx, y: cy, w, h: height }, p))
    )) || corners[0];
    const rect = { x: px, y: py, w, h: height, tag };
    placed.push(rect);
    return rect;
  });
}

export function isBoundingBox(b) {
  return !!b && typeof b === "object"
    && typeof b.x === "number"
    && typeof b.y === "number"
    && typeof b.width === "number"
    && typeof b.height === "number";
}

function normalizeHexColor(color) {
  if (typeof color !== "string") return null;
  const hex = color.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(hex);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return /^#([0-9a-f]{6}|[0-9a-f]{8})$/.test(hex) ? hex : null;
}

function normalizePalette(palette) {
  return Array.isArray(palette) ? palette.map(normalizeHexColor).filter(Boolean) : [];
}

export function fromBoundingBoxes(boxes, width, height) {
  const w = width || 1;
  const h = height || 1;
  return (Array.isArray(boxes) ? boxes : []).filter(isBoundingBox).map((box) => {
    const meta = box.metadata && typeof box.metadata === "object" ? box.metadata : {};
    return {
      x: box.x / w,
      y: box.y / h,
      w: box.width / w,
      h: box.height / h,
      type: meta.type === "text" ? "text" : "obj",
      text: typeof meta.text === "string" ? meta.text : "",
      desc: typeof meta.desc === "string" ? meta.desc : "",
      palette: normalizePalette(meta.palette),
    };
  });
}

export function toBoundingBoxes(regions, width, height) {
  return regions.map((r) => ({
    x: Math.round(r.x * width),
    y: Math.round(r.y * height),
    width: Math.round(r.w * width),
    height: Math.round(r.h * height),
    metadata: { type: r.type, text: r.text, desc: r.desc, palette: r.palette.slice() },
  }));
}

export function sameBoxes(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function hexToRgb(hex) {
  if (hex.length === 4 || hex.length === 5) {
    return { r: parseInt(hex[1] + hex[1], 16), g: parseInt(hex[2] + hex[2], 16), b: parseInt(hex[3] + hex[3], 16) };
  }
  if (hex.length === 7 || hex.length === 9) {
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
  }
  return { r: 0, g: 0, b: 0 };
}

const luminance = ({ r, g, b }) => 0.299 * r + 0.587 * g + 0.114 * b;

export function readableTextColor(hex) {
  const rgb = hexToRgb(hex);
  let { r, g, b } = rgb;
  const lum = luminance(rgb);
  if (lum < 130) {
    const t = (130 - lum) / (255 - lum);
    r = Math.round(r + (255 - r) * t);
    g = Math.round(g + (255 - g) * t);
    b = Math.round(b + (255 - b) * t);
  }
  return `rgb(${r},${g},${b})`;
}

export function textOnColor(hex) {
  return luminance(hexToRgb(hex)) > 140 ? "#000" : "#fff";
}
