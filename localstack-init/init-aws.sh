#!/bin/bash

echo "🔧 Initializing LocalStack resources..."

# Wait a bit for LocalStack to be fully ready
sleep 5

# Create SQS queue
awslocal sqs create-queue --queue-name places_test

echo "✅ SQS queue 'places_test' created successfully!"

# List queues to confirm
echo "📋 Available queues:"
awslocal sqs list-queues
