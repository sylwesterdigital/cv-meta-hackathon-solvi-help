# SOLVI.help — AI That Can See, Move, and Build

**A shared 3D world where humans and AI agents collaborate through actions, not just conversation.**

**[Explore SOLVI.help](https://solvi.help/)** · **[Watch the demo](https://x.com/sylwestermiel/status/2118125153318027329)** · **[Project source](https://github.com/sylwesterdigital/cv-meta-hackathon-solvi-help)**

SOLVI.help is a browser-based, multiplayer 3D world where humans and AI-powered robot avatars explore, communicate, and build together. Instead of remaining inside a chat window, the agents have virtual bodies, head-mounted cameras, persistent task context, and tools for interacting with a physics-enabled environment.

The project explores **embodied AI in simulation**, powered by **Meta's multimodal models**. It is an experimental prototype, not a claim of fully reliable general-purpose autonomy.

## What you can do

- **Meet the agents:** Jess, Zuck, Suck, and Elox can converse with people and other robots, receive instructions, and act in the same shared realm.
- **See through a robot's eyes:** virtual head cameras capture actual 3D rendered observations, including 360° scans, for multimodal analysis.
- **Give meaningful tasks:** navigation, object interaction, pick-up/delivery, furniture placement, and multi-step construction experiments.
- **Build a world:** procedural homes, stairs, roads, fences, vegetation, screens, appliances, and interactive equipment can be placed and edited.
- **Use interactive props:** laptops have hinged screens and media playback; fridges open and store supported small objects; tools and office equipment can be configured as procedural primitives.
- **Share and persist:** multiplayer scene updates, saved realms, object presets, and server-side persistence let participants work in the same space.
- **Explore in a browser:** Three.js/WebGL rendering, Rapier physics, and experimental WebXR support.

### How Meta AI fits in

1. **Perception:** the app captures virtual camera frames and sends selected imagery and structured scene context to Meta's multimodal services.
2. **Reasoning:** Meta Muse Spark (through the Meta Responses API) supports conversation, scene understanding, and proposed next actions.
3. **Action:** SOLVI validates the proposed action against its allowlisted tools, permissions, and world state; the scene and physics engines carry it out.

**Important distinction:** Meta provides reasoning and vision. SOLVI supplies the 3D renderer, physics, pathfinding, state persistence, tool execution, and multiplayer networking. Model plans can fail or fall back to deterministic logic; autonomous work is still experimental.

## Technology

| Area | Stack |
| --- | --- |
| Client | JavaScript, Three.js, WebGL, WebXR |
| Physics and navigation | Rapier, scene-aware pathfinding |
| AI and vision | Meta Muse Spark, Meta Responses API |
| Server and realtime | Python Flask, WebSockets |
| Storage | SQLite |
| Video and media | HTML video, HLS where supported |
| Hosting | Ubuntu, Nginx, Gunicorn |
| Validation | Node.js tests, Python test suite, versioned SHA-256 release manifests |

## Repository layout

```text
cv-meta-hackathon-solvi-help/
├── README.md                 # Public project introduction (this page)
├── app/
│   ├── README.md             # App-scoped project overview
│   ├── ABOUT.md              # What the project is and its current scope
│   ├── CHANGELOG.md          # Historical release and development notes
│   ├── index.html            # Browser app
│   ├── js/                   # World, editor, networking, robots, AI tools
│   ├── backend/              # Flask API, SQLite, WebSockets, installer
│   ├── assets/               # Bundled models and interface icons
│   ├── docs/                 # Specifications and technical handover
│   ├── tests/                # Browser-code regression tests
│   └── package.json
└── updates/                  # Local watcher input; not application source
```

## Run locally

Requirements: Node.js, npm, Python 3, and a modern browser with WebGL support. The real Meta API integration requires credentials, supplied securely and never committed to source control.

```bash
cd app
npm install
npm run vendor
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
export SOLVI_DATA_DIR="$(pwd)/.local-data"
python3 backend/server.py
```

Open **http://127.0.0.1:8765/**. If the project is already running, do not start a second local server on the same port.

Run the JavaScript regression suite from `app/`:

```bash
npm test
```

The application server and browser are separate from the test harness. Some Python integration tests require additional dependencies and a properly isolated test environment. Passing automated tests alone does not establish end-to-end robot autonomy, media compatibility, or two-client production synchronisation.

## Demo and project materials

- **Live application:** https://solvi.help/
- **Hackathon demonstration:** https://x.com/sylwestermiel/status/2118125153318027329
- **About and limitations:** [`ABOUT.md`](ABOUT.md)
- **Release history:** [`CHANGELOG.md`](CHANGELOG.md)
- **Implementation specifications:** [`docs/`](docs/)

## Status and limitations

Current source release: **v0.2.195**. The latest packaged release is not considered live until the existing deployment watcher verifies and deploys it.

This is an evolving research and creative prototype. AI can misunderstand images or instructions, navigation can be obstructed, external media and Meta services can be unavailable, and robots do not perform long-running independent work while the controlling browser is closed. World edits are permission-checked; deployments must preserve existing realms and data. Do not commit API keys, user content, or production databases.

## Vision

**SOLVI.help explores a future where humans and AI agents share a world and collaborate through actions, not just words.**
