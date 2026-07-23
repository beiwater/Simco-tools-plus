const BaseComponent = require("../tools/baseComponent.js");

// allow: SIZE_OK — declarative, order-sensitive stylesheet; splitting would change cascade ownership.
const AUTO_MAX_UI_THEME_CSS = `
  :root {
    --sct-surface: rgba(15, 19, 17, 0.96);
    --sct-surface-opaque: #0f1311;
    --sct-surface-elevated: rgba(26, 32, 29, 0.96);
    --sct-surface-muted: rgba(255, 255, 255, 0.055);
    --sct-surface-hover: rgba(255, 255, 255, 0.09);
    --sct-border: rgba(255, 255, 255, 0.14);
    --sct-border-strong: rgba(255, 255, 255, 0.24);
    --sct-control: rgba(255, 255, 255, 0.08);
    --sct-control-hover: rgba(255, 255, 255, 0.15);
    --sct-enabled: #14541d;
    --sct-enabled-hover: #339841;
    --sct-enabled-soft: rgba(51, 152, 65, 0.18);
    --sct-text-secondary: #aeb8b1;
    --sct-text-muted: color-mix(in srgb, var(--fontColor) 68%, transparent);
    --sct-focus: #f3d58a;
    --sct-error: #ff6b6b;
    --sct-warning: #f5b84b;
    --sct-edge-highlight: rgba(255, 255, 255, 0.06);
    --sct-panel-shadow: 0 24px 64px rgba(0, 0, 0, 0.55), 0 2px 12px rgba(0, 0, 0, 0.28);
    --sct-strip-shadow: 0 8px 24px rgba(0, 0, 0, 0.24), inset 0 1px rgba(255, 255, 255, 0.05);
    --sct-light-surface: rgba(255, 255, 255, 0.96);
    --sct-light-surface-muted: #f3f6f4;
    --sct-light-text: #243029;
    --sct-light-control: #fff;
    --sct-light-control-border: #b9c2bc;
    --sct-light-border: #d7ddd9;
    --sct-light-enabled-surface: #e6f2e8;
    --sct-light-enabled-text: #205b24;
    --sct-light-enabled-border: #2e7d32;
    --sct-light-warning: #a35400;
    --sct-light-shadow: 0 8px 24px rgba(30, 45, 36, 0.12);
  }

  #script_cpt_node {
    background: linear-gradient(160deg, var(--sct-surface-elevated), var(--sct-surface) 62%);
    border-left: 1px solid var(--sct-border-strong);
    box-shadow: var(--sct-panel-shadow);
    box-sizing: border-box;
    max-width: 100vw;
    min-width: 0;
    padding: 0 0 20px;
    scrollbar-color: var(--sct-control-hover) transparent;
    width: min(460px, 100vw);
  }

  #scriptCPT_innerHead {
    background: var(--sct-surface-opaque);
    border-bottom: 1px solid var(--sct-border);
    box-sizing: border-box;
    padding: 16px 20px 12px;
    position: sticky;
    top: 0;
    z-index: 3;
  }

  #scriptCPT_innerHead h1 {
    font-size: 24px;
    letter-spacing: -0.03em;
    margin: 0 0 12px !important;
  }

  #script_cptSearch_input {
    background: var(--sct-control);
    border: 1px solid var(--sct-border);
    border-radius: 8px;
    color: var(--fontColor);
    min-height: 40px;
    padding: 8px 12px;
    width: 100%;
  }

  #script_cptSearch_input::placeholder {
    color: var(--sct-text-secondary);
    opacity: 1;
  }

  #script_cptSearch_input:focus-visible,
  #scriptCPT_tagSerach button:focus-visible,
  #scriptCPT_mainBody button:focus-visible {
    outline: 2px solid var(--sct-focus);
    outline-offset: 2px;
  }

  div#script_cpt_node > div#scriptCPT_tagSerach {
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    max-height: 132px;
    overflow: auto;
    padding: 12px !important;
  }

  div#script_cpt_node > div#scriptCPT_tagSerach > button {
    background: var(--sct-control);
    border: 1px solid var(--sct-border);
    border-radius: 7px;
    color: var(--fontColor);
    cursor: pointer;
    line-height: 1;
    min-height: 32px;
    padding: 6px 10px;
    transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
  }

  div#script_cpt_node > div#scriptCPT_tagSerach > button:hover {
    background: var(--sct-control-hover);
    border-color: var(--sct-border-strong);
  }

  div#script_cpt_node > div#scriptCPT_tagSerach > button:active {
    transform: translateY(1px);
  }

  div#script_cpt_node > div#scriptCPT_tagSerach > button.script_tagSearch_active {
    background: var(--sct-enabled-soft);
    border-color: var(--sct-enabled-hover);
  }

  #scriptCPT_mainBody {
    padding: 0 12px;
  }

  #scriptCPT_mainBody > table {
    border-spacing: 0 6px !important;
  }

  #scriptCPT_mainBody > table > thead td {
    color: var(--sct-text-muted);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 8px;
  }

  #scriptCPT_mainBody tbody > tr > td {
    background: var(--sct-surface-muted);
    padding: 4px;
  }

  #scriptCPT_mainBody tbody > tr > td:first-child {
    border-radius: 8px 0 0 8px;
  }

  #scriptCPT_mainBody tbody > tr > td:last-child {
    border-radius: 0 8px 8px 0;
  }

  div#script_cpt_node #scriptCPT_mainBody tbody > tr > td > button {
    background: var(--sct-control);
    border: 1px solid var(--sct-border);
    border-radius: 6px;
    box-shadow: none;
    color: var(--fontColor);
    min-height: 36px;
    width: 100%;
  }

  div#script_cpt_node #scriptCPT_mainBody tbody > tr > td > button.funcExist {
    background: var(--sct-enabled-soft);
    border-color: var(--sct-enabled-hover);
  }

  div#script_cpt_node #scriptCPT_mainBody tbody > tr > td:first-child > button.funcExist::after {
    color: var(--sct-text-muted);
    content: " · 可用";
    font-size: 12px;
  }

  div#script_cpt_node #scriptCPT_mainBody tbody > tr > td > button:hover {
    background: var(--sct-control-hover);
    border-color: var(--sct-border-strong);
    box-shadow: none;
    color: var(--fontColor);
  }

  #scriptCPT_mainBody tr[data-sct-inline-settings] > td {
    background: transparent;
    border-radius: 0;
    padding: 0 0 4px;
  }

  #automax_forecast_panel,
  #automax_saturation_panel,
  .automax-exec-modal > section {
    background: linear-gradient(145deg, var(--sct-surface-elevated), var(--sct-surface) 58%);
    border: 1px solid var(--sct-border-strong);
    border-radius: 12px;
    box-shadow: var(--sct-panel-shadow), inset 0 1px var(--sct-edge-highlight);
    color: var(--fontColor);
    scrollbar-color: var(--sct-control-hover) transparent;
  }

  @supports (backdrop-filter: blur(12px)) {
    #automax_forecast_panel,
    #automax_saturation_panel,
    .automax-exec-modal > section {
      backdrop-filter: blur(12px) saturate(115%);
    }
  }

  #automax_forecast_panel > header,
  #automax_saturation_panel > header,
  .automax-exec-modal > section > header,
  .automax-panel-header {
    align-items: center;
    background: var(--sct-surface-opaque);
    border-bottom: 1px solid var(--sct-border);
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: space-between;
    margin: -12px -12px 12px;
    padding: 12px;
    position: sticky;
    top: -12px;
    z-index: 2;
  }

  .automax-exec-modal > section > header,
  .automax-panel-header {
    margin: -16px -16px 16px;
    padding: 12px 16px;
    top: -16px;
  }

  #automax_forecast_panel h2,
  #automax_saturation_panel h2,
  .automax-exec-modal h2 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.25;
    margin: 0;
    text-wrap: balance;
  }

  #automax_forecast_panel button,
  #automax_saturation_panel button,
  .automax-exec-modal button,
  .automax-exec-modal input,
  .automax-exec-modal select,
  .automax-exec-settings button,
  .automax-exec-settings input,
  .automax-inline-action,
  .automax-market-summary button,
  .automax-market-summary input,
  .automax-market-summary select {
    background: var(--sct-control);
    border: 1px solid var(--sct-border);
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--fontColor);
    font: inherit;
    min-height: 36px;
    transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
  }

  #automax_forecast_panel button:hover:not(:disabled),
  #automax_saturation_panel button:hover:not(:disabled),
  .automax-exec-modal button:hover:not(:disabled),
  .automax-inline-action:hover:not(:disabled),
  .automax-market-summary button:hover:not(:disabled) {
    background: var(--sct-control-hover);
    border-color: var(--sct-border-strong);
  }

  #automax_forecast_panel button:active:not(:disabled),
  #automax_saturation_panel button:active:not(:disabled),
  .automax-exec-modal button:active:not(:disabled),
  .automax-inline-action:active:not(:disabled),
  .automax-market-summary button:active:not(:disabled) {
    transform: translateY(1px);
  }

  #automax_forecast_panel :is(button, input, select):focus-visible,
  #automax_saturation_panel :is(button, input, select, a):focus-visible,
  .automax-exec-modal :is(button, input, select):focus-visible,
  .automax-exec-settings :is(button, input):focus-visible,
  .automax-inline-action:focus-visible,
  .automax-market-summary :is(button, input, select):focus-visible {
    outline: 2px solid var(--sct-focus);
    outline-offset: 2px;
  }

  #automax_forecast_panel button:disabled,
  #automax_saturation_panel button:disabled,
  .automax-exec-modal button:disabled,
  .automax-market-summary button:disabled {
    cursor: wait;
    opacity: 0.58;
  }

  .automax-exec-modal .sc-card-skill-input {
    min-height: 28px;
  }

  .automax-exec-modal .sc-card-name-input {
    background: transparent;
    border: 0;
    min-height: 32px;
  }

  .automax-exec-modal .sc-academy-level input {
    min-height: auto;
  }

  #automax_forecast_panel table,
  #automax_saturation_panel table,
  .automax-exec-modal table {
    border-collapse: separate;
    border-spacing: 0;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }

  #automax_forecast_panel th,
  #automax_saturation_panel th,
  .automax-exec-modal th {
    background: var(--sct-surface-elevated);
    color: var(--sct-text-muted);
    font-size: 12px;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  #automax_forecast_panel :is(th, td),
  #automax_saturation_panel :is(th, td),
  .automax-exec-modal :is(th, td) {
    border: 0;
    border-bottom: 1px solid var(--sct-border);
    padding: 8px;
  }

  #automax_forecast_panel tbody tr:hover,
  #automax_saturation_panel tbody tr:hover,
  .automax-exec-modal tbody tr:hover {
    background: var(--sct-surface-hover);
  }

  .automax-data-empty {
    color: var(--sct-warning);
    text-align: center;
  }

  #automax_forecast_panel details {
    background: var(--sct-surface-muted);
    border: 1px solid var(--sct-border);
    border-radius: 8px;
    margin-top: 8px;
    padding: 0 12px;
  }

  #automax_forecast_panel details > summary {
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    margin: 0 -12px;
    padding: 10px 12px;
    text-wrap: pretty;
  }

  #automax_forecast_panel details > summary:hover {
    background: var(--sct-surface-hover);
  }

  .automax-saturation-container {
    border-left: 3px solid var(--sct-enabled);
    display: grid;
    gap: 8px;
    padding: 8px 8px 8px 12px;
  }

  .automax-inline-action {
    font-weight: 600;
    width: 100%;
  }

  .automax-panel-link {
    color: var(--sct-focus);
    display: inline-block;
    margin-top: 4px;
    text-underline-offset: 3px;
  }

  .automax-saturation-meta,
  .automax-helper-text {
    color: var(--sct-text-muted);
  }

  .automax-nowrap {
    white-space: nowrap;
  }

  @media (max-width: 576px) {
    #script_cpt_node {
      width: 100%;
    }

    #automax_forecast_panel,
    #automax_saturation_panel {
      left: 8px;
      max-height: calc(100dvh - 16px);
      max-width: calc(100vw - 16px);
      top: 8px;
      width: calc(100vw - 16px);
    }

    .automax-exec-modal {
      align-items: stretch;
      padding: 8px;
    }

    .automax-exec-modal > section {
      max-height: calc(100dvh - 16px);
      max-width: 100%;
      padding: 12px;
    }

    .automax-exec-modal > section > header,
    .automax-panel-header {
      margin: -12px -12px 12px;
      padding: 12px;
      top: -12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    #automax_forecast_panel *,
    #automax_saturation_panel *,
    .automax-exec-modal *,
    .automax-market-summary * {
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

class autoMaxUITheme extends BaseComponent {
  constructor() {
    super();
    this.name = "AutoMax 界面主题";
    this.describe = "统一 AutoMax 面板、表格和控件的视觉与无障碍状态。";
    this.enable = true;
    this.canDisable = false;
    this.hideSetting = true;
    this.tagList = ["AutoMax", "基础"];
  }

  cssText = [AUTO_MAX_UI_THEME_CSS]
}

new autoMaxUITheme();

module.exports = { AUTO_MAX_UI_THEME_CSS };
