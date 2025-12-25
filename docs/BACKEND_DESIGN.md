# Backend - System Design Description

## Document Control

- **Version**: 1.0
- **Last Updated**: 2025-12-22

## Overview

The backend is a FastAPI-based REST API providing comprehensive data management and video processing services for the golf swing analyzer. It manages all persistent data including user accounts, video libraries, saved analysis sessions, and annotation data, while also handling video upload, optimization (GOP=30 re-encoding), and streaming. The backend serves as the bridge between user data, uploaded video content, and the frame-accurate playback requirements of the frontend, ensuring predictable decode performance through video optimization and providing efficient data persistence and retrieval.

## Responsibilities

### Primary Responsibilities

- **User Data Management**: Manage user accounts, authentication, authorization, and user preferences
- **Video Library Management**: Maintain persistent video storage with metadata, organize user video collections, handle video lifecycle (upload, storage, retrieval, deletion)
- **Session Persistence**: Save and restore analysis sessions including dual-video pairings, synchronization offsets, and associated annotations
- **Annotation Data Management**: Store, retrieve, and manage annotation data associated with video frames and sessions
- **Video Upload & Validation**: Accept video uploads via multipart form data, validate file size and format, generate unique video identifiers
- **Video Optimization**: Analyze uploaded videos with ffprobe to detect GOP size, resolution, and codec, re-encode videos as needed using ffmpeg:
  - Convert H.265/HEVC to H.264 for WebCodecs browser compatibility
  - Optimize GOP>30 to GOP=30 for predictable client-side frame seeking
  - Downscale resolution>1080p for performance
  - Apply video rotation via transpose filter when requested
- **Metadata Extraction**: Extract framerate, duration, resolution, codec type, and GOP size from uploaded videos using ffprobe, return structured metadata to frontend
- **HTTP Range Request Streaming**: Stream videos to frontend with HTTP range request support for efficient seeking and partial content delivery

### Secondary Responsibilities

- **Data Lifecycle Management**: Handle cleanup of expired sessions, orphaned files, and temporary data
- **Error Logging & Monitoring**: Server-side logging of operations, errors, and performance metrics
- **Static File Serving**: Serve frontend static files for web application delivery
- **API Documentation**: Provide interactive API documentation for developers and integrations

## Theory of Operation

### Data Persistence & Storage Architecture

The backend manages multiple categories of persistent data with different storage strategies based on access patterns and lifecycle requirements:

1. **User Data**: Account information, authentication credentials, user preferences stored in relational database
2. **Video Library**: Video files stored in object storage with metadata in database, organized by user_id and collection
3. **Session Data**: Analysis session state (video pairings, sync offsets) stored in database with foreign keys to video records
4. **Annotation Data**: Frame-specific annotations stored as JSON in database, linked to sessions and videos
5. **Temporary Files**: Upload buffers and optimization artifacts stored in filesystem with automatic cleanup

**Storage Backends**:

- **Database**: PostgreSQL for structured data (users, metadata, sessions, annotations)
- **Object Storage**: Local filesystem or S3-compatible storage for video files
- **Cache Layer**: Redis for session tokens, frequently accessed metadata, and temporary state

**Data Relationships**:

- Each user owns a collection of videos (one-to-many)
- Each analysis session references one or two videos with a single synchronization offset value (many-to-many relationship between videos and sessions)
- Each annotation belongs to a specific session and references video frames (many-to-one)

### Video Upload & Optimization Flow

The backend implements a multi-stage pipeline to transform uploaded videos into optimized assets suitable for frame-accurate playback:

1. **Upload Reception**: FastAPI receives multipart/form-data upload, validates file size and MIME type
2. **Session Initialization**: Generate UUID session_id (if not provided) and video_id, create session directory at `/tmp/condor/{session_id}/`
3. **Original File Storage**: Write uploaded file to `{session_id}/{video_id}_original.mp4` using async file I/O (aiofiles)
4. **Metadata Analysis**: Execute ffprobe subprocess to extract video metadata (framerate, duration, resolution, codec, GOP size)
5. **Optimization Decision**: Trigger re-encoding if any condition met:
   - Codec is H.265/HEVC (hvc1/hev1) - convert to H.264 for WebCodecs compatibility
   - GOP > 30 - optimize for predictable frame seeking
   - Resolution > 1080p - downscale for performance
   - Rotation requested - apply transpose filter
