# TodoFlow

A cross-platform productivity application for **Windows, macOS, Linux, and Android** — built on Firebase with real-time cloud sync, secure email authentication, and a polished, intuitive interface.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Desktop | Electron + Electron Builder |
| Mobile | Capacitor + Android |
| Backend | Firebase Authentication, Cloud Firestore |
| CI/CD | GitHub Actions |

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| Java | 17 (Android builds only) |
| Android SDK | 34 (Android builds only) |
| Firebase Account | [Free tier available](https://firebase.google.com) |

---

## Project Structure

```
todoflow/
├── src/                    # Core web application
│   ├── index.html
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   └── icon-*.png
├── android/                # Capacitor Android project
├── .github/workflows/      # CI/CD pipelines
├── main.js                 # Electron entry point
├── capacitor.config.ts     # Capacitor configuration
└── package.json
```

---

## CI/CD

Push a version tag to automatically trigger builds across all platforms via GitHub Actions. A GitHub Release is published with all platform installers in approximately 10 minutes.

Optional code signing for Play Store (Android) and notarization (macOS) is supported via GitHub Secrets — see `.github/workflows/build-release.yml`.

---

<div align="center">

Built with Firebase · Electron · Capacitor · GitHub Actions

</div>