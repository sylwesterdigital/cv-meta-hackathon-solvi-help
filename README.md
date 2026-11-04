https://github.com/user-attachments/assets/ca58b86b-1574-43a0-9b75-46cda9fb6aee

# SOLVI.help — AI That Can See, Move, and Build

**A shared 3D world where humans and AI agents collaborate through actions, not just conversation.**

[Explore SOLVI.help](https://solvi.help)

SOLVI.help is a browser-based, multiplayer 3D environment that gives AI-powered robot avatars virtual bodies, head-mounted cameras, memory, and tools for interacting with a persistent world. Instead of only answering questions, agents can observe their surroundings, navigate, communicate with other participants, and help create objects and buildings.

Built as an **embodied AI experiment** using **Meta's multimodal AI models**, SOLVI.help explores how intelligent agents can become active participants in shared digital spaces.

## The Idea

**What happens when you give AI eyes, a body, and the ability to build?**

Meet **Jess, Zuck, Suck, and Elox**: robot avatars that can participate in natural-language conversations, interpret instructions, inspect a 3D environment through virtual cameras, and execute permitted actions using custom world tools.

A user can ask an agent to locate another robot, travel to a worksite, create furniture, or help construct a building. The system connects model-generated reasoning to collision-checked movement, procedural construction tools, scene persistence, and task feedback.

## Key Features

- **Embodied AI avatars:** Robots with identities, contextual conversation, 3D bodies, animation, and spatial interaction.
- **Visual perception:** Virtual head-camera images, including direction-labelled 360° scans, can be analysed with Meta's multimodal models.
- **Action-oriented agents:** A custom Robot Tool API supports navigation, social interaction, object handling, and procedural construction.
- **Multi-agent interaction:** Humans and robots share the same multiplayer world, communicate, and coordinate goals.
- **Work orders and memory:** Persistent task records, explicit permissions, progress feedback, and bounded recovery attempts.
- **Physical navigation:** Rapier collision, A* pathfinding, obstacle-aware detours, and detection of robots that stop making progress.
- **Creative world editing:** Buildings, rooms, furniture, roads, footpaths, fences, vegetation, media surfaces, and interactive objects.
- **Browser and XR support:** A Three.js/WebGL experience with experimental WebXR capabilities.

## Why Meta AI?

Meta's **Muse Spark** model, accessed through the **Meta Responses API**, provides the language, reasoning, and image-understanding capabilities behind SOLVI's agents.

The integration works in three layers:

1. **Perceive:** A robot captures actual images rendered by its virtual camera. These images can be supplied to Meta's multimodal model with scene context.
2. **Reason:** The model interprets questions or goals, discusses tasks, and proposes next steps.
3. **Act:** SOLVI validates proposed actions against its tool permissions, world state, and available capabilities before executing them in the browser.

The 3D world, physics, pathfinding, tool execution, and persistent memory are developed as part of SOLVI.help. Meta's models supply the AI reasoning and perception layer; they do not directly run the physics engine or control the browser independently.

## Technology Stack

| Layer | Technology |
| --- | --- |
| 3D rendering and interaction | Three.js, WebGL, JavaScript |
| Physics and collisions | Rapier |
| Extended reality | WebXR |
| AI language, planning, and vision | Meta Muse Spark / Meta Responses API |
| Backend and HTTP API | Python, Flask |
| Multiplayer communication | WebSockets |
| Persistent data | SQLite |
| Production infrastructure | Ubuntu, Nginx, Gunicorn |
| Testing | Node.js test runner, Python integration tests |

## Project Structure

The application source is located in `app/`:

```text
app/
├── index.html               # Browser application entry point
├── js/                      # 3D scene, robots, editor, networking, AI tools
├── assets/                  # Bundled 3D assets and interface graphics
├── backend/
│   ├── server.py            # Flask API and WebSocket backend
│   ├── requirements.txt     # Python dependencies
│   └── test_api.py          # Backend integration tests
├── scripts/                 # Local asset/vendor preparation
├── tests/                   # JavaScript regression suite
├── docs/                    # Technical documentation
├── package.json
└── README.md                 # Detailed release and change history
```

The repository can also contain `media/` for the hackathon demo video, screenshots, and promotional graphics when those assets are added.

## Run Locally

**Requirements:** Node.js, npm, Python 3, and a modern WebGL-capable browser. A Meta API key is needed for live model inference.

From the repository root:

```bash
cd app
npm install
npm run vendor
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Start the backend, which also serves the browser application:

```bash
export SOLVI_DATA_DIR="$(pwd)/.local-data"
# Optional: set MODEL_API_KEY securely in your environment for Meta inference.
python3 backend/server.py
```

Open **http://127.0.0.1:8765**.

Never commit API keys, user data, local database files, or production secrets. Production deployment uses HTTPS and an Nginx reverse proxy.

## Tests

Run the JavaScript regression suite from `app/`:

```bash
npm test
```

The project also includes Python backend integration tests. Some tests require Flask dependencies, local test configuration, or a running browser/backend environment; passing unit tests alone does not establish that every autonomous scenario works end to end.

## Demo and Submission Materials

Suggested repository materials:

- **Demo video:** A short walkthrough of robot conversations, vision, navigation, construction, and multi-agent interaction.
- **Screenshots:** The 3D environment, robot interfaces, and building tools.
- **Architecture notes:** How virtual-camera observations, Meta model requests, action validation, and world updates fit together.
- **Source code:** Frontend, backend, tools, tests, and deployment configuration.

Add links to the final uploaded video and media files here before submitting the repository.

## Project Status

SOLVI.help is an **experimental prototype**, not a finished general-purpose autonomous robotics platform. Its construction tools create procedural 3D content; autonomous planning and multi-agent execution are still being refined. Some tasks use deterministic fallbacks or require an active, authenticated browser session and explicit permission for world changes. Visual perception depends on available camera captures and configured model access.

The included source snapshot is **v0.2.190**; production deployment and live end-to-end behaviour should be verified separately.

## Vision

AI should be able to do more than explain how to accomplish a task. SOLVI.help investigates a future in which humans and AI agents can **see the same world, solve problems together, and build things collaboratively**.

**SOLVI.help — A living 3D world for humans and AI.**
