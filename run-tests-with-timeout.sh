#!/bin/bash
# Run tests with timeout to prevent hanging

# Kill any existing vitest processes
pkill -f "vitest" 2>/dev/null || true

# Run tests in background with timeout
(
  npx vitest run --coverage --reporter=verbose 2>&1 &
  PID=$!
  
  # Wait up to 60 seconds
  for i in {1..60}; do
    if ! kill -0 $PID 2>/dev/null; then
      # Process finished
      wait $PID
      exit $?
    fi
    sleep 1
  done
  
  # Timeout - kill the process
  echo "Tests timed out after 60 seconds"
  kill -9 $PID 2>/dev/null
  exit 124
)
