# General Guidance for Python Language

- Assume the minimum version of Python is 3.12
- Prefer async libraries and functions over synchronous ones
- Always define dependencies and tool settings in `pyproject.toml`: never use `setup.py` or `setup.cfg` files.
- Prefer existing dependencies over adding new ones when possible
- Use keyword arguments instead of positional arguments when calling functions and methods
- Do not put `import` statements inside functions unless necessary to prevent circular imports
- Imports must be at the top of the file
- Use pytest for test framework

# Logging

- Do not use `print` for logging or debugging: use the `getLogger` logger instead.
- Each file must get its own logger using the `__name__` variable for a name.
- Use logging levels to allow developers to enable richer logging while testing than in production.
- Most caught exceptions must be logged with `logger.exception`.

```python
from logging import getLogger
from typing import Dict

logger = getLogger(__name__)

def process_data(data: Dict[str, str]) -> None:
    logger.debug("Starting data processing")
    try:
        result = transform_data(data)
        logger.info("Data processed successfully")
    except ValueError as e:
        logger.exception("Failed to process data")
        raise
```