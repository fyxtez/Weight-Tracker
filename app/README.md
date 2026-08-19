# Weight Tracker client

React + TypeScript UI packaged with Tauri for Android and desktop. The client uses a local cache for responsive/offline operation and synchronizes authenticated day records with the Rust API.

```bash
npm install
npm run dev       # browser
npm run tauri dev # native desktop
npm run build     # TypeScript + Vite production build
```

Frontend code is organized into `components`, `hooks`, and `domain` modules. Native code in `src-tauri` is intentionally small and only handles platform-specific integration such as CSV export.
