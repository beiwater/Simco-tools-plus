# SimComps Little Tools Design System

## 1. Atmosphere & Identity

这是一个在游戏页面上叠加的紧凑工具面板：深色、低干扰、信息密度高。识别性的材质是半透明炭黑表面与白色字体变量形成的层次，绿色仅表示可用/已启用的工具状态；新界面应嵌入既有组件侧栏，而不是模拟游戏原生界面。

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Text | `--fontColor` | existing feature-config value | All foreground text |
| Surface | `--sct-surface` | `rgba(0, 0, 0, 0.9)` | Settings and AutoMax panel body |
| Surface muted | `--sct-surface-muted` | `rgba(0, 0, 0, 0.7)` | Secondary panel backing |
| Control | `--sct-control` | `rgb(76, 76, 76)` | Inputs and neutral buttons |
| Control hover | `--sct-control-hover` | `rgb(114, 114, 114)` | Hover/active control state |
| Enabled | `--sct-enabled` | `#14541d` | Persisted enabled setting and active tag state |
| Enabled hover | `--sct-enabled-hover` | `#339841` | Hover state for enabled controls |
| Focus | `--sct-focus` | `wheat` | Visible keyboard focus outline/shadow |
| Error | `--sct-error` | `red` | Destructive close/failed action only |
| Light surface | `market light surface` | `rgba(255, 255, 255, 0.95)` | Original AutoMax market strip when the game body is light |
| Light text | `market light text` | `#333` | Market controls and summaries on the light surface |
| Light control | `market light control` | `#fff` / `#bbb` border | Compact inputs and selectors in the light game theme |
| Warning | `market warning` | `#e67800` | No-positive-profit and insufficient-supply status |

Rules: use semantic variables, never introduce ad-hoc colors; green expresses enabled state only; opaque/transparent dark surfaces keep the game visible behind overlays.

## 3. Typography

Primary stack: the game page/system sans stack inherited by the plugin. Use existing sizes: 21px title, 20px section label, 14px body/control, 12px description. Body text does not drop below 12px because the settings surface is information-dense. Numerical values may inherit the game font; no extra font dependency is introduced.

## 4. Spacing & Layout

Base unit is 4px. Use 4/8/12/16/20px steps for controls, groups, and panel padding. The settings modal remains centered and scroll-owned by `#script_setting_body`; the floating AutoMax panel is viewport-clamped and never causes page horizontal scroll. At narrow widths, action rows wrap to one readable column and controls retain a minimum 36px target.

## 5. Components

### Component sidebar and settings modal

- Structure: existing `basisCPT` hover launcher, component list, modal header/body.
- States: default, hover, enabled, disabled, keyboard focus, empty search.
- Accessibility: buttons use native `button`, labels bind checkboxes, keyboard focus remains visible, modal content scrolls independently.
- Motion: existing 100–250ms transform/opacity-style transition only; reduced-motion disables nonessential transitions.

### Custom background image importer

- Structure: the existing settings card contains one keyboard-focusable drop zone, separate image and folder pickers, an import status line, and the legacy CSS/URL textarea.
- States: empty, drag-over, reading, persisted, and unsupported-file error. A folder import uses its first supported image and names that file in the status line.
- Persistence: local images are stored as Data URLs in the component's existing IndexedDB-backed settings, so no image is uploaded to a server.
- Accessibility: the drop zone opens the image picker with Enter or Space, native file inputs retain browser semantics, and status changes use a polite live region.

### AutoMax control panel

- Structure: existing SCT component entry opens a movable title/status panel with settings, runtime-duration presets, and a saturation-table shortcut. No second global launcher is created.
- States: closed, open from the SCT component entry, dragging by the panel title, settings saved, malformed legacy data ignored, no saturation data.
- Spacing: 8px control rhythm, 12px panel padding, 16px section separation.
- Accessibility: native buttons and checkbox labels; panel visibility follows the SCT entry action; drag never replaces keyboard access.
- Layout: fixed viewport overlay with the document as scroll owner; the panel body is its own vertical scroll owner when content exceeds viewport height.

### AutoMax saturation table

- Structure: title/close row, weather-speed status, safe external history link, and sortable resource/quality/saturation table.
- States: cached data, unavailable data, ascending/descending column sort, and closed.
- Layout: fixed viewport overlay with one scroll owner; it follows the same 1048 overlay layer as the AutoMax panel and never adds a global launcher.

### AutoMax market simulation strip

- Structure: compact inline controls above market orders for custom executive data, MP adjustment, economy override, building level/runtime, aggregate status, and per-order profit.
- States: light/dark game theme, custom data off/on, recalculating, no positive order, partial supply, full runtime, and best-row highlight.
- Reference: the original AutoMax market strip supplied by the user on 2026-07-20; light mode uses a translucent white surface, dark text, neutral inputs, green leading rule, and amber warning text.

## 6. Motion & Interaction

Controls transition within 100–150ms using existing ease-in/ease-in-out behavior. Opening/closing is represented through opacity/transform, never layout-property animation. Drag feedback is immediate; a moved launcher suppresses the following click. Under `prefers-reduced-motion: reduce`, panel transitions are disabled.

## 7. Depth & Surface

Strategy: mixed, matching the existing plugin. Dark tonal surfaces separate primary/secondary layers; modal overlays use one subtle shadow and existing border radius. The AutoMax panel is 1048 so it yields to the existing main containers (1049), SCT hover launcher (1050), settings modal (1051), and alerts (10000). New panel elements must not create a competing layer scale.

## 8. Accessibility Constraints & Accepted Debt

Target WCAG 2.2 AA: keyboard-reachable settings, visible focus, descriptive Chinese labels, no color-only enabled signal, reduced-motion support, and resilient layout at 200% zoom. No accepted accessibility debt. The game’s external DOM and the local-userscript browser installation are outside this component’s control and are recorded in task evidence when they prevent live injection QA.
