#!/bin/bash
# =============================================================================
# Macro AI Development tmux Session Setup
# =============================================================================

SESSION_NAME="macro-ai"
PROJECT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session '$SESSION_NAME' already exists. Attaching..."
    tmux attach-session -t "$SESSION_NAME"
    exit 0
fi

# Create new session
echo "Creating new tmux session: $SESSION_NAME"
tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_PATH"

# Window 1: Main Development
tmux rename-window -t "$SESSION_NAME:1" "dev"
tmux send-keys -t "$SESSION_NAME:1" "echo '=== Macro AI Development Environment ==='" Enter
tmux send-keys -t "$SESSION_NAME:1" "echo 'Use Ctrl+a then | to split vertically'" Enter
tmux send-keys -t "$SESSION_NAME:1" "echo 'Use Ctrl+a then - to split horizontally'" Enter
tmux send-keys -t "$SESSION_NAME:1" "echo 'Use Alt+arrow keys to switch panes'" Enter

# Window 2: Frontend (Client UI)
tmux new-window -t "$SESSION_NAME:2" -n "frontend" -c "$PROJECT_PATH/apps/client-ui"
tmux send-keys -t "$SESSION_NAME:2" "echo '=== Frontend Development ==='" Enter
tmux send-keys -t "$SESSION_NAME:2" "pnpm dev" Enter

# Window 3: Backend (Express API)
tmux new-window -t "$SESSION_NAME:3" -n "backend" -c "$PROJECT_PATH/apps/express-api"
tmux send-keys -t "$SESSION_NAME:3" "echo '=== Backend Development ==='" Enter
tmux send-keys -t "$SESSION_NAME:3" "pnpm dev" Enter

# Window 4: Infrastructure
tmux new-window -t "$SESSION_NAME:4" -n "infra" -c "$PROJECT_PATH/infrastructure"
tmux send-keys -t "$SESSION_NAME:4" "echo '=== Infrastructure ==='" Enter
tmux send-keys -t "$SESSION_NAME:4" "echo 'CDK commands and infrastructure management'" Enter

# Window 5: Monitoring & Logs
tmux new-window -t "$SESSION_NAME:5" -n "monitor" -c "$PROJECT_PATH"
tmux send-keys -t "$SESSION_NAME:5" "echo '=== Monitoring & Logs ==='" Enter
tmux send-keys -t "$SESSION_NAME:5" "echo 'Use this for logs, monitoring, and general terminal work'" Enter

# Split the main development window for better workflow
tmux select-window -t "$SESSION_NAME:1"
tmux split-window -h -c "$PROJECT_PATH"
tmux send-keys -t "$SESSION_NAME:1.1" "echo '=== Git Operations ==='" Enter
tmux send-keys -t "$SESSION_NAME:1.1" "git status" Enter

# Set the main pane to be the left one
tmux select-pane -t "$SESSION_NAME:1.0"

echo "tmux session '$SESSION_NAME' created successfully!"
echo "Windows available:"
echo "  1. dev      - Main development (split with git)"
echo "  2. frontend - Client UI development"
echo "  3. backend  - Express API development"
echo "  4. infra    - Infrastructure management"
echo "  5. monitor  - Monitoring and logs"
echo ""
echo "Attaching to session..."
tmux attach-session -t "$SESSION_NAME"
