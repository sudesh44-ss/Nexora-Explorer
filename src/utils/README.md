# MyFileExplorer - Utils

These are generic reusable helpers for `src/utils/`.

Rules:
- `utils/` should contain reusable, feature-agnostic helpers.
- Do not put React components here.
- Do not put Electron IPC/business operations here.
- Feature-specific logic belongs in `src/features/`.
- UI belongs in `src/components/`.

Included:
- formatters
- file helpers
- path helpers
- platform detection
- validation
- error/result helpers
- string/array/object helpers
- debounce/throttle
- localStorage helpers
- constants
- logger

These files are migration-ready and should be wired into the existing `App.jsx` gradually.
