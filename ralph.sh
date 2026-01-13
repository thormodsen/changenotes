#!/bin/bash
# Ralph - Autonomous Claude Code Loop
# Runs Claude repeatedly until all PRD items complete

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_ITERATIONS=${1:-10}
STALL_THRESHOLD=${2:-3}
ARCHIVE_DIR="$SCRIPT_DIR/archive"
STALL_COUNT=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[ralph]${NC} $1"; }
warn() { echo -e "${YELLOW}[ralph]${NC} $1"; }
error() { echo -e "${RED}[ralph]${NC} $1"; }

# Validate dependencies
command -v claude >/dev/null 2>&1 || { error "claude CLI not found"; exit 1; }
command -v jq >/dev/null 2>&1 || { error "jq not found (brew install jq)"; exit 1; }

# Validate required files
[[ -f "$SCRIPT_DIR/prd.json" ]] || { error "prd.json not found - run /prd first"; exit 1; }
[[ -f "$SCRIPT_DIR/prompt.md" ]] || { error "prompt.md not found"; exit 1; }

# Archive previous run if exists
archive_previous_run() {
    local branch=$(git branch --show-current 2>/dev/null || echo "no-branch")
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local archive_path="$ARCHIVE_DIR/${branch}_${timestamp}"

    if [[ -f "$SCRIPT_DIR/progress.txt" ]]; then
        mkdir -p "$archive_path"
        cp "$SCRIPT_DIR/progress.txt" "$archive_path/" 2>/dev/null || true
        cp "$SCRIPT_DIR/prd.json" "$archive_path/" 2>/dev/null || true
        log "Archived previous run to $archive_path"
    fi
}

# Count remaining stories
remaining_stories() {
    jq '[.stories[] | select(.passes == false)] | length' "$SCRIPT_DIR/prd.json" 2>/dev/null || echo "?"
}

# Get git state snapshot (used to detect changes)
git_snapshot() {
    local status=$(git -C "$SCRIPT_DIR" status --porcelain 2>/dev/null || echo "")
    local head=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null || echo "no-commits")
    echo "${status}${head}" | shasum | cut -d' ' -f1
}

# Main loop
main() {
    log "Starting Ralph - max $MAX_ITERATIONS iterations, stall threshold $STALL_THRESHOLD"
    log "Remaining stories: $(remaining_stories)"

    archive_previous_run

    local last_snapshot=$(git_snapshot)

    for i in $(seq 1 "$MAX_ITERATIONS"); do
        echo ""
        log "═══════════════════════════════════════"
        log "Iteration $i / $MAX_ITERATIONS"
        log "Remaining: $(remaining_stories) stories"
        [[ $STALL_COUNT -gt 0 ]] && warn "Stall count: $STALL_COUNT / $STALL_THRESHOLD"
        log "═══════════════════════════════════════"

        # Run Claude with the prompt
        OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | claude -p --dangerously-skip-permissions 2>&1) || true

        # Check for completion signal
        if echo "$OUTPUT" | grep -q "<ralph>COMPLETE</ralph>"; then
            echo ""
            log "═══════════════════════════════════════"
            log "ALL STORIES COMPLETE"
            log "═══════════════════════════════════════"
            exit 0
        fi

        # Check for stall (no git changes)
        local current_snapshot=$(git_snapshot)
        if [[ "$current_snapshot" == "$last_snapshot" ]]; then
            STALL_COUNT=$((STALL_COUNT + 1))
            warn "No changes detected (stall $STALL_COUNT / $STALL_THRESHOLD)"

            if [[ $STALL_COUNT -ge $STALL_THRESHOLD ]]; then
                echo ""
                error "═══════════════════════════════════════"
                error "STALL DETECTED - $STALL_THRESHOLD iterations with no changes"
                error "═══════════════════════════════════════"
                error "Claude may be stuck. Check:"
                error "  - prd.json for unclear acceptance criteria"
                error "  - progress.txt for repeated errors"
                error "  - The actual error output above"
                exit 1
            fi
        else
            STALL_COUNT=0
            last_snapshot="$current_snapshot"
        fi

        sleep 2
    done

    warn "Reached max iterations ($MAX_ITERATIONS) without completion"
    warn "Remaining stories: $(remaining_stories)"
    exit 1
}

main
