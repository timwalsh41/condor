# Code Style & Conventions

## General Guidelines

### Documentation
- **Google-style docstrings** for all public functions, classes, modules
- **Comment complex logic** with `# Reason:` prefix explaining the why
- **Keep documentation current** with implementation

### File Limits (Enforce Loosely)
- **Files**: 1000 lines max - Refactor if approaching
- **Functions**: 100 lines max - Single responsibility
- **Class declarations**: 300 lines max - Single concept
- **Line length**: 100 characters max

## Project Structure

### Test Placement
```
tests/                          # Integration tests only (end-to-end, system requirements)
    conftest.py
    test_integration_*.py

src/project/
    __init__.py
    main.py
    tests/                      # Unit tests for main.py
        test_main.py
    
    module/
        __init__.py
        implementation.py
        tests/                  # Unit tests for module
            test_implementation.py
    
    features/
        feature_name/
            __init__.py
            handlers.py
            tests/              # Unit tests for feature
                test_handlers.py
```

**Rule**: 
- **Unit tests**: Next to code in local `tests/` folders
- **Integration tests**: In project root `/tests` folder

## Code Management
- **Eliminate dead code** - Don't leave it "just in case", git keeps history
- **Atomic commits** - Prefer independent commits for clean reversion
- **Refactor to limit repetition** - Abstract operations into separate classes/functions

## Architecture Principles

### Leakage-Free Interfaces
- Consumers depend only on contracts, not internal implementation
- Changes to implementation don't affect consumers (if contract maintained)
- Interfaces explicitly defined (APIs, function signatures, protocols, schemas)

### Separation of Concerns
- Video playback logic separate from annotation logic
- Backend only handles file I/O and streaming (no video processing in MVP)
- Frontend handles all video control, sync calculations, annotation rendering

## Python-Specific (FastAPI Backend)
- Use `async def` for all endpoints (non-blocking I/O)
- Use Pydantic models for request/response validation
- Implement proper exception handlers
- Use dependency injection for shared resources

## TypeScript-Specific (React Frontend)
- Use functional components with hooks (no class components)
- Use TypeScript strict mode
- Leverage `useMemo` and `useCallback` for performance
- Clean up effects properly (cancel callbacks, clear timers)
- Use error boundaries for graceful error handling
