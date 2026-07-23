# SimComps Little Tools Design System

## 1. Atmosphere & Identity

这是一个在游戏页面上叠加的紧凑工具面板：深色、低干扰、信息密度高。识别性的材质是带轻微冷绿色偏色的半透明炭黑表面，通过内边光、弱阴影和不同透明度形成层次，不使用装饰性光晕。绿色仅表示可用/已启用的工具状态；新界面应嵌入既有组件侧栏，而不是模拟游戏原生界面。

## 2. Color

| Role | Token | Value | Usage |
|---|---|---|---|
| Text | `--fontColor` | existing feature-config value | All foreground text |
| Surface | `--sct-surface` | `rgba(15, 19, 17, 0.96)` | Settings and AutoMax panel body |
| Surface opaque | `--sct-surface-opaque` | `#0f1311` | Sticky headers that must fully occlude scrolled content |
| Surface elevated | `--sct-surface-elevated` | `rgba(26, 32, 29, 0.96)` | Headers and raised control groups |
| Surface muted | `--sct-surface-muted` | `rgba(255, 255, 255, 0.055)` | Secondary panel backing |
| Surface hover | `--sct-surface-hover` | `rgba(255, 255, 255, 0.09)` | Hovered rows and disclosure summaries |
| Border | `--sct-border` | `rgba(255, 255, 255, 0.14)` | Default separators and control outlines |
| Border strong | `--sct-border-strong` | `rgba(255, 255, 255, 0.24)` | Raised panels and focused groups |
| Control | `--sct-control` | `rgba(255, 255, 255, 0.08)` | Inputs and neutral buttons |
| Control hover | `--sct-control-hover` | `rgba(255, 255, 255, 0.15)` | Hover/active control state |
| Enabled | `--sct-enabled` | `#14541d` | Persisted enabled setting and active tag state |
| Enabled hover | `--sct-enabled-hover` | `#339841` | Hover state for enabled controls |
| Enabled soft | `--sct-enabled-soft` | `rgba(51, 152, 65, 0.18)` | Enabled background without competing with text |
| Text secondary | `--sct-text-secondary` | `#aeb8b1` | Accessible placeholder, empty-slot label, and required control boundary on dark surfaces |
| Text muted | `--sct-text-muted` | `color-mix(in srgb, var(--fontColor) 68%, transparent)` | Metadata and helper copy |
| Focus | `--sct-focus` | `#f3d58a` | Visible keyboard focus outline/shadow |
| Error | `--sct-error` | `#ff6b6b` | Destructive close/failed action only |
| Warning | `--sct-warning` | `#f5b84b` | Empty data and insufficient supply |
| Edge highlight | `--sct-edge-highlight` | `rgba(255, 255, 255, 0.06)` | Inset top edge on elevated surfaces |
| Panel shadow | `--sct-panel-shadow` | `0 24px 64px rgba(0, 0, 0, 0.55), 0 2px 12px rgba(0, 0, 0, 0.28)` | Floating overlay depth |
| Strip shadow | `--sct-strip-shadow` | `0 8px 24px rgba(0, 0, 0, 0.24)` plus inset edge | Inline market-strip depth |
| Light surface | `--sct-light-surface` | `rgba(255, 255, 255, 0.96)` | Original AutoMax market strip when the game body is light |
| Light surface muted | `--sct-light-surface-muted` | `#f3f6f4` | Grouped controls on the light surface |
| Light text | `--sct-light-text` | `#243029` | Market controls and summaries on the light surface |
| Light control | `--sct-light-control` / `--sct-light-control-border` | `#fff` / `#b9c2bc` | Compact inputs and selectors in the light game theme |
| Light border | `--sct-light-border` | `#d7ddd9` | Light-theme separators |
| Light enabled | `--sct-light-enabled-*` | `#e6f2e8` / `#205b24` / `#2e7d32` | Enabled surface, text, and border in the light theme |
| Light warning | `--sct-light-warning` | `#a35400` | No-positive-profit and insufficient-supply status on light surfaces |
| Light shadow | `--sct-light-shadow` | `0 8px 24px rgba(30, 45, 36, 0.12)` | Light-theme market-strip depth |

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

