import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
import {
  applyDrag,
  boxesAt,
  clamp01,
  fromBoundingBoxes,
  isBoundingBox,
  readableTextColor,
  sameBoxes,
  tagRects,
  textOnColor,
  toBoundingBoxes,
} from "./bbox_util.js";

const NODE_CLASS = "Create Bounding Boxes (4A)";
const EDITOR_TYPE = "BBOX4A_EDITOR";
const STATE_TYPE = "BBOX4A_STATE";

const HANDLE_PX = 8;
const DIMENSION_STEP = 16;
const BG_DIM = 0.75;
const MAX_ELEMENT_COLORS = 5;
const GRID_PX = 32;
const MAX_GRID_CELLS = 64;
const DOT_ALPHA = 0.18;
const DOT_RADIUS = 1;
const TAG_FONT = "bold 11px monospace";
const BODY_FONT = "12px monospace";

const GRID_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>';
const CLEAR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';

const MESSAGES = {
  zh: {
    grid: "网格",
    clearAll: "全部清除",
    clickRegionToEdit: "点击区域进行编辑。",
    colors: "调色板",
    descLabel: "描述",
    descPlaceholder: "该区域的描述",
    textLabel: "文本",
    textPlaceholder: "要渲染的文本（原文）",
    typeObj: "obj",
    typeText: "text",
    addColor: "添加颜色",
    swatchTitle: "点击编辑 · 拖动排序 · 右键移除",
  },
  en: {
    grid: "Grid",
    clearAll: "Clear all",
    clickRegionToEdit: "Click a region to edit it.",
    colors: "Palette",
    descLabel: "Description",
    descPlaceholder: "Description of this region",
    textLabel: "Text",
    textPlaceholder: "Text to render (verbatim)",
    typeObj: "obj",
    typeText: "text",
    addColor: "Add color",
    swatchTitle: "Click to edit · Drag to reorder · Right-click to remove",
  },
};

function t(key) {
  let locale = "";
  try {
    locale = String(app.extensionManager?.setting?.get?.("Comfy.Locale") || "");
  } catch (_) {
    locale = "";
  }
  const table = !locale || locale.startsWith("zh") ? MESSAGES.zh : MESSAGES.en;
  return table[key] ?? key;
}

