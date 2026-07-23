const BaseComponent = require("../tools/baseComponent.js");
const { openSecondaryWindow } = require("../tools/secondaryWindowHost.js");

const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

function isGa4Url(value, base = "https://www.simcompanies.com/") {
  if (!value) return false;
  let url;
  try { url = new URL(typeof value === "string" ? value : value.url || String(value), base); }
  catch { return false; }
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  if (host === "google-analytics.com" || host.endsWith(".google-analytics.com")) return true;
  if (host === "stats.g.doubleclick.net" && /\/(?:g|j)\/collect(?:\/|$)/.test(path)) return true;
  if ((host === "googletagmanager.com" || host.endsWith(".googletagmanager.com")) && path === "/gtag/js") return true;
  return false;
}

function syntheticResponse() {
  if (typeof Response === "function") return new Response(null, { status: 204, statusText: "Blocked by SCT GA4 Blocker" });
  return { ok: true, status: 204, statusText: "Blocked by SCT GA4 Blocker", headers: { get: () => null }, clone() { return this; }, json: async () => ({}), text: async () => "" };
}

class ga4Blocker extends BaseComponent {
  constructor() {
    super();
    this.name = "Google Analytics 4 阻断";
    this.describe = "阻断 GA4 的收集接口、gtag.js、sendBeacon、fetch、XHR 和图片上报，并显示本次页面的拦截数量。";
    this.enable = false;
    this.tagList = ["工具"];
  }

  componentData = { blocked: 0, lastUrl: "", observer: undefined, installed: false }
  startupFuncList = [this.install]
  frontUI = this.showStatus
  cssText = [`.sct-ga4-status { color:var(--fontColor); display:grid; gap:10px; min-width:min(420px,85vw); } .sct-ga4-status strong { font-size:24px; } .sct-ga4-status code { color:var(--sct-muted,#aaa); overflow-wrap:anywhere; }`]

  record(url) {
    this.componentData.blocked += 1;
    this.componentData.lastUrl = String(typeof url === "string" ? url : url?.url || url || "");
    window.dispatchEvent(new CustomEvent("sct-ga4-blocked", { detail: { count: this.componentData.blocked } }));
  }

  install() {
    if (this.componentData.installed) return;
    this.componentData.installed = true;
    this.installFetch();
    this.installBeacon();
    this.installXhr();
    this.installImageGuard();
    this.installDomGuard();
  }

  installFetch() {
    const original = window.fetch;
    if (typeof original !== "function" || original.__sctGa4Blocker) return;
    const component = this;
    async function guardedFetch(input, init) {
      if (isGa4Url(input, location.href)) { component.record(input); return syntheticResponse(); }
      return original.call(this, input, init);
    }
    guardedFetch.__sctGa4Blocker = true;
    guardedFetch.__sctOriginal = original;
    window.fetch = guardedFetch;
  }

  installBeacon() {
    const original = navigator.sendBeacon;
    if (typeof original !== "function" || original.__sctGa4Blocker) return;
    const component = this;
    function guardedBeacon(url, data) {
      if (isGa4Url(url, location.href)) { component.record(url); return true; }
      return original.call(this, url, data);
    }
    guardedBeacon.__sctGa4Blocker = true;
    try { navigator.sendBeacon = guardedBeacon; }
    catch { try { Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: guardedBeacon }); } catch {} }
  }

  installXhr() {
    const prototype = window.XMLHttpRequest?.prototype;
    if (!prototype || prototype.open?.__sctGa4Blocker) return;
    const originalOpen = prototype.open;
    const originalSend = prototype.send;
    const blocked = new WeakSet();
    const component = this;
    function guardedOpen(method, url, ...rest) {
      if (isGa4Url(url, location.href)) {
        blocked.add(this); component.record(url);
        return originalOpen.call(this, "GET", "data:application/json,{}", ...rest);
      }
      return originalOpen.call(this, method, url, ...rest);
    }
    function guardedSend(body) { return blocked.has(this) ? originalSend.call(this, null) : originalSend.call(this, body); }
    guardedOpen.__sctGa4Blocker = true;
    prototype.open = guardedOpen;
    prototype.send = guardedSend;
  }

  installImageGuard() {
    const prototype = window.HTMLImageElement?.prototype;
    const descriptor = prototype && Object.getOwnPropertyDescriptor(prototype, "src");
    if (!descriptor?.set || descriptor.set.__sctGa4Blocker || descriptor.configurable === false) return;
    const component = this;
    function guardedSet(value) {
      if (isGa4Url(value, location.href)) { component.record(value); return descriptor.set.call(this, TRANSPARENT_PIXEL); }
      return descriptor.set.call(this, value);
    }
    guardedSet.__sctGa4Blocker = true;
    try { Object.defineProperty(prototype, "src", { ...descriptor, set: guardedSet }); } catch {}
  }

  installDomGuard() {
    const removeBlocked = (root = document) => {
      const nodes = [];
      if (root.matches?.("script[src],img[src],iframe[src]")) nodes.push(root);
      root.querySelectorAll?.("script[src],img[src],iframe[src]").forEach((node) => nodes.push(node));
      for (const node of nodes) if (isGa4Url(node.src, location.href)) { this.record(node.src); node.remove(); }
    };
    removeBlocked();
    if (!document.documentElement || typeof MutationObserver !== "function") return;
    this.componentData.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) mutation.addedNodes.forEach((node) => { if (node.nodeType === 1) removeBlocked(node); });
    });
    this.componentData.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  showStatus() {
    const content = document.createElement("section");
    content.className = "sct-ga4-status";
    const count = document.createElement("strong");
    const description = document.createElement("div"); description.textContent = "本次页面已拦截的 GA4 请求";
    const latest = document.createElement("code");
    const update = () => { count.textContent = String(this.componentData.blocked); latest.textContent = this.componentData.lastUrl || "尚未发现 GA4 请求"; };
    update();
    window.addEventListener("sct-ga4-blocked", update);
    content.append(count, description, latest);
    openSecondaryWindow({ id: "ga4-blocker-status", title: "GA4 阻断状态", content, onClose: () => window.removeEventListener("sct-ga4-blocked", update) });
  }
}

new ga4Blocker();

module.exports = { isGa4Url, syntheticResponse };