6. **Re-encoding**: Execute ffmpeg with parameters:
   - `-c:v libx264`: H.264 codec (for WebCodecs compatibility)
   - `-g 30 -keyint_min 30`: Force keyframe every 30 frames
   - `-crf 23`: Quality level (visually lossless)
   - `-preset medium`: Encoding speed/quality tradeoff
   - Rotation filter if requested: `transpose=1` (90° CW), `transpose=2` (90° CCW), etc.
7. **File Replacement**: Replace original file with optimized version, delete original
8. **Metadata Return**: Return JSON with video_id, session_id, framerate, duration, width, height, codec (h264), gop_size (30)

**Performance**: Re-encoding using software libx264 achieves 0.42x realtime on reference hardware (60s video → 25s processing). Hardware encoder h264_v4l2m2m is faster but currently produces GOP=60 (driver limitation on some platforms).

### HTTP Range Request Streaming

The backend implements efficient video streaming with HTTP range request support for seeking:

1. **Request Parsing**: Extract `Range` header (e.g., `bytes=1024-4095`)
2. **File Access**: Locate video file at `/tmp/condor/{session_id}/{video_id}.mp4`
3. **Partial Content Response**: If Range header present:
   - Calculate start/end byte positions
   - Stream file chunk via async iterator
   - Return 206 Partial Content with `Content-Range` header
4. **Full File Response**: If no Range header, stream entire file with 200 OK

**Seeking Support**: Range requests enable browser video seeking by requesting specific byte ranges from MP4 file (moov atom must be at beginning for fast seeking).

### Data Lifecycle Management

The backend implements lifecycle policies for different data categories to balance storage costs, performance, and user expectations:

**Temporary Data Cleanup**:

1. **Upload Buffers**: Cleaned up immediately after successful optimization or on error
2. **Optimization Artifacts**: Intermediate files removed after final video produced
3. **Expired Sessions**: Configurable TTL for inactive sessions (e.g., 24 hours), background task periodically scans and removes
4. **Orphaned Files**: Background job identifies and removes files no longer referenced in database

**Persistent Data Retention**:

1. **User Videos**: Retained indefinitely until user deletion or account closure
2. **Saved Sessions**: Retained per user preferences or global retention policy (e.g., 30/90 days)
3. **Annotations**: Tied to session lifecycle, deleted when parent session deleted
4. **User Accounts**: Retained until explicit deletion request, soft-delete with grace period

**Cleanup Strategies**:

- **On-Demand**: API endpoints for user-initiated deletion (videos, sessions, annotations)
- **Background Tasks**: Periodic jobs for expired session cleanup, orphaned file detection
- **Cascade Deletion**: Database foreign key constraints ensure referential integrity

## Implementation Architecture

### API Structure

```plantuml
@startuml
package "FastAPI Application" {
  [main.py] --> [routes.py]
  [routes.py] --> [auth.py]
  [routes.py] --> [users.py]
  [routes.py] --> [upload.py]
  [routes.py] --> [videos.py]
  [routes.py] --> [sessions.py]
  [routes.py] --> [annotations.py]
}

package "Services" {
  [auth_service.py]
  [user_service.py]
  [video_optimizer.py]
  [storage.py]
  [video_info.py]
  [session_service.py]
  [annotation_service.py]
  [cleanup.py]
}

package "Database" {
  [models.py]
  [database.py]
}

package "Config" {
  [settings.py]
}

[auth.py] --> [auth_service.py]
[users.py] --> [user_service.py]
[upload.py] --> [video_optimizer.py]
[upload.py] --> [storage.py]
[upload.py] --> [video_info.py]
[videos.py] --> [storage.py]
[sessions.py] --> [session_service.py]
[annotations.py] --> [annotation_service.py]

[auth_service.py] --> [models.py]
[user_service.py] --> [models.py]
[session_service.py] --> [models.py]
[annotation_service.py] --> [models.py]
[storage.py] --> [models.py]

[models.py] --> [database.py]
[main.py] --> [database.py] : lifespan event
[main.py] --> [cleanup.py] : lifespan event
[main.py] --> [settings.py]

note right of [video_optimizer.py] : GOP detection\nffmpeg re-encoding
note right of [storage.py] : Object storage\nFile I/O
note right of [cleanup.py] : Background tasks\nData lifecycle
note right of [models.py] : User, Video, Session,\nAnnotation models

@enduml
```