function injectStyles() {
  const id = "bb4a-styles";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .bb4a-editor { width:100%; height:100%; min-height:0; padding:0 4px 4px; display:flex; flex-direction:column; gap:6px; overflow:hidden; box-sizing:border-box; color:#e8e8e8; font:12px/1.35 system-ui,sans-serif; user-select:none; }
    .bb4a-editor * { box-sizing:border-box; }
    .bb4a-editor [hidden] { display:none !important; }
    .bb4a-toolbar { flex:0 0 auto; min-height:30px; padding:2px 3px; display:flex; align-items:center; gap:4px; border:1px solid #464a50; border-radius:5px; background:#292c30; }
    .bb4a-tool { height:24px; padding:2px 8px; display:flex; align-items:center; gap:5px; border:0; border-radius:4px; color:#c9cdd1; background:transparent; cursor:pointer; font:inherit; white-space:nowrap; }
    .bb4a-tool:hover { color:#fff; background:#3b4046; }
    .bb4a-tool.active { color:#fff; background:#3a3e43; box-shadow:inset 0 0 0 1px #159eff66; }
    .bb4a-tool svg { width:15px; height:15px; flex:0 0 15px; fill:none; stroke:currentColor; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; pointer-events:none; }
    .bb4a-spacer { flex:1; }
    .bb4a-stage { flex:1 1 auto; min-height:80px; display:grid; place-items:center; overflow:hidden; border:1px solid #464a50; border-radius:6px; background:#141618; }
    .bb4a-frame { position:relative; background:#202327; }
    .bb4a-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; color:#c9cdd1; outline:none; touch-action:none; }
    .bb4a-inline { position:absolute; margin:0; padding:4px; resize:none; border:2px solid #46b4e6; border-radius:4px; color:#fff; background:rgba(0,0,0,.9); font:12px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; outline:none; user-select:text; }
    .bb4a-panel { flex:0 0 210px; height:210px; padding:6px; display:flex; flex-direction:column; border:1px solid #464a50; border-radius:6px; background:#292c30; }
    .bb4a-form { flex:1; min-height:0; display:flex; flex-direction:column; gap:6px; }
    .bb4a-seg { flex:0 0 28px; height:28px; padding:2px; display:flex; gap:2px; border:1px solid #4b4f55; border-radius:4px; background:#1b1d20; }
    .bb4a-seg button { flex:1; border:0; border-radius:3px; color:#9ca3aa; background:transparent; cursor:pointer; font:inherit; }
    .bb4a-seg button:hover { color:#e6e8ea; }
    .bb4a-seg button.active { color:#fff; background:#3a3e43; }
    .bb4a-field { position:relative; flex:0 0 auto; }
    .bb4a-field.desc { flex:1 1 auto; min-height:44px; display:flex; }
    .bb4a-field-label { position:absolute; top:4px; left:8px; color:#858c94; font-size:10px; font-weight:650; letter-spacing:.04em; pointer-events:none; }
    .bb4a-textarea { width:100%; display:block; padding:18px 7px 5px; resize:none; border:1px solid #4b4f55; border-radius:4px; color:#eceeef; background:#151719; font:12px/1.4 system-ui,sans-serif; outline:none; user-select:text; scrollbar-width:thin; }
    .bb4a-textarea:hover { border-color:#5a5f66; }
    .bb4a-textarea:focus { border-color:#159eff; }
    .bb4a-textarea::placeholder { color:#777d84; }
    .bb4a-textarea.text { height:56px; }
    .bb4a-textarea.desc { height:100%; }
    .bb4a-colors { flex:0 0 auto; min-height:20px; display:flex; align-items:center; gap:8px; }
    .bb4a-colors-label { flex:0 0 auto; color:#9ca3aa; }
    .bb4a-swatches { display:flex; flex-wrap:wrap; align-items:center; gap:4px; }
    .bb4a-swatch { position:relative; width:20px; height:20px; overflow:hidden; border:1px solid #4b4f55; border-radius:4px; cursor:pointer; }
    .bb4a-swatch:hover { border-color:#c9cdd1; }
    .bb4a-swatch input { position:absolute; inset:0; width:100%; height:100%; margin:0; padding:0; border:0; opacity:0; cursor:pointer; }
    .bb4a-add { height:20px; padding:0 8px; border:1px solid #4b4f55; border-radius:4px; color:#c9cdd1; background:#1b1d20; cursor:pointer; font:inherit; line-height:1; }
    .bb4a-add:hover { color:#fff; background:#3b4046; }
    .bb4a-hint { flex:1; display:grid; place-items:center; color:#858c94; }
  `;
  document.head.appendChild(style);
}

function el(tag, className, props = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return Object.assign(node, props);
}

function viewUrl(image) {
  const params = new URLSearchParams({
    filename: image.filename,
    type: image.type || "output",
    subfolder: image.subfolder || "",
  });
  return api.apiURL(`/view?${params}`);
}

function upstreamNode(node, inputName) {
  const slot = node.findInputSlot(inputName);
  if (slot < 0 || !node.isInputConnected(slot)) return null;
  let source = node.getInputNode(slot);
  while (source?.type === "Reroute" && source.isInputConnected?.(0)) source = source.getInputNode(0);
  return source || null;
}

function nodeImageUrl(source) {
  const src = source?.imgs?.[0]?.src;
  if (src) return src;
  const image = app.nodeOutputs?.[String(source?.id)]?.images?.[0];
  return image ? viewUrl(image) : null;
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      if (!word) continue;
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

class BoundingBoxesEditor {
  constructor(node) {
    this.node = node;
    this.regions = [];
    this.activeIndex = -1;
    this.value = [];
    this.focused = false;
    this.drawing = false;
    this.dragMode = null;
    this.dragStart = null;
    this.boxAtStart = null;
    this.hoverIndex = null;
    this.hoverTagIndex = null;
    this.bgUrl = null;
    this.bgImage = null;
    this.bgLoading = false;
    this.savedBackground = null;
    this.pendingIncoming = null;
    this.inlineIndex = -1;
    this.swatchKey = null;
    this.raf = 0;
    this.build();
  }

  get width() {
    return this.dimWidget("width")?.value > 0 ? this.dimWidget("width").value : 1024;
  }

  get height() {
    return this.dimWidget("height")?.value > 0 ? this.dimWidget("height").value : 1024;
  }

  get grid() {
    return this.node.properties?.bboxGrid !== false;
  }

  get activeRegion() {
    return this.activeIndex >= 0 ? this.regions[this.activeIndex] ?? null : null;
  }

  dimWidget(name) {
    return this.node.widgets?.find((w) => w.name === name);
  }

  build() {
    injectStyles();
    this.root = el("div", "bb4a-editor");
    this.root.addEventListener("pointerdown", (e) => e.stopPropagation());

    const toolbar = el("div", "bb4a-toolbar");
    this.gridButton = el("button", "bb4a-tool", { type: "button", innerHTML: `${GRID_ICON}<span>${t("grid")}</span>` });
    this.gridButton.onclick = () => {
      this.node.properties.bboxGrid = !this.grid;
      this.gridButton.classList.toggle("active", this.grid);
      this.requestDraw();
    };
    this.gridButton.classList.toggle("active", this.grid);
    const clearButton = el("button", "bb4a-tool", { type: "button", innerHTML: `${CLEAR_ICON}<span>${t("clearAll")}</span>` });
    clearButton.onclick = () => this.clearAll();
    toolbar.append(this.gridButton, el("div", "bb4a-spacer"), clearButton);

    this.stage = el("div", "bb4a-stage");
    this.frame = el("div", "bb4a-frame");
    this.canvas = el("canvas", "bb4a-canvas", { tabIndex: 0 });
    this.canvas.style.cursor = "crosshair";
    this.inline = el("textarea", "bb4a-inline", { hidden: true, spellcheck: false });
    this.frame.append(this.canvas, this.inline);
    this.stage.append(this.frame);
    this.bindCanvas();
    this.bindInlineEditor();

    this.form = el("div", "bb4a-form", { hidden: true });
    const seg = el("div", "bb4a-seg");
    this.objButton = el("button", "", { type: "button", textContent: t("typeObj") });
    this.textButton = el("button", "", { type: "button", textContent: t("typeText") });
    this.objButton.onclick = () => this.setActiveType("obj");
    this.textButton.onclick = () => this.setActiveType("text");
    seg.append(this.objButton, this.textButton);

    [this.textField, this.textArea] = this.createField("text", t("textLabel"), t("textPlaceholder"));
    const [descField, descArea] = this.createField("desc", t("descLabel"), t("descPlaceholder"));
    this.descArea = descArea;

    const colors = el("div", "bb4a-colors");
    this.swatches = el("div", "bb4a-swatches");
    colors.append(el("span", "bb4a-colors-label", { textContent: t("colors") }), this.swatches);
    this.form.append(seg, this.textField, descField, colors);
    this.hint = el("div", "bb4a-hint", { textContent: t("clickRegionToEdit") });
    const panel = el("div", "bb4a-panel");
    panel.append(this.form, this.hint);
    this.root.append(toolbar, this.stage, panel);

    this.resizeObserver = new ResizeObserver(() => this.fitCanvas());
    this.resizeObserver.observe(this.stage);
  }

  createField(key, label, placeholder) {
    const field = el("div", `bb4a-field ${key}`);
    const area = el("textarea", `bb4a-textarea ${key}`, { placeholder, spellcheck: false });
    area.dataset.captureWheel = "true";
    area.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    area.addEventListener("input", () => {
      const region = this.activeRegion;
      if (!region) return;
      region[key] = area.value;
      this.syncState();
    });
    field.append(el("span", "bb4a-field-label", { textContent: label }), area);
    return [field, area];
  }

  bindCanvas() {
    const c = this.canvas;
    c.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    c.addEventListener("pointermove", (e) => (this.drawing ? this.onDragMove(e) : this.onHoverMove(e)));
    c.addEventListener("pointerup", (e) => this.onPointerUp(e));
    c.addEventListener("pointercancel", (e) => this.onPointerUp(e));
    c.addEventListener("lostpointercapture", (e) => this.onPointerUp(e));
    c.addEventListener("pointerleave", () => this.onPointerLeave());
    c.addEventListener("dblclick", (e) => this.onDoubleClick(e));
    c.addEventListener("keydown", (e) => this.onKeyDown(e));
    c.addEventListener("focus", () => {
      this.focused = true;
      this.requestDraw();
    });
    c.addEventListener("blur", () => {
      this.focused = false;
      this.requestDraw();
    });
  }

  bindInlineEditor() {
    this.inline.dataset.captureWheel = "true";
    this.inline.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true });
    this.inline.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape") this.closeInlineEditor();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) this.commitInlineEditor();
    });
    this.inline.addEventListener("blur", () => this.commitInlineEditor());
  }

  // --- geometry -----------------------------------------------------------

  logicalSize() {
    return { w: this.canvas.clientWidth || 1, h: this.canvas.clientHeight || 1 };
  }

  pointerNorm(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / (r.width || 1)),
      y: clamp01((e.clientY - r.top) / (r.height || 1)),
    };
  }

  measureWidth(s) {
    const ctx = this.canvas.getContext("2d");
    ctx.font = TAG_FONT;
    return ctx.measureText(s).width;
  }

  gridSpec() {
    const axis = (size) => Math.max(GRID_PX, Math.ceil(size / MAX_GRID_CELLS)) / size;
    return { fx: axis(this.width), fy: axis(this.height) };
  }

  snapRegion(region, mode) {
    if (!this.grid) return region;
    const { fx, fy } = this.gridSpec();
    const snap = (v, step) => (step > 0 ? clamp01(Math.round(v / step) * step) : v);
    if (mode === "move") {
      return {
        ...region,
        x: Math.min(snap(region.x, fx), 1 - region.w),
        y: Math.min(snap(region.y, fy), 1 - region.h),
      };
    }
    const draw = mode === "draw";
    const left = draw || ["resize-l", "resize-tl", "resize-bl"].includes(mode);
    const right = draw || ["resize-r", "resize-tr", "resize-br"].includes(mode);
    const top = draw || ["resize-t", "resize-tl", "resize-tr"].includes(mode);
    const bottom = draw || ["resize-b", "resize-bl", "resize-br"].includes(mode);
    const x1 = left ? snap(region.x, fx) : region.x;
    const y1 = top ? snap(region.y, fy) : region.y;
    const x2 = right ? snap(region.x + region.w, fx) : region.x + region.w;
    const y2 = bottom ? snap(region.y + region.h, fy) : region.y + region.h;
    return { ...region, x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
  }

  candidatesAt(mN) {
    const { w, h } = this.logicalSize();
    return boxesAt(this.regions, mN.x, mN.y, HANDLE_PX, w, h, this.activeIndex);
  }

  activeResizeOr(cands) {
    return cands.find((c) => c.index === this.activeIndex && c.mode !== "move") || cands[0];
  }

  titleAt(mN) {
    const { w, h } = this.logicalSize();
    const rects = tagRects(this.regions, w, h, (s) => this.measureWidth(s));
    const px = mN.x * w;
    const py = mN.y * h;
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = rects[i];
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
    }
    return null;
  }

  pickForSelection(mN, cycle) {
    const cands = this.candidatesAt(mN);
    if (!cands.length) return null;
    const activeResize = cands.find((c) => c.index === this.activeIndex && c.mode !== "move");
    if (activeResize && !cycle) return activeResize;
    const ti = this.titleAt(mN);
    if (ti !== null && !cycle) return { index: ti, mode: "move" };
    if (cycle && cands.length > 1) {
      const pos = cands.findIndex((c) => c.index === this.activeIndex);
      return cands[(pos + 1) % cands.length];
    }
    return this.activeResizeOr(cands);
  }

  // --- pointer / keyboard -------------------------------------------------

  onPointerDown(e) {
    if (e.button !== 0) return;
    this.canvas.focus();
    this.hoverTagIndex = null;
    this.hoverIndex = null;
    const mN = this.pointerNorm(e);
    const hit = this.pickForSelection(mN, e.altKey);
    if (hit) {
      this.activeIndex = hit.index;
      this.dragMode = hit.mode;
      this.boxAtStart = { ...this.regions[hit.index] };
    } else {
      const box = { x: mN.x, y: mN.y, w: 0, h: 0, type: "obj", text: "", desc: "", palette: [] };
      this.regions.push(box);
      this.activeIndex = this.regions.length - 1;
      this.dragMode = "draw";
      this.boxAtStart = { ...box };
    }
    this.drawing = true;
    this.dragStart = mN;
    this.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    this.refreshPanel();
    this.requestDraw();
  }

  onDragMove(e) {
    if (!this.boxAtStart || !this.dragStart || !this.dragMode) return;
    const mN = this.pointerNorm(e);
    const moved = applyDrag(this.dragMode, this.boxAtStart, mN.x - this.dragStart.x, mN.y - this.dragStart.y);
    this.regions[this.activeIndex] = this.snapRegion(moved, this.dragMode);
    this.requestDraw();
  }

  onPointerUp(e) {
    if (!this.drawing) return;
    this.drawing = false;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    const b = this.activeRegion;
    if (b && (b.w < 0.005 || b.h < 0.005)) this.removeRegion(this.activeIndex);
    this.syncState();
  }

  onHoverMove(e) {
    const mN = this.pointerNorm(e);
    const ti = this.titleAt(mN);
    const cands = this.candidatesAt(mN);
    const hit = cands.length ? this.activeResizeOr(cands) : null;
    const hb = ti !== null ? ti : hit ? hit.index : null;
    if (ti !== this.hoverTagIndex || hb !== this.hoverIndex) {
      this.hoverTagIndex = ti;
      this.hoverIndex = hb;
      this.canvas.style.cursor = ti !== null ? "pointer" : "crosshair";
      this.requestDraw();
    }
  }

  onPointerLeave() {
    if (this.hoverTagIndex === null && this.hoverIndex === null) return;
    this.hoverTagIndex = null;
    this.hoverIndex = null;
    this.canvas.style.cursor = "crosshair";
    this.requestDraw();
  }

  onDoubleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const cands = this.candidatesAt(this.pointerNorm(e));
    const target = cands.find((c) => c.index === this.activeIndex) || cands[0];
    if (target) this.openInlineEditor(target.index);
  }

  onKeyDown(e) {
    if (this.drawing) return;
    if ((e.key === "Delete" || e.key === "Backspace") && this.activeIndex >= 0) {
      e.preventDefault();
      e.stopPropagation();
      this.removeRegion(this.activeIndex);
      this.syncState();
    }
  }

  openInlineEditor(index) {
    const b = this.regions[index];
    this.activeIndex = index;
    this.inlineIndex = index;
    const { w: W, h: H } = this.logicalSize();
    const w = Math.min(W, Math.max(70, b.w * W));
    const h = Math.min(H, Math.max(42, b.h * H));
    Object.assign(this.inline.style, {
      left: `${Math.max(0, Math.min(b.x * W, W - w))}px`,
      top: `${Math.max(0, Math.min(b.y * H, H - h))}px`,
      width: `${w}px`,
      height: `${h}px`,
      borderColor: b.palette.find(Boolean) || "#46b4e6",
    });
    this.inline.value = b.desc || "";
    this.inline.hidden = false;
    this.refreshPanel();
    this.inline.focus();
    this.inline.select();
  }

  closeInlineEditor() {
    this.inlineIndex = -1;
    this.inline.hidden = true;
  }

  commitInlineEditor() {
    const region = this.regions[this.inlineIndex];
    if (!region) return this.closeInlineEditor();
    region.desc = this.inline.value;
    this.closeInlineEditor();
    this.syncState();
  }

  // --- state --------------------------------------------------------------

  removeRegion(i) {
    this.regions.splice(i, 1);
    if (!this.regions.length) this.activeIndex = -1;
    else if (i <= this.activeIndex) this.activeIndex = Math.max(0, this.activeIndex - 1);
  }

  setActiveType(type) {
    const region = this.activeRegion;
    if (!region) return;
    region.type = type;
    this.syncState();
  }

  clearAll() {
    this.regions = [];
    this.activeIndex = -1;
    this.pendingIncoming = null;
    this.setLastIncoming([]);
    this.syncState();
  }

  load(boxes) {
    this.regions = fromBoundingBoxes(boxes, this.width, this.height);
    this.activeIndex = this.regions.length ? 0 : -1;
    this.value = toBoundingBoxes(this.regions, this.width, this.height);
    this.refreshPanel();
    this.requestDraw();
  }

  syncState() {
    this.value = toBoundingBoxes(this.regions, this.width, this.height);
    this.widget?.callback?.(this.value);
    this.node.setDirtyCanvas?.(true, true);
    this.refreshPanel();
    this.requestDraw();
  }

  onDimensionsChanged() {
    this.fitCanvas();
    this.syncState();
  }

  lastIncomingWidget() {
    return this.node.widgets?.find((w) => w.name === "last_incoming");
  }

  lastIncomingValue() {
    const value = this.lastIncomingWidget()?.value;
    return Array.isArray(value) && value.every(isBoundingBox) ? value : [];
  }

  setLastIncoming(boxes) {
    const widget = this.lastIncomingWidget();
    if (!widget) return;
    widget.value = structuredClone(boxes);
    widget.callback?.(widget.value);
  }

  applyIncoming(incoming) {
    if (this.drawing || sameBoxes(incoming, this.lastIncomingValue())) return;
    this.regions = fromBoundingBoxes(incoming, this.width, this.height);
    this.activeIndex = this.regions.length ? 0 : -1;
    this.setLastIncoming(incoming);
    this.syncState();
  }

  receiveIncoming(incoming) {
    if (this.bgLoading) this.pendingIncoming = incoming;
    else this.applyIncoming(incoming);
  }

  flushIncoming() {
    const incoming = this.pendingIncoming;
    this.pendingIncoming = null;
    if (incoming) this.applyIncoming(incoming);
  }

  // --- background ---------------------------------------------------------

  backgroundConnected() {
    const slot = this.node.findInputSlot("background");
    return slot >= 0 && this.node.isInputConnected(slot);
  }

  backgroundUrl() {
    const source = upstreamNode(this.node, "background");
    if (!source) return null;
    const upstream = nodeImageUrl(source);
    if (upstream) return upstream;
    return this.savedBackground?.sourceId === source.id ? this.savedBackground.url : null;
  }

  rememberSavedBackground(image) {
    const source = upstreamNode(this.node, "background");
    this.savedBackground = image && source ? { url: viewUrl(image), sourceId: source.id } : null;
  }

  refreshBackground() {
    const url = this.backgroundUrl();
    if (url === this.bgUrl) return;
    this.bgUrl = url;
    if (!url) {
      this.bgImage = null;
      this.bgLoading = false;
      this.requestDraw();
      this.flushIncoming();
      return;
    }
    this.bgLoading = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (this.bgUrl !== url) return;
      this.bgImage = img;
      this.bgLoading = false;
      this.applyImageDimensions(img.naturalWidth, img.naturalHeight);
      this.requestDraw();
      this.flushIncoming();
    };
    img.onerror = () => {
      if (this.bgUrl !== url) return;
      this.bgLoading = false;
      this.flushIncoming();
    };
    img.src = url;
  }

  applyImageDimensions(naturalWidth, naturalHeight) {
    const snap = (v) => Math.max(DIMENSION_STEP, Math.round(v / DIMENSION_STEP) * DIMENSION_STEP);
    for (const [name, target] of [["width", snap(naturalWidth)], ["height", snap(naturalHeight)]]) {
      const widget = this.dimWidget(name);
      if (!widget || widget.value === target) continue;
      widget.value = target;
      widget.callback?.(target);
    }
  }

  updateDimensionVisibility() {
    const hidden = this.backgroundConnected();
    for (const name of ["width", "height"]) {
      const widget = this.dimWidget(name);
      if (widget) widget.hidden = hidden;
    }
    this.node.setDirtyCanvas?.(true, true);
  }

  // --- panel --------------------------------------------------------------

  refreshPanel() {
    const region = this.activeRegion;
    this.form.hidden = !region;
    this.hint.hidden = !!region;
    if (!region) return;
    this.objButton.classList.toggle("active", region.type === "obj");
    this.textButton.classList.toggle("active", region.type === "text");
    this.textField.hidden = region.type !== "text";
    if (document.activeElement !== this.textArea) this.textArea.value = region.text;
    if (document.activeElement !== this.descArea) this.descArea.value = region.desc;
    this.renderSwatches(region.palette);
  }

  setPalette(palette) {
    const region = this.activeRegion;
    if (!region) return;
    region.palette = palette;
    this.syncState();
  }

  renderSwatches(palette) {
    const key = palette.join(",");
    if (key === this.swatchKey) return;
    this.swatchKey = key;
    this.swatches.replaceChildren();
    palette.forEach((hex, i) => {
      const swatch = el("label", "bb4a-swatch", { title: t("swatchTitle") });
      swatch.dataset.index = String(i);
      swatch.style.background = hex;
      const input = el("input", "", { type: "color", value: hex.slice(0, 7) });
      input.addEventListener("input", () => {
        const next = this.activeRegion.palette.slice();
        next[i] = input.value;
        swatch.style.background = input.value;
        this.swatchKey = next.join(",");
        this.setPalette(next);
      });
      swatch.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = this.activeRegion.palette.slice();
        next.splice(i, 1);
        this.setPalette(next);
      });
      swatch.addEventListener("pointerdown", (e) => this.startSwatchDrag(i, e));
      swatch.append(input);
      this.swatches.append(swatch);
    });
    if (palette.length < MAX_ELEMENT_COLORS) {
      const add = el("button", "bb4a-add", { type: "button", textContent: "+", title: t("addColor") });
      add.onclick = () => this.setPalette([...this.activeRegion.palette, "#ffffff"]);
      this.swatches.append(add);
    }
  }

  startSwatchDrag(index, e) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let active = false;
    const stop = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", stop);
      document.removeEventListener("pointercancel", stop);
    };
    const move = (ev) => {
      if ((ev.buttons & 1) === 0) return stop();
      if (!active && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 4) return;
      active = true;
      for (const other of this.swatches.querySelectorAll("[data-index]")) {
        const oi = Number(other.dataset.index);
        if (oi === index) continue;
        const r = other.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top - 6 || ev.clientY > r.bottom + 6) continue;
        const next = this.activeRegion.palette.slice();
        const [moved] = next.splice(index, 1);
        const insertAt = ev.clientX > r.left + r.width / 2 ? oi + 1 : oi;
        next.splice(insertAt > index ? insertAt - 1 : insertAt, 0, moved);
        stop();
        this.setPalette(next);
        return;
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", stop);
    document.addEventListener("pointercancel", stop);
  }

  // --- drawing ------------------------------------------------------------

  fitCanvas() {
    const sw = this.stage.clientWidth;
    const sh = this.stage.clientHeight;
    if (!sw || !sh) return;
    const ratio = this.width / this.height;
    const w = Math.min(sw, sh * ratio);
    this.frame.style.width = `${Math.floor(w)}px`;
    this.frame.style.height = `${Math.floor(w / ratio)}px`;
    this.requestDraw();
  }

  requestDraw() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  drawDots(ctx, W, H) {
    const { fx, fy } = this.gridSpec();
    if (fx <= 0 || fy <= 0) return;
    const cols = Math.round(1 / fx);
    const rows = Math.round(1 / fy);
    ctx.save();
    ctx.globalAlpha = DOT_ALPHA;
    ctx.fillStyle = getComputedStyle(this.canvas).color;
    ctx.beginPath();
    for (let i = 0; i <= cols; i++) {
      const cx = Math.min(1, i * fx) * W;
      for (let j = 0; j <= rows; j++) {
        const cy = Math.min(1, j * fy) * H;
        ctx.moveTo(cx + DOT_RADIUS, cy);
        ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
      }
    }
    ctx.fill();
    ctx.restore();
  }

  draw() {
    const c = this.canvas;
    const { w: W, h: H } = this.logicalSize();
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.max(1, Math.round(W * dpr));
    const bh = Math.max(1, Math.round(H * dpr));
    if (c.width !== bw || c.height !== bh) {
      c.width = bw;
      c.height = bh;
    }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0, W, H);
      ctx.fillStyle = `rgba(0,0,0,${BG_DIM})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.grid) this.drawDots(ctx, W, H);

    const showActive = this.focused || !!this.node.selected;
    const aIdx = showActive ? this.activeIndex : -1;
    const order = this.regions.map((_, i) => i).filter((i) => i !== aIdx).reverse();
    if (aIdx >= 0 && aIdx < this.regions.length) order.push(aIdx);
    const rects = tagRects(this.regions, W, H, (s) => this.measureWidth(s));

    for (const i of order) {
      const b = this.regions[i];
      const active = i === aIdx;
      const pal = b.palette.filter(Boolean);
      const col = pal.length ? pal[0].slice(0, 7) : "#8c8c8c";
      const x1 = b.x * W;
      const y1 = b.y * H;
      const w = b.w * W;
      const h = b.h * H;
      const hovered = i === this.hoverIndex || active;

      if (active) {
        ctx.fillStyle = "rgba(26,26,26,0.88)";
        ctx.fillRect(x1, y1, w, h);
      }
      ctx.fillStyle = col + (hovered ? "3a" : "22");
      ctx.fillRect(x1, y1, w, h);

      const lw = active ? 2 : hovered ? 1.5 : 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.strokeRect(x1 + lw / 2, y1 + lw / 2, w - lw, h - lw);

      if (pal.length) {
        const sw = w / pal.length;
        for (let p = 0; p < pal.length; p++) {
          const sx = x1 + Math.round(p * sw);
          ctx.fillStyle = pal[p];
          ctx.fillRect(sx, y1, x1 + Math.round((p + 1) * sw) - sx, 7);
        }
      }

      ctx.save();
      ctx.beginPath();
      ctx.rect(x1, y1, w, h);
      ctx.clip();

      let body = b.desc || "";
      if (b.type === "text" && b.text) body = `"${b.text}"` + (body ? ` — ${body}` : "");
      if (body) {
        ctx.font = BODY_FONT;
        ctx.fillStyle = readableTextColor(col);
        let ty = y1 + 27;
        for (const line of wrapLines(ctx, body, w - 8)) {
          if (ty > y1 + h) break;
          ctx.fillText(line, x1 + 4, ty);
          ty += 14;
        }
      }

      const tr = rects[i];
      ctx.font = TAG_FONT;
      ctx.fillStyle = col;
      ctx.fillRect(tr.x, tr.y, tr.w, 14);
      if (i === this.hoverTagIndex) {
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(tr.x, tr.y, tr.w, 14);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.strokeRect(tr.x + 0.5, tr.y + 0.5, tr.w - 1, 13);
      }
      ctx.fillStyle = textOnColor(col);
      ctx.fillText(tr.tag, tr.x + 4, tr.y + 11);
      ctx.restore();
    }
  }

  dispose() {
    this.resizeObserver.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
  }
}

function chainCallback(object, property, callback) {
  const original = object[property];
  object[property] = function () {
    const result = original?.apply(this, arguments);
    callback.apply(this, arguments);
    return result;
  };
}

app.registerExtension({
  name: "ComfyUI-4A-BoundingBoxes",

  getCustomWidgets() {
    return {
      [EDITOR_TYPE](node, inputName) {
        const editor = new BoundingBoxesEditor(node);
        node.__bb4aEditor = editor;
        const minHeight = 340;
        const widget = node.addDOMWidget(inputName, EDITOR_TYPE, editor.root, {
          getValue: () => editor.value,
          setValue: (value) => editor.load(value),
          getMinHeight: () => minHeight,
          // Stop 8px short of the node bottom so LiteGraph's resize corners stay reachable.
          getMaxHeight: () => {
            const top = Number(widget?.last_y);
            const widgetTop = Number.isFinite(top) && top > 0 ? top : 80;
            return Math.max(minHeight, Number(node.size?.[1] || 680) - widgetTop - 8);
          },
          hideOnZoom: false,
          margin: 0,
          onDraw: (w) => {
            const nodeWidth = Number(node.size?.[0]);
            if (nodeWidth > 0 && w.width !== nodeWidth) w.width = nodeWidth;
            editor.refreshBackground();
          },
        });
        editor.widget = widget;
        return { widget };
      },
      [STATE_TYPE](node, inputName) {
        const widget = node.addCustomWidget({
          name: inputName,
          type: STATE_TYPE,
          value: [],
          options: {},
          draw() {},
          computeSize: () => [0, -4],
        });
        widget.hidden = true;
        return { widget };
      },
    };
  },

  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_CLASS) return;

    chainCallback(nodeType.prototype, "onNodeCreated", function () {
      const editor = this.__bb4aEditor;
      if (!editor) return;
      for (const name of ["width", "height"]) {
        const widget = editor.dimWidget(name);
        if (widget) chainCallback(widget, "callback", () => editor.onDimensionsChanged());
      }
      this.resizable = true;
      this.setSize([Math.max(this.size[0], 420), Math.max(this.size[1], 680)]);
      editor.updateDimensionVisibility();
    });

    chainCallback(nodeType.prototype, "onConfigure", function () {
      const editor = this.__bb4aEditor;
      if (!editor) return;
      editor.gridButton.classList.toggle("active", editor.grid);
      editor.updateDimensionVisibility();
      editor.fitCanvas();
    });

    chainCallback(nodeType.prototype, "onConnectionsChange", function () {
      this.__bb4aEditor?.updateDimensionVisibility();
    });

    chainCallback(nodeType.prototype, "onExecuted", function (message) {
      const editor = this.__bb4aEditor;
      if (!editor) return;
      editor.rememberSavedBackground(message?.background_images?.[0]);
      editor.refreshBackground();
      const slot = this.findInputSlot("bboxes");
      const incoming = message?.input_bboxes;
      if (slot >= 0 && this.isInputConnected(slot) && Array.isArray(incoming)
        && incoming.length && incoming.every(isBoundingBox)) {
        editor.receiveIncoming(incoming);
      }
    });

    chainCallback(nodeType.prototype, "onSelected", function () {
      this.__bb4aEditor?.requestDraw();
    });
    chainCallback(nodeType.prototype, "onDeselected", function () {
      this.__bb4aEditor?.requestDraw();
    });
    chainCallback(nodeType.prototype, "onRemoved", function () {
      this.__bb4aEditor?.dispose();
    });
  },
});
