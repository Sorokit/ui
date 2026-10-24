#!/bin/bash
cd /home/edohwares/Desktop/Room/drips/ui

# Initialize if needed
if [ ! -d .git ]; then
    git init
fi

# Configure user
git config user.name "EDOHWARES" || true
git config user.email "edohwares@users.noreply.github.com" || true

# Create initial commit if none exists
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    git add . 
    git commit -m "Initial commit"
fi

# Create feature branch
git checkout -b fix/swap-execution-tracker-923 2>/dev/null || git checkout fix/swap-execution-tracker-923

# Stage and commit changes
git add .
git commit -m "fix(#923): Fix hardcoded explorer URL and add abort cancellation in SwapExecutionTracker

- Dynamically resolve explorer base URL based on active network from useSorokit (mainnet/testnet/futurenet)
- Add distinct step badges for 'Signing', 'Submitted', 'Confirming', and 'Confirmed' in progress tracker
- Implement cancel button to stop ongoing RPC status polling workers
- Register cancellation callback with provider for network switch handling
- Add comprehensive tests for network-based explorer URLs and cancellation functionality

Fixes issue #923"

echo "Commit successful"
git log --oneline -1
