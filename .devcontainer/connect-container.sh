#!/bin/bash
set -euo pipefail

# Script to run and connect to the Claude development container
CONTAINER_NAME="claude-dev-container"
IMAGE_NAME="claude-dev:latest"
HOST_CODE_DIR="/home/tim/Documents/Code"
CONTAINER_CODE_DIR="/code"

# Parse command line arguments
ACTION="${1:-connect}"  # Default action is connect

# Function to check if container exists
container_exists() {
    docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if container is running
container_running() {
    docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"
}

# Function to check if container image is outdated
container_outdated() {
    if ! container_exists; then
        return 1
    fi
    
    local container_image_id=$(docker inspect --format='{{.Image}}' "$CONTAINER_NAME" 2>/dev/null)
    local current_image_id=$(docker inspect --format='{{.Id}}' "$IMAGE_NAME" 2>/dev/null)
    
    if [ "$container_image_id" != "$current_image_id" ]; then
        return 0  # Container is outdated
    else
        return 1  # Container is up to date
    fi
}

# Function to remove existing container
remove_container() {
    echo "Removing outdated container..."
    docker rm -f "$CONTAINER_NAME"
}

# Function to stop container
stop_container() {
    if container_running; then
        echo "Stopping container..."
        docker stop "$CONTAINER_NAME"
        echo "✅ Container stopped"
    else
        echo "⚠️  Container is not running"
    fi
}

# Function to restart container
restart_container() {
    if container_exists; then
        echo "Restarting container..."
        docker restart "$CONTAINER_NAME"
        echo "✅ Container restarted"
        sleep 2
    else
        echo "⚠️  Container does not exist, creating new container..."
        create_container
        sleep 2
    fi
}

# Function to start existing container
start_container() {
    echo "Starting existing container..."
    docker start "$CONTAINER_NAME"
}

# Function to create and run new container, forward ports for Vite dev server and FastAPI backend
create_container() {
    echo "Creating new container..."
    docker run -d \
        --name "$CONTAINER_NAME" \
        --privileged \
        --cap-add=NET_ADMIN \
        --cap-add=SYS_ADMIN \
        -p 5173:5173 \
        -p 8000:8000 \
        -v "$HOST_CODE_DIR:$CONTAINER_CODE_DIR:z" \
        -v claude-dev-history:/commandhistory \
        -v claude-dev-config:/home/node/.claude \
        --workdir "$CONTAINER_CODE_DIR" \
        "$IMAGE_NAME" \
        sleep infinity
}

# Function to connect to container with zsh
connect_container() {
    echo "Connecting to container with zsh..."
    echo "📁 Your code directory is mounted at: $CONTAINER_CODE_DIR"
    echo "🔧 Claude config is persisted in a named volume"
    echo "📝 Command history is persisted across sessions"
    echo "🌐 Port 5173 forwarded (Vite dev server: http://localhost:5173)"
    echo "🌐 Port 8000 forwarded (FastAPI backend: http://localhost:8000)"
    echo ""
    
    # Execute the container with zsh and proper terminal settings
    docker exec -it "$CONTAINER_NAME" zsh -c "
        # Ensure we're in the mounted code directory
        cd $CONTAINER_CODE_DIR
        
        # Initialize firewall on first connection (if needed)
        if ! iptables -L >/dev/null 2>&1; then
            echo 'Initializing firewall rules...'
            sudo /usr/local/bin/init-firewall.sh
        fi
        
        # Initialize Claude configuration on first run
        /usr/local/bin/init-claude.sh
        
        # Start an interactive zsh session
        exec zsh
    "
}

# Function to connect to container as root user with zsh
connect_container_root() {
    echo "Connecting to container as root with zsh..."
    echo "⚠️  You are connecting as ROOT user"
    echo "📁 Your code directory is mounted at: $CONTAINER_CODE_DIR"
    echo ""
    
    # Execute the container as root with zsh
    docker exec -it -u root "$CONTAINER_NAME" zsh -c "
        # Ensure we're in the mounted code directory
        cd $CONTAINER_CODE_DIR
        
        # Start an interactive zsh session as root
        exec zsh
    "
}

# Function to print usage
print_usage() {
    echo "Usage: $0 [ACTION]"
    echo ""
    echo "Actions:"
    echo "  connect  - Start container if needed and connect (default)"
    echo "  root     - Connect to container as root user"
    echo "  start    - Start the container without connecting"
    echo "  stop     - Stop the running container"
    echo "  restart  - Restart the container"
    echo "  rebuild  - Remove and recreate the container"
    echo ""
    echo "Examples:"
    echo "  $0           # Connect to container (start if needed)"
    echo "  $0 connect   # Same as above"
    echo "  $0 root      # Connect as root user"
    echo "  $0 stop      # Stop the container"
    echo "  $0 restart   # Restart the container"
    echo "  $0 rebuild   # Remove and recreate container"
}

# Main logic
echo "🐳 Claude Development Container Manager"
echo "======================================"

# Handle help flag
if [[ "$ACTION" == "help" || "$ACTION" == "-h" || "$ACTION" == "--help" ]]; then
    print_usage
    exit 0
fi

# Validate action
case "$ACTION" in
    connect|root|start|stop|restart|rebuild)
        ;;
    *)
        echo "❌ Invalid action: $ACTION"
        echo ""
        print_usage
        exit 1
        ;;
esac

# Handle stop action
if [[ "$ACTION" == "stop" ]]; then
    if ! container_exists; then
        echo "⚠️  Container does not exist"
        exit 0
    fi
    stop_container
    exit 0
fi

# Handle root connection action
if [[ "$ACTION" == "root" ]]; then
    if ! container_exists; then
        echo "❌ Container does not exist. Please start it first."
        exit 1
    fi
    if ! container_running; then
        echo "❌ Container is not running. Please start it first."
        exit 1
    fi
    connect_container_root
    exit 0
fi

# Handle restart action
if [[ "$ACTION" == "restart" ]]; then
    restart_container
    if [[ "$ACTION" == "restart" ]]; then
        # After restart, connect if user wants
        connect_container
    fi
    exit 0
fi

# Handle rebuild action
if [[ "$ACTION" == "rebuild" ]]; then
    if container_exists; then
        echo "Removing existing container..."
        docker rm -f "$CONTAINER_NAME"
    fi
    create_container
    sleep 2
    connect_container
    exit 0
fi

# Main logic (for connect/start actions)
echo ""

# Check if image exists
if ! docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "❌ Image '$IMAGE_NAME' not found. Please run './build-image.sh' first."
    exit 1
fi

# Check container status and handle accordingly
if container_exists; then
    # Check if container is using an outdated image
    if container_outdated; then
        echo "⚠️  Container is using an outdated image"
        remove_container
        create_container
        sleep 2
    elif container_running; then
        echo "✅ Container is already running"
    else
        start_container
        # Wait a moment for container to fully start
        sleep 2
    fi
else
    create_container
    # Wait a moment for container to fully start
    sleep 2
fi

# Connect to the container (unless action is just 'start')
if [[ "$ACTION" != "start" ]]; then
    connect_container
else
    echo "✅ Container is running"
    echo "Run '$0 connect' to connect to it"
fi
