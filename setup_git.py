#!/usr/bin/env python3
import subprocess
import os
import sys

os.chdir('/home/edohwares/Desktop/Room/drips/ui')

# Initialize repo
subprocess.run(['git', 'init'], capture_output=True)

# Configure git user
subprocess.run(['git', 'config', 'user.name', 'EDOHWARES'], capture_output=True)
subprocess.run(['git', 'config', 'user.email', 'edohwares@users.noreply.github.com'], capture_output=True)

# Check if there's any commit already
result = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True)
if result.returncode != 0:
    # No commits yet, create initial commit
    subprocess.run(['git', 'add', '.'], capture_output=True)
    subprocess.run(['git', 'commit', '-m', 'Initial commit'], capture_output=True)

# Create or switch to feature branch
subprocess.run(['git', 'checkout', '-b', 'fix/swap-execution-tracker-923'], 
               capture_output=True, stderr=subprocess.DEVNULL)

# Stage changes
subprocess.run(['git', 'add', '.'], capture_output=True)

# Commit with detailed message
commit_message = """fix(#923): Fix hardcoded explorer URL and add abort cancellation in SwapExecutionTracker

- Dynamically resolve explorer base URL based on active network from useSorokit (mainnet/testnet/futurenet)
- Add distinct step badges for 'Signing', 'Submitted', 'Confirming', and 'Confirmed' in progress tracker
- Implement cancel button to stop ongoing RPC status polling workers
- Register cancellation callback with provider for network switch handling
- Add comprehensive tests for network-based explorer URLs and cancellation functionality

Fixes issue #923"""

result = subprocess.run(['git', 'commit', '-m', commit_message], 
                       capture_output=True, text=True)

if result.returncode == 0:
    print("✓ Commit successful!")
    # Show the commit
    result = subprocess.run(['git', 'log', '--oneline', '-1'], 
                           capture_output=True, text=True)
    print(f"Commit: {result.stdout.strip()}")
    
    # Show branch
    result = subprocess.run(['git', 'branch', '--show-current'], 
                           capture_output=True, text=True)
    print(f"Branch: {result.stdout.strip()}")
    
    # Show changed files
    result = subprocess.run(['git', 'diff', '--name-only', 'HEAD~1'], 
                           capture_output=True, text=True)
    print(f"Changed files:\n{result.stdout}")
else:
    print("Error:", result.stderr)
    sys.exit(1)
