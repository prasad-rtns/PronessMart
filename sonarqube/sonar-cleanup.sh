#!/bin/bash

# Cleanup old analysis data
echo "Cleaning up SonarQube analysis data..."

# Remove coverage reports
find . -name "coverage" -type d -exec rm -rf {} +
find . -name "test-report.xml" -type f -delete
find . -name ".scannerwork" -type d -exec rm -rf {} +

echo "Cleanup completed!"