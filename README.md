# Meetvora Desktop

**AI-powered stealth assistant for meetings, interviews, and real-time support — always by your side, never seen on screen.**

Meetvora Desktop is a compact, always-on-top Electron app that listens to conversations, analyzes screenshots, and delivers instant AI answers — invisibly overlaid on your screen during calls and live sessions.

---

## Features

| Feature | Description |
|---|---|
| **Meeting Assistant** | Senior IT Consultant persona — real-time structured summaries, action items, risk flags, and "what should I say?" guidance |
| **Interview Practice** | AI coach generates interview-ready answers from your profile + JD in real time |
| **Interview Conductor** | AI acts as interviewer — generates questions, evaluates your answers, gives feedback |
| **Custom Assistant** | Provide any system prompt and create your own AI persona |
| **Teleprompter Mode** | Compact bullet-point cues you can read at a glance |
| **Voice Input** | Spacebar-to-record, or system-wide hotkey |
| **Screenshot Analysis** | Capture any window and get instant AI analysis (coding, diagrams, documents) |
| **Stealth Mode** | Window becomes nearly invisible — hide from screen shares in one key |
| **Always on Top** | Stays over every other window — works during Zoom, Teams, Meet |
| **Transparency Control** | Adjust opacity from the Settings panel |
| **Model Selection** | Choose OpenAI models for chat, vision, and transcription separately |
| **Chat Text Size** | Small / Normal / Big text size for easier reading at a distance |

---

## Download & Install

### Windows

1. Download **`Meetvora-1.0.0-win-setup.exe`** from the [Releases](../../releases) page.
2. Double-click the installer.
3. Follow the setup wizard (choose install directory, create desktop shortcut).
4. Launch **Meetvora** from the desktop or Start Menu.

> If Windows SmartScreen shows a warning, click **More info → Run anyway**. The app is not code-signed yet.

**To build from source:**

```bash
npm install
npm run package:win
# Installer appears in: release/Meetvora-1.0.0-win-setup.exe
```

---

### macOS

1. Download **`Meetvora-1.0.0-mac-arm64.dmg`** (Apple Silicon) or **`Meetvora-1.0.0-mac-x64.dmg`** (Intel) from the [Releases](../../releases) page.
2. Open the `.dmg` file.
3. Drag **Meetvora** into your **Applications** folder.
4. Open it from Launchpad or Applications.

> **Gatekeeper warning?** macOS may block unsigned apps. Run this once in Terminal:
> ```bash
> xattr -rd com.apple.quarantine /Applications/Meetvora.app
> ```

**Grant Permissions** (required for full functionality):

- **Microphone** — System Preferences → Privacy & Security → Microphone → enable Meetvora
- **Screen Recording** — System Preferences → Privacy & Security → Screen Recording → enable Meetvora (required for screenshot feature)
- **Accessibility** — System Preferences → Privacy & Security → Accessibility → enable Meetvora (required for global hotkeys)

**To build from source:**

```bash
npm install
npm run package:mac
# Output: release/Meetvora-1.0.0-mac-arm64.dmg  (or x64)
```

---

### Linux

> **AppImage** (recommended — no install needed):

1. Download **`Meetvora-1.0.0-linux-x64.AppImage`** from the [Releases](../../releases) page.
2. Make it executable:
   ```bash
   chmod +x Meetvora-1.0.0-linux-x64.AppImage
   ```
3. Run it:
   ```bash
   ./Meetvora-1.0.0-linux-x64.AppImage
   ```

> **Debian/Ubuntu `.deb` package:**

1. Download **`Meetvora-1.0.0-linux-x64.deb`** from the [Releases](../../releases) page.
2. Install:
   ```bash
   sudo dpkg -i Meetvora-1.0.0-linux-x64.deb
   # or
   sudo apt install ./Meetvora-1.0.0-linux-x64.deb
   ```
3. Launch from your application menu or run `meetvora` in terminal.

**Linux dependencies (if AppImage crashes):**

```bash
# Ubuntu/Debian
sudo apt install libsecret-1-0 libnss3 libatk-bridge2.0-0 libdrm2 libgbm1

# Fedora/RHEL
sudo dnf install libsecret nss atk libdrm mesa-libgbm
```

**To build from source:**