### Core Classes and Services

```plantuml
@startuml

' Database Models
class User <<SQLAlchemy>> {
  +id: UUID
  +username: str
  +email: str
  +password_hash: str
  +created_at: datetime
  +videos: List[Video]
}

class Video <<SQLAlchemy>> {
  +id: UUID
  +user_id: UUID
  +filename: str
  +storage_path: str
  +framerate: float
  +duration: float
  +width: int
  +height: int
  +codec: str
  +gop_size: int
  +uploaded_at: datetime
  +user: User
}

class AnalysisSession <<SQLAlchemy>> {
  +id: UUID
  +user_id: UUID
  +video_a_id: UUID
  +video_b_id: UUID
  +sync_offset: int
  +name: str
  +created_at: datetime
  +updated_at: datetime
  +user: User
  +video_a: Video
  +video_b: Video
  +annotations: List[Annotation]
}

class Annotation <<SQLAlchemy>> {
  +id: UUID
  +session_id: UUID
  +annotation_type: str
  +points: JSON
  +style: JSON
  +frame_number: int
  +created_at: datetime
  +session: AnalysisSession
}

' Service Classes
class AuthService {
  +register_user(username: str, email: str, password: str): User
  +authenticate(username: str, password: str): Token
  +verify_token(token: str): User
}

class UserService {
  +get_user(user_id: UUID): User
  +update_preferences(user_id: UUID, prefs: dict): User
  +delete_user(user_id: UUID): void
}

class VideoOptimizer {
  +get_video_info(path: Path): VideoInfo
  +needs_optimization(info: VideoInfo): bool
  +optimize_video(input_path: Path, output_path: Path): OptimizationStats
  +process_uploaded_video(file_path: Path): VideoInfo
}

class StorageService {
  +save_video(file: UploadFile, user_id: UUID): Video
  +get_video_path(video_id: UUID): Path
  +delete_video(video_id: UUID): void
  +list_user_videos(user_id: UUID): List[Video]
}

class SessionService {
  +create_session(user_id: UUID, video_a_id: UUID, video_b_id: UUID): AnalysisSession
  +update_sync_offset(session_id: UUID, offset: int): AnalysisSession
  +get_session(session_id: UUID): AnalysisSession
  +delete_session(session_id: UUID): void
}

class AnnotationService {
  +save_annotation(session_id: UUID, annotation: dict): Annotation
  +get_annotations(session_id: UUID): List[Annotation]
  +delete_annotation(annotation_id: UUID): void
}

class CleanupService {
  +cleanup_expired_sessions(max_age_hours: int): int
  +cleanup_orphaned_files(): int
  +cleanup_deleted_users(): int
}

' Relationships
User "1" -- "*" Video
User "1" -- "*" AnalysisSession
AnalysisSession "*" -- "1" Video : video_a
AnalysisSession "*" -- "1" Video : video_b
AnalysisSession "1" -- "*" Annotation

AuthService --> User
UserService --> User
StorageService --> Video
SessionService --> AnalysisSession
AnnotationService --> Annotation
VideoOptimizer ..> Video : produces metadata

@enduml
```

### Request Processing Flows

#### Video Upload Flow