### AutoMax settings surfaces

- Structure: AutoMax features remain entries in the existing SCT component list. Each entry exposes its established inline settings or task-specific overlay; no second global launcher or standalone AutoMax panel is created.
- States: tag-filtered/search-filtered, enabled/disabled, inline settings open/closed, settings saved, malformed legacy data ignored, and no data.
- Spacing: 8px control rhythm, 12px panel padding, 16px section separation.
- Accessibility: native buttons and checkbox labels; inline and overlay visibility follows each SCT entry action; keyboard access remains available for every pointer action.
- Layout: inline settings scroll with the SCT component body. Task overlays are viewport-clamped and own their internal vertical scroll when content exceeds the viewport.

### AutoMax saturation table

- Structure: title/close row, weather-speed status, safe external history link, and sortable resource/quality/saturation table.
- States: cached data, unavailable data, ascending/descending column sort, and closed.
- Layout: the table expands inline beneath its SCT component row, shares the sidebar scroll owner, and never adds a global launcher or overlay layer.

### AutoMax market simulation strip

- Structure: compact inline controls above market orders for custom executive data, MP adjustment, economy override, building level/runtime, aggregate status, and per-order profit.
- States: light/dark game theme, custom data off/on, recalculating, no positive order, partial supply, full runtime, and best-row highlight.
- Reference: the original AutoMax market strip supplied by the user on 2026-07-20; light mode uses a translucent white surface, dark text, neutral inputs, green leading rule, and amber warning text.

### Shared AutoMax control primitives

- Overlay surface: forecast and executive windows share one elevated charcoal material, 12px outer radius, 8px control radius, an inset edge highlight, and the panel shadow token. Saturation reuses the same tonal materials inline.
- Header bar: title and actions remain visible at the top of a scrolling panel; actions wrap instead of compressing Chinese labels.
- Data toolbar: related controls form compact labelled groups, use tabular numerals, and collapse to a single readable column below 576px.
- Data table: one scroll owner, sticky header, tonal row hover, numeric alignment, and a visible sort direction on sortable headers.
- Status line: pending, empty, warning, and success messages use text plus semantic color; status never relies on an emoji or color alone.
- Inline action: component-table expansions use the same neutral control material and enabled green seam instead of one-off cyan buttons.

## 6. Motion & Interaction

Controls transition within 100–150ms using existing ease-in/ease-in-out behavior. Hover changes material and border; pressed feedback uses a 1px transform. Opening/closing is represented through opacity/transform, never layout-property animation. Executive-card drag feedback is immediate and retains an equivalent keyboard move path. Under `prefers-reduced-motion: reduce`, panel transitions are disabled.

## 7. Depth & Surface

Strategy: mixed, matching the existing plugin. Dark tonal surfaces separate primary/secondary layers; floating panels combine a cool-charcoal gradient, subtle backdrop blur, inset edge highlight, and `--sct-panel-shadow`. Floating AutoMax panels remain at 1048, below the existing main containers (1049), SCT hover launcher (1050), and settings modal (1051); inline expansions do not enter the global layer scale. Executive modal workflows use 1052 so they cover the launcher/settings surface while remaining strictly below alerts (10000). New panel elements must not create a competing layer scale.

## 8. Accessibility Constraints & Accepted Debt

Target WCAG 2.2 AA: keyboard-reachable settings, visible focus, descriptive Chinese labels, no color-only enabled signal, reduced-motion support, and resilient layout at 200% zoom. No accepted accessibility debt. The game’s external DOM and the local-userscript browser installation are outside this component’s control and are recorded in task evidence when they prevent live injection QA.
