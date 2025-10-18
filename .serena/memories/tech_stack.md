# Technology Stack

## Backend (Planned)
- **Framework**: FastAPI (Python)
- **Video Upload**: FastAPI `UploadFile` (multipart form data)
- **Video Streaming**: FastAPI streaming response with range request support
- **Storage**: Temporary filesystem (`/tmp` directory for MVP)
- **Server**: Uvicorn ASGI server
- **No Database for MVP** - All state lives in browser

## Frontend (Planned)
- **Framework**: React 18+ with TypeScript
- **State Management**: Redux or Zustand (TBD)
- **Video Player**: HTML5 `<video>` with `requestVideoFrameCallback` API
- **Annotation Canvas**: react-konva (React wrapper for Konva.js)
- **HTTP Client**: Axios or fetch API
- **Build Tool**: Vite
- **Styling**: CSS Modules or Tailwind CSS (TBD)

## Development Environment
- **Python**: 3.11.2 (`/usr/bin/python3`)
- **Node.js**: v20.19.5 (`/usr/local/bin/node`)
- **Git**: 2.39.5 (`/usr/bin/git`)
- **OS**: Linux (Ubuntu-based)

## Testing Tools
- **Python**: pytest
- **TypeScript**: Jest or Vitest (TBD)
- **E2E**: Playwright or Cypress (post-MVP)

## Key Technical Challenges
1. **Frame-accurate seeking**: Using `requestVideoFrameCallback` API
2. **Synchronized playback**: Using `requestAnimationFrame` for sync maintenance
3. **Large file handling**: FastAPI streaming, HTTP range requests
4. **Canvas overlay performance**: react-konva optimization

## External Documentation References
- MDN: HTMLVideoElement.requestVideoFrameCallback()
- Konva.js React Documentation: https://konvajs.org/docs/react/index.html
- FastAPI Request Files: https://fastapi.tiangolo.com/tutorial/request-files/
- React Docs: https://react.dev/