```plantuml
@startuml
participant "Client" as client
participant "UploadEndpoint" as upload
participant "StorageService" as storage
participant "VideoOptimizer" as optimizer
participant "ffprobe" as ffprobe
participant "ffmpeg" as ffmpeg

client -> upload: POST /api/upload\n(multipart/form-data)
upload -> upload: Validate file size
upload -> upload: Validate MIME type (video/mp4)
upload -> upload: Generate session_id, video_id

upload -> storage: save_uploaded_file(file, session_id, video_id)
storage -> storage: Create /tmp/condor/{session_id}/ directory
storage -> storage: Write file to {video_id}_original.mp4
storage -> upload: Return file path

upload -> optimizer: process_uploaded_video(file_path)
optimizer -> ffprobe: Extract metadata
ffprobe -> optimizer: framerate, duration, width, height, codec, gop_size

alt Codec is H.265/HEVC (hvc1/hev1) OR GOP > 30 OR resolution > 1080p OR rotation requested
  optimizer -> optimizer: needs_optimization() = true
  optimizer -> ffmpeg: optimize_video(input, output)\n-c:v libx264 -g 30 -keyint_min 30 -crf 23\n+ rotation filter if requested
  ffmpeg -> optimizer: H.264 optimized file written (GOP=30)
  optimizer -> storage: Replace original with optimized
else
  optimizer -> optimizer: needs_optimization() = false
end

optimizer -> upload: Return VideoInfo (codec=h264, gop_size=30)
upload -> client: JSON response (VideoMetadata)

note right of ffmpeg: Convert H.265→H.264 for WebCodecs\nGOP=30 for frame-accurate seeking\nRotation via transpose filter

@enduml
```

#### Video Streaming Flow

```plantuml
@startuml
participant "Client" as client
participant "VideoEndpoint" as video
participant "StorageService" as storage
participant "Filesystem" as fs

client -> video: GET /api/video/{video_id}\nRange: bytes=1024-4095
video -> storage: get_video_path(video_id)
storage -> video: /tmp/.../session_id/video_id.mp4

video -> fs: Open file
video -> fs: Seek to byte 1024
video -> fs: Read 3072 bytes

fs -> video: Byte chunk
video -> client: 206 Partial Content\nContent-Range: bytes 1024-4095/total_size\nContent-Type: video/mp4

note right of video: Async file iterator\nfor efficient streaming

@enduml
```

## Interfaces

### API Endpoints

**Authentication & User Management**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user account |
| `/api/auth/login` | POST | Authenticate and receive token |
| `/api/auth/logout` | POST | Invalidate session token |
| `/api/users/me` | GET | Get current user profile |
| `/api/users/me` | PUT | Update user preferences |
| `/api/users/me` | DELETE | Delete user account |

**Video Management**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/videos/upload` | POST | Upload new video file |
| `/api/videos` | GET | List user's video library |
| `/api/videos/{video_id}` | GET | Stream video with Range support |
| `/api/videos/{video_id}/metadata` | GET | Get video metadata |
| `/api/videos/{video_id}` | DELETE | Delete video |

**Session Management**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | POST | Create new analysis session |
| `/api/sessions` | GET | List user's saved sessions |
| `/api/sessions/{session_id}` | GET | Get session with annotations |
| `/api/sessions/{session_id}` | PUT | Update session (sync offset, name) |
| `/api/sessions/{session_id}` | DELETE | Delete session |

**Annotation Management**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions/{session_id}/annotations` | POST | Create new annotation |
| `/api/sessions/{session_id}/annotations` | GET | Get all session annotations |
| `/api/annotations/{annotation_id}` | PUT | Update annotation |
| `/api/annotations/{annotation_id}` | DELETE | Delete annotation |

### API Data Structures

**User**:

```python
class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    created_at: datetime
```

**Video**:

```python
class VideoMetadata(BaseModel):
    id: UUID
    user_id: UUID
    filename: str
    framerate: float
    duration: float
    width: int
    height: int
    codec: str
    gop_size: int
    uploaded_at: datetime
```

**AnalysisSession**:

