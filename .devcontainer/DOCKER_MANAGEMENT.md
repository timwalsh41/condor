# Docker Management

## Document Control

- **Version**: 1.0
- **Last Updated**: 2026-02-03

## Overview

This document provides instructions for managing the Claude development container using the provided utility scripts. These scripts automate image building, container lifecycle management, and network configuration.

## Managing the Image

The Docker image contains all necessary development tools, security policies, and networking utilities (`iptables`, `socat`).

### Build or Update Image
Run the build script whenever changes are made to `Dockerfile` or `init-firewall.sh`.
```bash
./.devcontainer/build-image.sh
```

### Clean Up Stale Images
Rebuilding the image leaves "dangling" images that consume disk space. To safely clean these up, first stop the running container and then run the prune command:
```bash
./.devcontainer/connect-container.sh stop
docker image prune -f
```

## Managing the Container

The `connect-container.sh` script is the primary tool for interacting with the environment.

### Primary Actions
- **Connect (Default)**: Start the container if needed and open an interactive shell.
  ```bash
  ./.devcontainer/connect-container.sh
  ```
- **Rebuild**: Force remove and recreate the container to apply configuration changes (e.g., updated port mappings or host paths).
  ```bash
  ./.devcontainer/connect-container.sh rebuild
  ```
- **Stop**: Stop the running container without removing it.
  ```bash
  ./.devcontainer/connect-container.sh stop
  ```

### Advanced Actions
- **Root Access**: Connect as the root user for system-level troubleshooting.
  ```bash
  ./.devcontainer/connect-container.sh root
  ```
- **Restart**: Quickly restart the container and reconnect.
  ```bash
  ./.devcontainer/connect-container.sh restart
  ```

## Troubleshooting

### Port Conflicts
If you encounter errors regarding port `5173`, `8000`, or `6274`, ensure no other services are running on these ports on your host machine.

### Networking (macOS/Colima)
This environment uses a `socat` bridge to handle IPv6 loopback binding required by the `claude` CLI. If authentication fails, ensure the container has been recreated using the `rebuild` command to activate the bridge.

## Related Documents
- `README.md`: Main project overview and quick start.
- `frontend/README.md`: Frontend-specific development and testing instructions.