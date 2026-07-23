# License map

Copyright (c) 2026 LIYUE, except where an individual file says otherwise.

This repository deliberately uses component-level licensing.

## MIT

The framework and LIYUE-authored components are licensed under the MIT License
in [`LICENSE`](LICENSE). This includes:

- `index.js`, build scripts, generic `tools/` code except `tools/automax/**`;
- `components/**` except `components/autoMax*.js` and
  `components/retailDisplayProfit.js`;
- generic tests, documentation, and configuration except `test/automax/**`.

## AGPL-3.0-or-later

The following AutoMax code is licensed under GNU Affero General Public License
version 3 or later:

- `components/autoMax*.js`;
- `components/retailDisplayProfit.js`;
- `tools/automax/**`;
- `test/automax/**`.

The complete AGPL text is available at
<https://www.gnu.org/licenses/agpl-3.0.html>.

## Built userscript

`dist/build.user.js` combines MIT and AGPL code. Because it contains the
AutoMax AGPL components, the distributed aggregate is offered under
**AGPL-3.0-or-later**. The MIT grant for the MIT-listed source files remains
available independently.