```python
class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    video_a_id: UUID
    video_b_id: UUID
    sync_offset: int
    name: str
    created_at: datetime
    updated_at: datetime
    annotations: List[Annotation]
```

**Annotation**:

```python
class Annotation(BaseModel):
    id: UUID
    session_id: UUID
    annotation_type: str  # 'freehand', 'polyline', 'oval', 'arrow'
    points: List[Dict[str, float]]  # [{x: float, y: float}]
    style: Dict[str, Any]  # {color: str, strokeWidth: int}
    frame_number: int
    created_at: datetime
```

**ErrorResponse**:

```python
class ErrorResponse(BaseModel):
    detail: str  # Human-readable error message
    error_code: Optional[str]  # Machine-readable error code
```

## Error Handling Strategy

### Error Types

| Error Type              | Cause                                                | HTTP Status | Handling Strategy                                     | User Message                                                              |
| ----------------------- | ---------------------------------------------------- | ----------- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| AuthenticationError     | Invalid credentials                                  | 401         | Return unauthorized error                             | "Invalid username or password"                                            |
| TokenExpiredError       | Session token expired                                | 401         | Clear client token, redirect to login                 | "Session expired. Please log in again"                                    |
| AuthorizationError      | Accessing resource owned by another user             | 403         | Return forbidden error                                | "You don't have permission to access this resource"                       |
| UserExistsError         | Registration with existing username/email            | 409         | Return conflict error                                 | "Username or email already exists"                                        |
| FileSizeError           | Upload exceeds configured limit                      | 413         | Reject upload immediately                             | "Video file exceeds maximum size"                                         |
| FormatValidationError   | Non-MP4 or invalid MIME type                         | 400         | Reject upload, return error                           | "Unsupported video format. Please use MP4 with H.264 or H.265/HEVC codec" |
| ResourceNotFoundError   | video_id, session_id, or annotation_id not found     | 404         | Return not found error                                | "Resource not found"                                                      |
| OptimizationError       | ffmpeg re-encoding failure                           | 500         | Log error, return original file metadata with warning | "Video optimization failed, playback may be slower than expected"         |
| MetadataExtractionError | ffprobe failure or corrupt video                     | 500         | Log error, reject upload                              | "Failed to read video metadata. File may be corrupted"                    |
| StorageError            | Disk full, permission denied, object storage failure | 500         | Log error, reject upload                              | "Storage error. Please try again later"                                   |
| DatabaseError           | Database connection failure, query timeout           | 500         | Log error, retry with exponential backoff             | "Database error. Please try again"                                        |

### Error Handling Flow

```plantuml
@startuml
start

:Receive upload request;

if (File size > 200MB?) then (yes)
  :Return 413 error;
  stop
endif

if (MIME type != video/mp4?) then (yes)
  :Return 400 error;
  stop
endif

:Save to temporary storage;

if (Storage write failed?) then (yes)
  :Log error;
  :Return 500 error;
  stop
endif

:Run ffprobe;

if (Metadata extraction failed?) then (yes)
  :Log error;
  :Delete partial file;
  :Return 500 error;
  stop
endif

if (Needs optimization?) then (yes)
  :Run ffmpeg;
  if (Re-encoding failed?) then (yes)
    :Log warning;
    :Keep original file;
    :Add warning to metadata;
  else (no)
    :Replace with optimized file;
  endif
endif

:Return VideoMetadata;
stop

@enduml
```

### Logging and Monitoring

- **Error Logging**: Python logging module configured to write to file

  - Log level: INFO (configurable via LOG_LEVEL env var)
  - Log format: `[timestamp] [level] [module] message`
  - Log file: `/var/log/condor/app.log` (configurable)
  - Includes stack traces for exceptions

- **Event Logging**: Key operations logged at INFO level

  - Upload events: `"Video uploaded: session={session_id}, video={video_id}, framerate={fps}"`
  - Optimization events: `"Video optimized: method={hw/sw}, time={seconds}, gop={old}->{new}"`
  - Cleanup events: `"Session cleanup: deleted {count} sessions"`