```bash
npm install
npm run package:linux
# Output: release/Meetvora-1.0.0-linux-x64.AppImage
#         release/Meetvora-1.0.0-linux-x64.deb
```

---

## First-Time Setup

### 1. OpenAI API Key

Meetvora requires an OpenAI API key to function.

**Option A — In-app (recommended):**

1. Open Meetvora.
2. Click the **⚙ Settings** icon in the bottom control bar.
3. Go to the **General** tab → **OpenAI API Key**.
4. Paste your key (`sk-…`) and click **Save**.

**Option B — `.env` file:**

Create a `.env` file in the app's data directory:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\meetvora-desktop\.env` |
| macOS | `~/Library/Application Support/meetvora-desktop/.env` |
| Linux | `~/.config/meetvora-desktop/.env` |

```env
OPENAI_API_KEY=sk-your-key-here
```

> Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).

### 2. Sign In

On first launch you can sign in with your Meetvora account for credit tracking, or use **Offline Mode** to skip authentication and use your own API key directly.

---

## Usage

### Starting a Session

1. Choose a **mode** from the Dashboard:
   - **Interview Practice** — paste your resume + job description
   - **Meeting Assistant** — add meeting agenda + attendees (optional)
   - **Custom** — write any system prompt
   - **Interview Conductor** — AI-driven interview simulator

2. Click **Start** (or press `Ctrl+Shift+S`) to begin recording.

3. Speak or let the meeting audio play — Meetvora transcribes and responds automatically.

4. Ask follow-up questions with `Space` (voice) or `Ctrl+Shift+T` (typed).

5. Press `Ctrl+Shift+X` to clear the session, or **Stop** to end.

### Meeting Assistant Mode

When you enter meeting context (agenda + attendees), the AI becomes a **Senior IT Consultant** role:

- Summarizes what was said in structured bullets (Key Points / Requirements / Action Items / Risks / Next Steps)
- Answers "What should I say?" with confident, professional language
- Explains technical concepts for both client (plain-English) and you (technical)
- Builds system/flow diagrams when architecture is discussed
- Drafts follow-up emails and meeting summaries on request

### Screenshot Mode

Press `Ctrl+Shift+P` to capture your screen. The AI will analyze the content and respond based on your **Screenshot Reply Mode** setting:

| Mode | Behavior |
|---|---|
| **Simple Answer** | General explanation of what's on screen |
| **Coding Challenge** | Debug / solve coding problems from screen |
| **Custom Prompt** | Use your own prompt for screenshot analysis |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Record voice / get AI answer |
| `Esc` | Hide / Show window (or close Settings if open) |
| `F` | Toggle fullscreen / restore size |
| `R` | Snap window to right |
| `L` | Snap window to left |
| `C` | Snap window to center-top |
| `G` | Toggle Teleprompter mode |
| `↑` / `↓` | Scroll chat content |
| `1` | Detailed explanation of last answer |
| `2` – `5` | Pick AI follow-up suggestion |
| `Ctrl+Shift+S` | Start / Stop recording session |
| `Ctrl+Shift+M` | Voice question (mic) |
| `Ctrl+Shift+T` | Open / close text input box |
| `Ctrl+Shift+X` | Clear all chat |
| `Ctrl+Shift+P` | Take screenshot + AI analysis |
| `Ctrl+Shift+A` | Pin / Unpin window (always on top) |
| `Ctrl+Shift+H` | Toggle Stealth mode |
| ``Ctrl+Shift+` `` | Global show / hide Meetvora (works system-wide) |

---

## Settings

Access Settings via the **⚙** icon in the control bar (or press `Ctrl+Shift+T` and click the gear).

### General

| Setting | Description |
|---|---|
| OpenAI API Key | Your personal API key |
| Chat Model | Model for Q&A and voice responses (default: GPT-4o Mini) |
| Vision Model | Model for screenshot analysis (default: GPT-4o) |
| Transcription Model | Model for speech-to-text (default: GPT-4o Mini Transcribe) |
| Answer Size | Small / Medium / Big — controls response length |
| Screenshot Reply Mode | Simple / Coding / Custom |
| Interview Language | Language for voice transcription |

### Audio

Configure microphone input device and troubleshoot audio issues from this tab.

### Shortcuts

Full keyboard shortcut reference.

### Appearance

| Setting | Description |
|---|---|
| Transparency | Adjust window opacity (0–95%) |
| See-Through Mode | Makes Meetvora nearly invisible |
| Dark / Light Theme | Toggle color scheme |
| Spacebar Mode | Hold-to-record vs one-tap toggle |
| Chat Text Size | Small / Normal / Big |

---

## Development

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher
- **OpenAI API key**

### Setup

```bash
git clone https://github.com/your-org/meetvora-desktop.git
cd meetvora-desktop

