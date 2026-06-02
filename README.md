# The Condor: Golf Swing Analyzer

The Condor is an open-source platform for frame-accurate video analysis with dual-video synchronization and annotation tools.

## Quick Start

### Prerequisites

- **Node.js**: 18+ (for frontend development)
- **Python 3.11+**: For backend API
- **uv**: Python package manager ([install](https://docs.astral.sh/uv/getting-started/installation/))
- **npm** or **yarn**: Package management
- **Playwright Browsers**: For cross-browser testing

### Development Container

We manage the development container in the `.opencode/` folder using the Dockerfile and the `oc.sh` script. After updating the Dockerfile, manually rebuild the container and then run `oc.sh -f` to recreate the container with the new image.

### Container Startup (Every Session)

PostgreSQL does not start automatically and must be started each time the container restarts. Run this from the **host** (outside the container):

```bash
docker exec -it -u postgres opencode-condor /bin/zsh -c "service postgresql start"
```

**Note**: Use the `start_postgresql.sh` script for this, again from the host not the container

### First-Time Container Setup

After connecting to a **fresh** dev container, complete these additional steps once to initialise the environment.

**1. Install Python dependencies**

```bash
uv sync
```

**2. Initialise the database**

Run the backend once to apply Alembic migrations. Wait for `Application startup complete`, then stop it with `Ctrl+C`:

```bash
uv run python -m backend.main
```

> The database schema must be initialised this way before backend tests can pass.

**3. Install frontend dependencies**

```bash
cd frontend
npm install
cd ..
```

**4. Verify with tests**

Run all backend unit tests:

```bash
uv run pytest backend/
```

Run all frontend unit tests:

```bash
cd frontend && npm test && cd ..
```

All tests should pass before beginning development. See `backend/README.md` and `frontend/README.md` for integration test instructions.

### Run Full Application (Frontend + Backend)

Once setup is complete, start the two services in separate terminals:

```bash
# Terminal 1: Backend
uv run python -m backend.main
# API at http://localhost:8000

# Terminal 2: Frontend
cd frontend && npm run dev
# Use `npm run dev -- --host` when port forwarding outside of dev container
```

Open http://localhost:5173 — you'll see the upload workflow for dual-video analysis.

### Run Legacy Demo (Frontend Only, No Backend)

To use the original Phase 0 demo with local file selection (no upload required):

```bash
# Edit frontend/src/App.tsx - change line 1:
# FROM: import { DualVideoSynchronizer } from "./components/DualVideoSynchronizer";
# TO:   import { DualVideoSyncDemo } from "./components/DualVideoSyncDemo";

# And change line 22:
# FROM: <DualVideoSynchronizer />
# TO:   <DualVideoSyncDemo />

cd frontend
npm run dev
# Open demo at http://localhost:5173
# Use `npm run dev -- --host` when port forwarding outside of dev container
```

### Instructions for Use

**Upload Workflow** (full application only): Select and upload two videos with optional rotation. After upload, the app enters synchronized playback mode.

**Playback** (both modes): The application starts in SYNC mode where you can independently control each video. Use the playback controls (play/pause, scrub bar, frame stepping) to synchronize the two videos, e.g. by setting them both to the impact frame:

![alt text](image/impact.png)

Switch from sync mode to playback mode:

![alt text](image/playback-mode.png)

**Saving Sessions**: To save a session, both videos must first be saved to your video library. The session save button will be disabled with a tooltip message until both videos are saved. This ensures that session data can be properly restored when loading the session later.

**Library**: Use the Library panel to save videos for future use. Once a video is saved, it can be loaded into any session. Videos must be in the library before the session can be saved.

**Annotations** (both modes): Use the annotation tools to draw shapes representing key positions, angles, and checkpoints in the swing. For the polyline tool, each click-and-release creates a vertex; a double click places the final vertex and ends the line. All other tool drawing takes place with a single click and drag.

![alt text](image/annotations.png)

Annotations can be selected (ctrl-click to select multiple). White control points appear when selected. Click on the annotation body (not on a control point) and drag to move selected annotations. Click and drag on a control point to edit (resize/adjust) the annotation itself. Press **Delete** (Windows/Linux) or **Backspace** (Mac) to remove all selected annotations.

## Development

### Running Tests

**Backend unit tests** (from project root):

```bash
uv run pytest backend/
```

**Frontend unit tests** (from `frontend/`):

```bash
npm test
```

See `backend/README.md` and `frontend/README.md` for integration test instructions.

### Building for Production

```bash
# Resolves version from git and writes it into frontend/package.json,
# backend/version.py, and frontend/src/version.ts
scripts/set-version.sh

# Then build the frontend bundle
cd frontend && npm run build
```

When building via Docker, version resolution happens inside the image build.
See the [Deploy](#deploy) section below for the recommended workflow.

### API Documentation

Interactive API docs are available at http://localhost:8000/docs when the backend is running.

## Docker Deployment

Condor ships production Docker images for `linux/amd64` and `linux/arm64`.

### Prerequisites

- Docker 24+ and Docker Compose v2
- 4+ GB RAM recommended
- Sufficient storage for the PostgreSQL data volume and video files

### Deploy

The deploy script resolves the version from git tags and bakes it into the
images so the running application displays the correct version string.

```bash
# 1. Clone the repository and checkout the desired version
git clone <repo-url> condor && cd condor
git checkout v0.1.4

# 2. Configure environment (edit passwords for production)
cp .env.example .env

# 3. Generate a self-signed TLS certificate (see SSL Certificate section below)
scripts/generate-cert.sh <your-server-ip-or-hostname>

# 4. Build images and start all services (postgres, backend, frontend)
scripts/deploy.sh

# 5. Open the application
#    https://<raspberry-pi-ip>:3443
```

The version is resolved as follows:

1. **Git tag** reachable from HEAD (e.g. `v0.1.4` → `0.1.4` published in the UI)
2. **Short commit hash** prefixed with `unreleased-` (no tag found)
3. **`dev`** (fallback when git is unavailable, e.g. source tarball)

To see what version would be used without building:

```bash
scripts/deploy.sh --dry-run
```

The stack starts three containers:

| Container  | Port(s)      | Description                                      |
| ---------- | ------------ | ------------------------------------------------ |
| `postgres` | —            | PostgreSQL 15 (internal to Docker network only)  |
| `backend`  | 8000         | FastAPI API + video processing                   |
| `frontend` | 3000 (HTTP)  | nginx serving SPA + reverse-proxying `/api/`     |
|            | 3443 (HTTPS) | HTTPS with self-signed TLS certificate           |

### Manage and Operate

```bash
# View running containers
docker compose ps

# Tail logs for all services
docker compose logs -f

# Tail backend logs only
docker compose logs -f backend

# Stop all services (data volumes are preserved)
docker compose down

# Stop and remove all data (⚠ irreversible)
docker compose down -v

# Rebuild after a code change
docker compose up --build -d
```

### Persistent Data

Two named Docker volumes store state outside the containers:

| Volume          | Content                              |
| --------------- | ------------------------------------ |
| `postgres_data` | PostgreSQL database files            |
| `video_storage` | Uploaded and processed video files   |

Both volumes survive `docker compose down` and are only removed with the `-v` flag.

### Configuration

Override any of the following in your `.env` file:

| Variable          | Default         | Description                   |
| ----------------- | --------------- | ----------------------------- |
| `POSTGRES_USER`   | `condor_user`   | Database username             |
| `POSTGRES_PASSWORD`| `condor_dev`   | Database password (**change for production**) |
| `POSTGRES_DB`     | `condor_db`     | Database name                 |
| `LOG_LEVEL`       | `INFO`          | Backend log verbosity         |
| `FRONTEND_PORT`   | `3443`          | Host port for HTTPS (primary access) |
| `FRONTEND_HTTP_PORT` | `3000`       | Host port for HTTP→HTTPS redirect |
| `BACKEND_PORT`    | `8000`          | Host port for API (optional)  |
| `CONDOR_VERSION`  | *(auto)*        | Override the version baked into the image (e.g. `v0.1.4`). Normally resolved from git tags by `scripts/deploy.sh`. |

### SSL Certificate

The frontend container serves HTTPS using a self-signed TLS certificate. This is required for browser APIs that demand a secure context (e.g. WebCodecs, used for video processing).

#### Generate the Certificate

On your **development machine**, run the certificate generation script with the IP address or hostname clients will use to access the server:

```bash
# Single IP address
scripts/generate-cert.sh 192.168.1.50

# Hostname
scripts/generate-cert.sh condor.local

# Multiple SANs (IP + hostname)
scripts/generate-cert.sh 192.168.1.50 condor.local
```

This produces two files in `frontend/ssl/`:

| File | Description |
| --- | --- |
| `condor.crt` | **Public certificate** — to be shared with clients |
| `condor.key` | **Private key** — must be kept secure |

The script is idempotent: if the certificate already exists, it will skip generation unless `--force` is passed.

#### Deploy the Certificate

**Transfer the public certificate and private key** to the deploy host; copy it securely (e.g. via `scp`):
   ```bash
   scp -r frontend/ssl/ user@deploy-host:/path/to/condor/frontend/ssl/
   ```

On the deploy host, ensure both files exist at `frontend/ssl/` before running `scripts/deploy.sh`. The private key is mounted as a read-only volume into the frontend container at runtime.

#### Distribute the Public Certificate to Clients

Because the certificate is self-signed, browsers will show a security warning on first visit. To eliminate this warning, distribute `frontend/ssl/condor.crt` to each client machine and add it to the system trust store.

**Windows:**
1. Double-click `condor.crt` to open the Certificate viewer.
2. Click **Install Certificate**.
3. Select **Local Machine** → **Next**.
4. Choose **Place all certificates in the following store** → **Browse** → **Trusted Root Certification Authorities**.
5. Click **OK** → **Next** → **Finish**.

**macOS:**
1. Double-click `condor.crt` to open it in **Keychain Access**.
2. Select the **System** keychain (or **Login** for current user only).
3. Double-click the imported certificate in Keychain Access.
4. Expand the **Trust** section.
5. Set **When using this certificate** to **Always Trust**.
6. Close the dialog and authenticate with your password.

**Linux (system-wide, Debian/Ubuntu):**
```bash
sudo cp condor.crt /usr/local/share/ca-certificates/condor-local.crt
sudo update-ca-certificates
```
For RHEL/CentOS/Fedora:
```bash
sudo cp condor.crt /etc/pki/ca-trust/source/anchors/condor-local.crt
sudo update-ca-trust
```

**iOS:**
1. Transfer `condor.crt` to the device (e.g. via email, AirDrop, or a hosted download link).
2. Open the file to trigger the profile installation prompt.
3. Go to **Settings** → **Profile Downloaded** → **Install**.
4. Then go to **Settings** → **General** → **About** → **Certificate Trust Settings** and enable trust for the certificate.

**Android:**
1. Go to **Settings** → **Security** → **Encryption & Credentials** → **Install a certificate**.
2. Choose **CA certificate**.
3. Select `condor.crt` from your downloads.
4. Name the certificate (e.g. "Condor") and confirm.

> **Note:** On Android, system-wide CA installation may require root access on newer versions (Android 7+). In that case, configure the browser individually or use the Chrome flag `chrome://flags/#allow-insecure-localhost` as a workaround.

#### Regenerate the Certificate

To regenerate an existing certificate (e.g. after a key compromise or to change the SANs), use `--force`:

```bash
scripts/generate-cert.sh --force 192.168.1.50
```

After regeneration:
1. Transfer the new private key to the deploy host
2. Restart the frontend container: `docker compose restart frontend`
3. Redistribute the new public certificate to all client machines and update their trust stores

### Troubleshooting

| Symptom | Check |
| ------- | ----- |
| Frontend loads but API calls fail | Verify backend is healthy: `docker compose ps` and `curl http://localhost:8000/health` |
| `alembic upgrade head` fails on start | Database may still be initialising — restarting the backend container usually resolves this |
| Out of disk space | Remove unused Docker images with `docker image prune -a` |

### Testing

See component-specific README files:

- **Frontend**: `frontend/README.md` - Unit tests and Playwright E2E tests
- **Backend**: `backend/README.md` - Unit tests and integration tests

### Generate Test Videos

```bash
# Navigate to test fixtures
cd tests/fixtures

# Generate test videos with frame counters
bash generate_test_videos.sh

# Output: tests/fixtures/videos/
#   - test_30fps_10s.mp4       (H.264, 30fps, 10 seconds)
#   - test_60fps_5s.mp4        (H.264, 60fps, 5 seconds)
#   - test_30fps_10s_hevc.mp4  (H.265/HEVC, 30fps, 10 seconds)
```

## Repository Structure

```
condor/
├── backend/              # Backend source & unit tests
├── docs/                 # Technical documentation
│   └── spike/            # Detailed spike documentation
├── frontend/             # Frontend source & unit tests
│   ├── src/
│   │   ├── hooks/        # Custom React hooks (useFrameCallback)
│   │   └── components/   # UI components (FrameStepper)
│   └── tests/            # Playwright E2E tests
├── image/                # Images for documentation
├── inputs/               # Design input documentation
├── project/              # Project documentation (requirements and planning)
├── PRPs/                 # Product Requirements Prompts
├── tests/                # Integration tests
│   └── fixtures/         # Test video generation scripts
└── validation/           # Validation and review artifacts
```

## Technology Stack

### Backend

- **Python 3.11+**: FastAPI, uvicorn
- **uv**: Dependency management (`pyproject.toml`)
- **PostgreSQL / SQLAlchemy (asyncpg)**: Database
- **FFmpeg**: Video metadata extraction
- **Testing**: pytest

### Frontend

- **React 18**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool
- **Zustand**: State management (Phase 1)
- **react-konva**: Canvas annotations (Phase 1)

### Testing

- **Playwright**: E2E cross-browser testing
- **Vitest**: Frontend unit tests (Phase 1)
- **pytest**: Backend unit tests (Phase 1)

## License

[License information to be added]

## Contact

[Contact information to be added]