- **Performance Monitoring**: Optimization timing tracked and logged

  - Real-time factor: `duration / processing_time` (e.g., 0.42x = 2.4x slower than realtime)

- **Health Checks**: Startup validation
  - ffmpeg availability check: `subprocess.run(['ffmpeg', '-version'])`
  - Disk space check for /tmp partition (future)

## Dependencies

### External Dependencies

| Dependency            | Version | Purpose                                                       | Failure Impact                                                 |
| --------------------- | ------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| PostgreSQL            | 14+     | Relational database for structured data                       | App unusable (critical)                                        |
| Redis                 | 7+      | Session cache, temporary state, rate limiting                 | Degrades to database-only (performance impact)                 |
| ffmpeg                | system  | Video transcoding (GOP=30 re-encoding)                        | Cannot optimize videos (fallback to original, slower playback) |
| ffprobe               | system  | Video metadata extraction                                     | Cannot process uploads (critical)                              |
| S3-compatible storage | -       | Object storage for video files (optional, can use filesystem) | Cannot persist videos (critical if configured)                 |
| FastAPI               | 0.109   | Web framework                                                 | App unusable (critical)                                        |
| SQLAlchemy            | 2       | ORM for database access                                       | App unusable (critical)                                        |
| Alembic               | 1       | Database migrations                                           | Cannot update schema (development impact)                      |
| Pydantic              | 2       | Data validation and serialization                             | API contract broken (critical)                                 |
| aiofiles              | 23      | Async file I/O for large uploads                              | Degrades to sync I/O (performance impact)                      |
| python-jose           | 3       | JWT token generation and validation                           | Authentication broken (critical)                               |
| passlib               | 1       | Password hashing (bcrypt)                                     | Authentication broken (critical)                               |

### Internal Dependencies

None - backend is a standalone service with no internal subsystem dependencies.

### Configuration Dependencies

| Configuration            | Type | Purpose                                   | Default Value                 |
| ------------------------ | ---- | ----------------------------------------- | ----------------------------- |
| DATABASE_URL             | str  | PostgreSQL connection string              | postgresql://localhost/condor |
| REDIS_URL                | str  | Redis connection string                   | redis://localhost:6379        |
| SECRET_KEY               | str  | JWT signing key                           | (must be set, no default)     |
| STORAGE_BACKEND          | str  | Video storage type ('filesystem' or 's3') | filesystem                    |
| STORAGE_PATH             | str  | Base directory for video files            | /var/lib/condor/videos        |
| S3_BUCKET                | str  | S3 bucket name (if STORAGE_BACKEND=s3)    | -                             |
| S3_REGION                | str  | AWS region (if STORAGE_BACKEND=s3)        | us-east-1                     |
| UPLOAD_MAX_SIZE_MB       | int  | Maximum upload file size                  | 500                           |
| TMP_STORAGE_PATH         | str  | Base directory for temporary files        | /tmp/condor                   |
| CLEANUP_INTERVAL_MINUTES | int  | Background cleanup frequency              | 60                            |
| SESSION_MAX_AGE_DAYS     | int  | Saved session expiration threshold        | 90                            |
| TOKEN_EXPIRY_HOURS       | int  | JWT token validity period                 | 24                            |
| LOG_LEVEL                | str  | Logging verbosity                         | INFO                          |
| LOG_FILE                 | str  | Log file path                             | /var/log/condor/app.log       |

## Testing Strategy

### Unit Testing

- **Test Coverage**: >80% for services, utilities, API endpoints, database models
- **Test Framework**: pytest with async support
- **Mock Strategy**:
  - Database: In-memory SQLite or test database with transaction rollback
  - Redis: fakeredis for cache operations
  - ffmpeg/ffprobe: Mock subprocess calls with predefined outputs
  - S3: moto library for AWS service mocking
  - File I/O: Use temporary directories (pytest tmpdir fixture)
  - FastAPI endpoints: TestClient for API request simulation

**Key Test Suites**:

- `test_auth_service.py`: User registration, login, token validation, password hashing
- `test_user_service.py`: User CRUD operations, preferences management
- `test_video_service.py`: Video upload, metadata extraction, library management
- `test_session_service.py`: Session creation, updates, deletion, cascade behavior
- `test_annotation_service.py`: Annotation CRUD, session association
- `test_video_optimizer.py`: GOP detection, optimization decision logic, ffmpeg parameter validation
- `test_storage_service.py`: File operations, S3 integration, path resolution
- `test_cleanup_service.py`: Expiration logic, orphaned file detection, cascade cleanup
- `test_api_endpoints.py`: Authentication flow, authorization, error handling

### Integration Testing

- **Integration Points**: End-to-end workflows spanning authentication, video management, session persistence, and streaming
- **Test Framework**: pytest with actual database, Redis, and ffmpeg/ffprobe execution
- **Test Data**: Test users, generated test videos with known GOP sizes (GOP=30, GOP=250), sample annotation data
- **Environment**: Docker Compose with PostgreSQL, Redis, and ffmpeg installed

**Test Scenarios**:

- **Authentication Flow**: Register → Login → Access protected endpoint → Logout
- **Video Upload Flow**: Login → Upload → Optimization → Verify metadata in database → Stream video
- **Session Persistence Flow**: Create session → Add annotations → Save → Logout → Login → Retrieve session with annotations
- **Multi-User Isolation**: User A cannot access User B's videos/sessions
- **Cascade Deletion**: Delete session → Verify annotations deleted, videos retained
- **Cleanup Flow**: Create expired session → Run cleanup task → Verify removed from database and storage
- **Video Optimization**: Upload GOP=250 → Verify re-encoded to GOP=30, metadata updated
- **Range Request Streaming**: Request byte range → Verify correct partial content returned

### Performance Testing

- **Re-encoding Performance**: Measure processing time vs video duration (realtime factor)
  - Target: 0.42x realtime on reference hardware (60s video → 25s processing)
- **Streaming Latency**: Measure time to first byte for range requests
  - Target: <100ms for first byte
- **Cleanup Performance**: Measure time to scan and delete 100+ expired sessions
  - Target: <1 second for cleanup scan

**Benchmarks**:
| Metric | Target | Test Method |
|--------|--------|-------------|
| Re-encoding (software) | 0.42x realtime | Time 60s test video on reference hardware |
| Re-encoding (hardware) | Platform-dependent | Test h264_v4l2m2m when GOP=30 supported |
| Streaming first byte | <100ms | Measure Range request latency |
| Cleanup scan | <1s | Benchmark with 100 expired sessions |

## Deployment Considerations

### Resource Requirements

Deployment environment:

- **Memory**:

  - FastAPI app: ~100MB base
  - ffmpeg re-encoding: ~500MB during optimization
  - File streaming: ~50MB per active stream
  - Total: ~650MB typical

- **CPU**:

  - Re-encoding: 100% utilization during GOP=30 optimization (25s for 60s video @ 0.42x realtime on reference hardware)
  - Streaming: <10% (async I/O)
  - API requests: <5%

- **Storage**:
  - Uploaded video: Up to 200MB
  - Optimized video: Often smaller than original (~50% reduction with CRF=23)
  - Session overhead: ~10MB per session (metadata, logs)
  - Total: ~400MB per active session, automatic cleanup after configured expiration

### Configuration

**Environment Variables** (.env):

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/condor
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-secret-key-here
TOKEN_EXPIRY_HOURS=24

# Storage
STORAGE_BACKEND=filesystem  # or 's3'
STORAGE_PATH=/var/lib/condor/videos
# S3_BUCKET=my-bucket  # if STORAGE_BACKEND=s3
# S3_REGION=us-east-1

# Upload limits
UPLOAD_MAX_SIZE_MB=500
TMP_STORAGE_PATH=/tmp/condor