npm install

# Copy environment file
cp .env.example .env
# Then edit .env and add your OPENAI_API_KEY
```

### Running in Dev Mode

```bash
npm run dev
```

This starts Vite for the renderer and Electron for the main process concurrently.

### Building

| Command | Output |
|---|---|
| `npm run build` | Compile TypeScript + Vite bundle (no installer) |
| `npm run package:win` | Windows NSIS installer (`.exe`) |
| `npm run package:mac` | macOS DMG (`.dmg`) |
| `npm run package:linux` | AppImage + DEB (`.AppImage`, `.deb`) |
| `npm run package:all` | All three platforms |

All build outputs go into the `release/` directory.

### Type Checking

```bash
npm run lint
# or separately:
npx tsc -p tsconfig.json --noEmit        # renderer
npx tsc -p tsconfig.electron.json --noEmit  # electron main
```

### Project Structure

```
meetvora-desktop/
├── electron/
│   ├── main.ts              # Electron entry point
│   ├── preload.ts           # Bridge between main & renderer
│   ├── ai/
│   │   ├── gptClient.ts     # OpenAI GPT streaming
│   │   ├── whisperClient.ts # Speech-to-text
│   │   ├── visionClient.ts  # Screenshot analysis
│   │   └── promptBuilder.ts # All prompt templates
│   ├── audio/               # Audio capture (mic + system)
│   ├── ipc/
│   │   └── handlers.ts      # All IPC event handlers
│   └── storage/
│       ├── config.ts        # Key-value config store
│       └── sessionRepo.ts   # Session history (SQLite)
├── src/
│   ├── App.tsx              # Main React component
│   ├── components/
│   │   ├── Header.tsx       # Custom titlebar
│   │   ├── ChatPanel.tsx    # Message display
│   │   ├── Controls.tsx     # Record / stop / settings
│   │   ├── SettingsPanel.tsx# Full settings overlay
│   │   └── ...              # Mode setup screens
│   ├── hooks/
│   │   ├── useSession.ts    # Recording + AI session state
│   │   ├── useSettings.ts   # Persisted user settings
│   │   └── useTheme.ts      # Dark/light theme
│   └── styles/
│       └── index.css        # Global styles + CSS variables
├── build/                   # Icons for packaging
├── release/                 # Build outputs
└── electron-builder.json    # Packaging config
```

---

## Troubleshooting

### Window doesn't appear

- Press ``Ctrl+Shift+` `` (global hotkey) to show/hide Meetvora.
- If in stealth mode, press `Ctrl+Shift+H` to un-stealth.

### No audio transcription

- Check that your microphone is working in System Settings.
- In **Settings → Audio**, click **Refresh** to re-enumerate devices.
- Try selecting **System Default** from the device dropdown.

### API errors

- Confirm your OpenAI API key is correct in **Settings → General → OpenAI API Key**.
- Check your OpenAI account has remaining credits.
- If rate-limited, wait a moment and try again.

### App shows an error boundary

- Restart the app. If the error persists, check that you rebuilt after updating: `npm run dev`.
- In development: ensure `OPENAI_API_KEY` is set in `.env`.

### macOS: app won't open ("damaged" error)

```bash
xattr -rd com.apple.quarantine /Applications/Meetvora.app
```

### Linux: AppImage won't run

```bash
chmod +x Meetvora-*.AppImage
./Meetvora-*.AppImage --no-sandbox
```

---

## Credits

Built with:

- [Electron](https://www.electronjs.org/) — cross-platform desktop framework
- [React](https://react.dev/) — UI layer
- [Vite](https://vitejs.dev/) — build tool
- [OpenAI API](https://platform.openai.com/) — GPT, Whisper, Vision
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local session storage

---

## License

MIT © Ankit Anand
