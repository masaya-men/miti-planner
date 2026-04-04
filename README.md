<p align="center">
  <img src="docs/images/banner.jpg" alt="LoPo" width="600">
</p>

<p align="center">
  <b>A collection of handy tools for FFXIV</b><br>
  Built solo, driven by "I wish this existed!"
</p>

<p align="center">
  <a href="https://lopoly.app">App</a> &middot;
  <a href="https://discord.gg/z7uypbJSnN">Discord</a> &middot;
  <a href="https://x.com/lopoly_app">X (Twitter)</a> &middot;
  <a href="README.ja.md">日本語</a>
</p>

---

## Tools

### Mitigation Planner

Plan raid mitigations faster than spreadsheets. Place mitigations on an interactive timeline and simulate party survival in real time.

<p align="center">
  <img src="docs/images/timeline-dark.png" alt="Timeline (Dark Mode)" width="720"><br>
  <img src="docs/images/timeline-light.png" alt="Timeline (Light Mode)" width="720">
</p>

- **Timeline View** — Visualize damage and mitigations chronologically with real-time lethal checks
- **FFLogs Import** — Paste a log URL to auto-generate a timeline
- **Auto Planner** — One-click mitigation placement with recast awareness
- **Party Composition** — Freely configure 8 jobs and stats
- **Dark / Light / Focus modes** — Choose the view that suits you
- **i18n** — Japanese / English / Chinese / Korean
- **PWA** — Works on mobile and offline
- **Tutorial** — Interactive guide for first-time users

<p align="center">
  <img src="docs/images/mobile.png" alt="Mobile View" width="240">
</p>

### Housing Tour Planner

Coming soon.

---

## Feedback & Bug Reports

Join the [Discord server](https://discord.gg/z7uypbJSnN) — all feedback and bug reports are welcome!

---

<details>
<summary><b>Developer Setup</b></summary>

### Prerequisites

- Node.js 18+
- npm

### Getting Started

```bash
# Install dependencies
npm install

# (Optional) Set up FFLogs API
cp .env.local.example .env.local
# Add your FFLogs Client ID / Secret to .env.local

# Start dev server
npm run dev
```

### Build

```bash
npm run build
npm run preview  # Preview the build
```

### Deployment

Designed for [Vercel](https://vercel.com). Import the repo and set `FFLOGS_CLIENT_ID` and `FFLOGS_CLIENT_SECRET` as environment variables.

</details>

<details>
<summary><b>Tech Stack</b></summary>

| Category | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| State | Zustand |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion |
| Drag & Drop | dnd-kit |
| i18n | react-i18next |
| 3D Background | Three.js |
| PWA | vite-plugin-pwa |

</details>

---

## Copyright

This is an unofficial fan tool and is not affiliated with SQUARE ENIX CO., LTD.

FINAL FANTASY is a registered trademark of Square Enix Holdings Co., Ltd.

© SQUARE ENIX CO., LTD. All Rights Reserved.
