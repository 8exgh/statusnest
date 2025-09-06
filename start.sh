#!/bin/bash

echo "Starting StatusNest MVP..."
echo "========================="

# Start Next.js application
echo "Starting Next.js application..."
cd nextjs_statusnest
npm run dev &
NEXTJS_PID=$!

# Wait for Next.js to start
sleep 5

# Start background processor
echo "Starting background processor..."
cd ../background_processor
npm run dev &
PROCESSOR_PID=$!

echo ""
echo "StatusNest is running!"
echo "======================"
echo "Next.js app: http://localhost:3000"
echo "Process IDs: Next.js=$NEXTJS_PID, Processor=$PROCESSOR_PID"
echo ""
echo "Press Ctrl+C to stop both services"

# Wait for interrupt
trap "echo 'Stopping services...'; kill $NEXTJS_PID $PROCESSOR_PID; exit" INT

# Keep script running
wait