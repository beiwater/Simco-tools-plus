// SPDX-License-Identifier: AGPL-3.0-or-later
const EXECUTIVE_STYLES = `      .automax-exec-panel { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.7)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); display: grid; gap: 8px; margin-top: 12px; padding: 12px; }
      .automax-exec-panel p { margin: 0; overflow-wrap: anywhere; }
      .automax-exec-button, .automax-exec-modal button, .automax-exec-settings button { background: var(--sct-control, rgb(76, 76, 76)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); color: var(--fontColor); min-height: 30px; border-radius: 4px; padding: 4px 10px; cursor: pointer; }
      h3 > .automax-exec-button { margin-inline-start: 8px; }
      .automax-exec-button--primary { background: var(--sct-enabled-soft); border-color: var(--sct-enabled-hover); }
      .automax-action-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
      .automax-helper-text { font-size: 12px; line-height: 1.5; margin-bottom: 12px; text-wrap: pretty; }
      .automax-exec-modal { align-items: center; background: rgba(0, 0, 0, 0.6); display: flex; inset: 0; justify-content: center; position: fixed; z-index: 1052; }
      .automax-exec-modal > section { background: var(--sct-surface, rgb(36, 36, 36)); border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); box-sizing: border-box; color: var(--fontColor); max-height: 90vh; max-width: min(95vw, 1000px); overflow: auto; padding: 16px; width: 100%; border-radius: 12px; display: flex; flex-direction: column; }
      .automax-exec-modal h2, .automax-exec-modal h3 { margin: 0; }
      .automax-exec-modal table { border-collapse: collapse; width: 100%; }
      .automax-exec-modal td, .automax-exec-modal th { border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding: 4px; text-align: left; }
      .automax-exec-settings { display: grid; gap: 12px; }
      .automax-exec-settings label { display: grid; gap: 4px; }
      .automax-exec-settings input { background: var(--sct-control, rgb(76, 76, 76)); color: var(--fontColor); min-height: 30px; }

      .sc-boardroom-layout { display: flex; flex-direction: row; width: 100%; height: 100%; margin-top: 15px; }
      .sc-boardroom-left { flex: 7; display: flex; flex-direction: column; padding-right: 20px; border-right: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); max-height: 70vh; overflow-y: auto; }
      .sc-boardroom-right { flex: 3; padding-left: 20px; display: flex; flex-direction: column; max-height: 70vh; overflow-y: auto; }
      @media (max-width: 768px) {
        .sc-boardroom-layout { flex-direction: column; }
        .sc-boardroom-left { flex: none; border-right: none; padding-right: 0; border-bottom: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); padding-bottom: 20px; max-height: none; }
        .sc-boardroom-right { flex: none; padding-left: 0; padding-top: 20px; max-height: none; }
      }
      .sc-slots-group { margin-bottom: 20px; }
      .sc-slots-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; border-left: 3px solid var(--sct-focus, wheat); padding-left: 8px; }
      .sc-slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; }
      .sc-exec-card { background: var(--sct-surface-muted, rgba(0, 0, 0, 0.4)); border: 1px solid var(--sct-border); border-radius: 8px; padding: 28px 10px 10px; cursor: move; user-select: none; position: relative; box-shadow: inset 0 1px var(--sct-edge-highlight); transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease; }
      .sc-exec-card:hover { background: var(--sct-surface-hover); border-color: var(--sct-border-strong); transform: translateY(-1px); }
      .sc-exec-card:focus-visible, .sc-exec-card-empty:focus-visible { outline: 2px solid var(--sct-focus); outline-offset: 2px; }
      .sc-exec-card.dragged { opacity: 0.4; }
      .sc-exec-card-empty { border: 2px dashed var(--sct-text-secondary, #aeb8b1); background: rgba(0,0,0,0.1); border-radius: 8px; height: 110px; display: flex; align-items: center; justify-content: center; color: var(--sct-text-secondary, #aeb8b1); font-size: 12px; text-align: center; padding: 10px; box-sizing: border-box; }
      .sc-exec-card-empty.dragover { border-color: var(--sct-focus, wheat); background: rgba(255,255,255,0.05); }
      .sc-card-name { font-weight: bold; font-size: 13px; margin-bottom: 8px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sc-card-role { color: var(--sct-text-muted); font-size: 12px; font-weight: 700; letter-spacing: 0.08em; margin-bottom: 4px; text-align: center; text-transform: uppercase; }
      .sc-card-name-input { background: transparent; border: 0; color: var(--fontColor); font-size: 12px; font-weight: 700; margin-bottom: 8px; text-align: center; width: 100%; }
      .sc-card-remove { border-color: var(--sct-error) !important; color: var(--sct-error) !important; min-height: 24px !important; padding: 2px 6px !important; position: absolute; right: 4px; top: 4px; }
      .sc-card-remove:hover { background: color-mix(in srgb, var(--sct-error) 18%, transparent) !important; }
      .sc-card-skills { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .sc-card-skill-row { display: flex; align-items: center; gap: 3px; font-size: 12px; }
      .sc-card-skill-label { font-size: 12px; font-weight: bold; width: 28px; }
      .sc-card-skill-input { width: 100%; padding: 2px 4px; border: 1px solid var(--sct-control-hover, rgb(114, 114, 114)); border-radius: 3px; background: var(--sct-control, rgb(76, 76, 76)); color: var(--fontColor); font-size: 12px; box-sizing: border-box; text-align: center; }
      .sc-card-skill-input::-webkit-outer-spin-button, .sc-card-skill-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .sc-card-skill-input { -moz-appearance: textfield; }
      .sc-exec-card.selected { border-color: var(--sct-focus, wheat); box-shadow: 0 0 10px rgba(255,235,100,0.3); background: rgba(255,255,255,0.05); }
      .sc-boardroom-summary-title { border-bottom: 1px solid var(--sct-border); font-size: 15px; font-weight: 700; margin-bottom: 12px; padding-bottom: 8px; }
      .sc-academy-level { background: var(--sct-surface-muted); border: 1px solid var(--sct-border); border-radius: 8px; display: grid; font-size: 12px; gap: 8px; margin: 0 0 12px; padding: 10px; }
      .sc-academy-level legend { color: var(--sct-text-muted); font-size: 12px; font-weight: 600; padding: 0 4px; }
      .sc-academy-level div { display: flex; flex-wrap: wrap; gap: 8px 12px; }
      .sc-academy-level label { align-items: center; cursor: pointer; display: inline-flex; gap: 4px; }
      .sc-detail-box { background: var(--sct-surface-muted); border: 1px solid var(--sct-border); border-radius: 8px; box-sizing: border-box; color: var(--fontColor); font-size: 12px; line-height: 1.6; min-height: 120px; padding: 10px; }
      .sc-calc-table { font-size: 12px; margin-bottom: 12px; }
      .sc-calc-table :is(th, td) { padding: 8px 4px; }
      .sc-calc-number { font-variant-numeric: tabular-nums; text-align: right; }
      .sc-calc-label { font-weight: 600; white-space: nowrap; }
      .sc-calc-positive { color: var(--fontColor); font-weight: 700; }
      .sc-calc-negative { color: var(--sct-text-muted); }
      .sc-calc-row { cursor: pointer; }
      .sc-calc-row:focus-visible { outline: 2px solid var(--sct-focus); outline-offset: -2px; }
      .sc-calc-row.is-active { background: var(--sct-surface-hover); }
`;

module.exports = { EXECUTIVE_STYLES };