# Cleanup
CLEANUP_INTERVAL_MINUTES=60
SESSION_MAX_AGE_DAYS=90

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/condor/app.log
```

**Docker Compose Deployment**:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: condor
      POSTGRES_USER: condor
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  backend:
    build: .
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgresql://condor:${DB_PASSWORD}@postgres/condor
      REDIS_URL: redis://redis:6379
      SECRET_KEY: ${SECRET_KEY}
    volumes:
      - video_storage:/var/lib/condor/videos
    ports:
      - "8000:8000"

volumes:
  postgres_data:
  redis_data:
  video_storage:
```

### Scaling Considerations

**Current Architecture**:

- **Database**: PostgreSQL with connection pooling, supports multiple concurrent users
- **Storage**: Configurable (filesystem or S3), horizontal scaling possible with object storage
- **Video Processing**: CPU-bound, benefits from dedicated worker processes/containers
- **Authentication**: Stateless JWT tokens enable horizontal scaling of API servers

**Scaling Strategies**:

- **Horizontal API Scaling**: Add more FastAPI instances behind load balancer (stateless design)
- **Database Scaling**: Read replicas for query load, partitioning by user_id for write scaling
- **Video Processing**: Dedicated worker pool (Celery + Redis) for concurrent re-encoding jobs
- **Storage Scaling**: S3 or CDN for video delivery, multi-region replication
- **Caching**: Redis cluster for distributed cache, session storage

**Bottlenecks**:

- **Video Re-encoding**: CPU-intensive, queue-based processing recommended for high load
- **Video Streaming**: Network bandwidth, consider CDN for large user bases
- **Database Writes**: Annotation creation during playback, batch updates or async processing

## Future Enhancements

**Video Processing**:

- **Hardware Encoding**: Platform-specific hardware encoders with GOP=30 support for faster optimization
- **Format Conversion**: Support for additional input formats (AVI, MOV, WEBM) with automatic MP4 conversion
- **Thumbnail Generation**: Extract keyframes as thumbnails for video selection UI
- **Progressive Upload**: Chunked upload support for large videos with resume capability
- **Multi-Resolution Transcoding**: Generate multiple quality levels (480p, 720p, 1080p) for adaptive streaming
- **Cloud Storage Integration**: Direct video import from Google Photos, Apple iCloud Photos, Dropbox, OneDrive
  - OAuth authentication with cloud storage providers
  - Video picker UI showing user's cloud photo library
  - Direct streaming from cloud storage to avoid local download/upload
  - Mobile workflow: Record video on phone → Auto-upload to cloud → Import directly to app
  - Eliminates need for manual local file management

**Data & Storage**:

- **Advanced Search**: Full-text search for video filenames, session names, tags
- **Video Tagging**: User-defined tags for video organization and filtering
- **Shared Sessions**: Allow users to share analysis sessions with other users (read-only or collaborative)
- **Export/Import**: Export sessions with annotations to portable format, import from other tools
- **Storage Quotas**: Per-user storage limits with usage tracking and warnings

**Performance & Scalability**:

- **CDN Integration**: Content delivery network for efficient global video streaming
- **Adaptive Bitrate Streaming**: HLS/DASH for network-adaptive playback quality
- **Metadata Caching**: Aggressive caching of video metadata to reduce database load
- **Background Job Queue**: Celery + Redis for concurrent video processing tasks
- **Database Optimization**: Materialized views, query optimization, partitioning strategies

**Analytics & Monitoring**:

- **User Analytics**: Track usage patterns, popular features, retention metrics
- **Performance Metrics**: API response times, video processing duration, cache hit rates
- **Error Tracking**: Centralized error reporting with stack traces and user context
- **Storage Analytics**: Track storage growth, identify large files, orphaned data detection

**Security & Compliance**:

- **OAuth Integration**: Support for Google, GitHub authentication providers
- **Two-Factor Authentication**: Enhanced security for user accounts
- **Audit Logging**: Track all data access and modifications for compliance
- **Data Encryption**: Encrypt videos at rest, secure video URLs with signed tokens
- **Rate Limiting**: API rate limits per user to prevent abuse
