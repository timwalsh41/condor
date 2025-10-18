# Suggested Commands

## Project Management

### Serena Activation (CRITICAL - Do this at every session start!)
```bash
# From within Claude Code, use:
activate serena project
```

### PRP Workflow Commands (Slash Commands in Claude Code)
```bash
/generate-prp              # Generate requirements and PRP from INITIAL.md
/execute-prp               # Execute PRP with agent coordination
/design-inputs             # Create new design inputs document
/prep-parallel             # Prepare for parallel agent execution
/execute-parallel          # Execute tasks in parallel
/fix-github-issue          # Fix a GitHub issue
/primer                    # Get primer on project/codebase
```

## Development Commands (When Code Exists)

### Python/Backend (FastAPI)
```bash
# Development server
uvicorn main:app --reload                   # Start development server
uvicorn main:app --host 0.0.0.0 --port 8000 # Production-like server

# Testing
pytest                                      # Run all tests
pytest tests/                               # Integration tests only
pytest src/                                 # Unit tests only
pytest -v                                   # Verbose output
pytest --cov                                # With coverage report
pytest -k "test_name"                       # Run specific test

# Linting and formatting
ruff check .                                # Check for issues
ruff check --fix .                          # Auto-fix issues
ruff format .                               # Format code

# Type checking
mypy .                                      # Type check (if configured)
```

### TypeScript/Frontend (React + Vite)
```bash
# Development
npm install                                 # Install dependencies
npm run dev                                 # Start dev server
npm run build                               # Production build
npm run preview                             # Preview production build

# Testing
npm test                                    # Run tests
npm test -- --coverage                      # With coverage
npm test -- --watch                         # Watch mode
npm run test:ui                             # UI test runner

# Linting and formatting
npm run lint                                # Check for lint issues
npm run lint:fix                            # Auto-fix lint issues
npm run type-check                          # TypeScript type checking

# Type generation
npm run codegen                             # Generate types from API (if configured)
```

## System Utilities (Linux)

### File Operations
```bash
ls -la                                      # List files with details
find . -name "pattern"                      # Find files by pattern
tree -L 2                                   # Show directory tree (2 levels)
grep -r "pattern" .                         # Search for pattern in files
cat file.txt                                # Display file contents
```

### Git Operations
```bash
git status                                  # Check status
git log --oneline -10                       # View recent commits
git diff                                    # Show unstaged changes
git diff --staged                           # Show staged changes
git branch                                  # List branches
git checkout -b feature/name                # Create and switch to branch
git add .                                   # Stage all changes
git commit -m "message"                     # Commit changes
git push origin branch-name                 # Push to remote
```

### Process Management
```bash
ps aux | grep process_name                  # Find running process
kill -9 PID                                 # Kill process
systemctl status service_name               # Check service status
systemctl start service_name                # Start service
systemctl stop service_name                 # Stop service
```

### Network
```bash
netstat -tlnp                               # Show listening ports
curl http://localhost:8000                  # Test HTTP endpoint
curl -I http://localhost:8000               # Headers only
```

### System Info
```bash
uname -a                                    # System information
df -h                                       # Disk space
free -h                                     # Memory usage
top                                         # Process monitor (q to quit)
```

## Docker (If Used for Deployment)
```bash
docker build -t condor:latest .             # Build image
docker run -p 8000:8000 condor:latest       # Run container
docker ps                                   # List running containers
docker logs container_id                    # View logs
docker-compose up                           # Start services
docker-compose down                         # Stop services
docker-compose logs -f                      # Follow logs
```

## Project-Specific Commands (To Be Determined)

These will be added as the project evolves:
- Backend startup script
- Database migration commands (post-MVP)
- Video transcoding utilities (post-MVP)
- Deployment scripts
- Backup/restore procedures

## Quick Reference

### First Time Setup (When Implementation Begins)
1. Activate Serena: `activate serena project`
2. Generate requirements: `/generate-prp`
3. Start execution: `/execute-prp`

### Typical Development Session
1. Activate Serena: `activate serena project`
2. Consult project-manager for briefing
3. Implement tasks
4. Run tests: `pytest` and/or `npm test`
5. Coordinate with agents (review, validate, document)
6. Commit changes with proper format

### Before Ending Session
1. All tests pass
2. All agents coordinated
3. Documentation updated
4. PROJECT_PLAN.md updated
5. Codebase stable and validated
