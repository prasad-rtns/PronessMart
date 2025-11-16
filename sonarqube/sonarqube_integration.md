# SonarQube Integration for PronessMart

## Overview

This guide integrates SonarQube for continuous code quality inspection across all 4 microservices (User, Product, Cart, and Order services).

---

## Step 1: Add SonarQube to Docker Compose

Update your `docker-compose.yml` to include SonarQube and PostgreSQL (SonarQube database).

```yaml
# Add to your existing docker-compose.yml

services:
  # ... existing services ...

  # SonarQube PostgreSQL Database
  sonarqube-db:
    image: postgres:15-alpine
    container_name: sonarqube-db
    environment:
      POSTGRES_USER: sonar
      POSTGRES_PASSWORD: sonar
      POSTGRES_DB: sonarqube
    volumes:
      - sonarqube-db-data:/var/lib/postgresql/data
    networks:
      - ecommerce-network
    restart: unless-stopped

  # SonarQube Server
  sonarqube:
    image: sonarqube:10-community
    container_name: sonarqube
    depends_on:
      - sonarqube-db
    environment:
      SONAR_JDBC_URL: jdbc:postgresql://sonarqube-db:5432/sonarqube
      SONAR_JDBC_USERNAME: sonar
      SONAR_JDBC_PASSWORD: sonar
    ports:
      - "9000:9000"
    volumes:
      - sonarqube-data:/opt/sonarqube/data
      - sonarqube-extensions:/opt/sonarqube/extensions
      - sonarqube-logs:/opt/sonarqube/logs
    networks:
      - ecommerce-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "-", "http://localhost:9000/api/system/status"]
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  # ... existing volumes ...
  sonarqube-db-data:
  sonarqube-data:
  sonarqube-extensions:
  sonarqube-logs:
```

---

## Step 2: Create sonar-project.properties for Each Service

### User Service

Create `user-service/sonar-project.properties`:

```properties
# Project identification
sonar.projectKey=pronessmart-user-service
sonar.projectName=PronessMart User Service
sonar.projectVersion=1.0.0

# Source code location
sonar.sources=src
sonar.tests=tests

# Exclusions
sonar.exclusions=**/node_modules/**,**/coverage/**,**/dist/**,**/*.test.js,**/*.spec.js

# Test coverage
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.testExecutionReportPaths=test-report.xml

# Code analysis
sonar.sourceEncoding=UTF-8
sonar.language=js

# JavaScript/Node.js specific
sonar.nodejs.executable=/usr/local/bin/node
```

### Product Service

Create `product-service/sonar-project.properties`:

```properties
# Project identification
sonar.projectKey=pronessmart-product-service
sonar.projectName=PronessMart Product Service
sonar.projectVersion=1.0.0

# Source code location
sonar.sources=src
sonar.tests=tests

# Exclusions
sonar.exclusions=**/node_modules/**,**/coverage/**,**/dist/**,**/*.test.js,**/*.spec.js

# Test coverage
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.testExecutionReportPaths=test-report.xml

# Code analysis
sonar.sourceEncoding=UTF-8
sonar.language=js
```

### Cart Service

Create `cart-service/sonar-project.properties`:

```properties
# Project identification
sonar.projectKey=pronessmart-cart-service
sonar.projectName=PronessMart Cart Service
sonar.projectVersion=1.0.0

# Source code location
sonar.sources=src
sonar.tests=tests

# Exclusions
sonar.exclusions=**/node_modules/**,**/coverage/**,**/dist/**,**/*.test.js,**/*.spec.js

# Test coverage
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.testExecutionReportPaths=test-report.xml

# Code analysis
sonar.sourceEncoding=UTF-8
sonar.language=js
```

### Order Service

Create `order-service/sonar-project.properties`:

```properties
# Project identification
sonar.projectKey=pronessmart-order-service
sonar.projectName=PronessMart Order Service
sonar.projectVersion=1.0.0

# Source code location
sonar.sources=src
sonar.tests=tests

# Exclusions
sonar.exclusions=**/node_modules/**,**/coverage/**,**/dist/**,**/*.test.js,**/*.spec.js

# Test coverage
sonar.javascript.lcov.reportPaths=coverage/lcov.info
sonar.testExecutionReportPaths=test-report.xml

# Code analysis
sonar.sourceEncoding=UTF-8
sonar.language=js

# Circuit breaker and helpers
sonar.sources=src,helpers,middlewares
```

---

## Step 3: Install SonarQube Scanner

Add to each service's `package.json`:

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:coverage": "jest --coverage --coverageReporters=lcov",
    "sonar": "sonar-scanner",
    "sonar:scan": "npm run test:coverage && sonar-scanner"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "sonarqube-scanner": "^3.3.0"
  }
}
```

Install the dependency:

```bash
cd user-service && npm install --save-dev sonarqube-scanner
cd ../product-service && npm install --save-dev sonarqube-scanner
cd ../cart-service && npm install --save-dev sonarqube-scanner
cd ../order-service && npm install --save-dev sonarqube-scanner
```

---

## Step 4: Create Master Scan Script

Create `sonar-scan-all.sh` in the project root:

```bash
#!/bin/bash

# SonarQube Scanner Script for All Services
# Run this script to scan all microservices

set -e

SONAR_HOST_URL="http://localhost:9000"
SONAR_TOKEN="${SONAR_TOKEN:-your-token-here}"

echo "============================================"
echo "PronessMart - SonarQube Code Analysis"
echo "============================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to scan a service
scan_service() {
    SERVICE_NAME=$1
    SERVICE_DIR=$2
    
    echo -e "${YELLOW}Scanning ${SERVICE_NAME}...${NC}"
    cd ${SERVICE_DIR}
    
    # Run tests with coverage
    echo "Running tests and generating coverage..."
    npm run test:coverage || true
    
    # Run SonarQube scan
    echo "Running SonarQube analysis..."
    npx sonar-scanner \
        -Dsonar.host.url=${SONAR_HOST_URL} \
        -Dsonar.login=${SONAR_TOKEN}
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ ${SERVICE_NAME} scan completed${NC}"
    else
        echo -e "${RED}✗ ${SERVICE_NAME} scan failed${NC}"
    fi
    
    cd ..
    echo ""
}

# Check if SonarQube is running
echo "Checking SonarQube availability..."
if curl -s ${SONAR_HOST_URL}/api/system/status | grep -q "UP"; then
    echo -e "${GREEN}✓ SonarQube is running${NC}"
else
    echo -e "${RED}✗ SonarQube is not running. Please start it first.${NC}"
    echo "Run: docker compose up -d sonarqube"
    exit 1
fi

echo ""

# Scan all services
scan_service "User Service" "user-service"
scan_service "Product Service" "product-service"
scan_service "Cart Service" "cart-service"
scan_service "Order Service" "order-service"

echo "============================================"
echo -e "${GREEN}All scans completed!${NC}"
echo "View results at: ${SONAR_HOST_URL}"
echo "============================================"
```

Make it executable:

```bash
chmod +x sonar-scan-all.sh
```

---

## Step 5: Update Jest Configuration

Create/Update `jest.config.js` in each service:

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    'helpers/**/*.js',
    'middlewares/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/config/**',
    '!src/server.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.test.js',
    '**/*.spec.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
```

---

## Step 6: Create .sonarqube Directory Structure

```bash
# Create directories for SonarQube cache
mkdir -p .sonarqube/cache
mkdir -p .sonarqube/scanner

# Add to .gitignore
echo ".sonarqube/" >> .gitignore
echo "coverage/" >> .gitignore
echo "test-report.xml" >> .gitignore
```

---

## Step 7: Setup and Configuration

### Start SonarQube

```bash
# Start SonarQube
docker compose up -d sonarqube sonarqube-db

# Wait for SonarQube to be ready (takes 2-3 minutes)
echo "Waiting for SonarQube to start..."
sleep 120

# Check status
docker compose logs sonarqube | tail -20
```

### Initial SonarQube Configuration

1. **Access SonarQube:**
   ```
   http://localhost:9000
   ```

2. **Default Login:**
   - Username: `admin`
   - Password: `admin`
   - (You'll be prompted to change the password)

3. **Generate Authentication Token:**
   - Click on your profile (top right)
   - Go to "My Account" → "Security"
   - Generate Token:
     - Name: `pronessmart-scanner`
     - Type: `Global Analysis Token`
     - Expires: Never (or set expiration)
   - Copy the token and save it

4. **Update Environment:**
   ```bash
   export SONAR_TOKEN=<your-token-here>
   ```

   Or add to `.env`:
   ```bash
   SONAR_TOKEN=<your-token-here>
   ```

---

## Step 8: Run Analysis

### Scan All Services

```bash
# Set your token
export SONAR_TOKEN=your_sonar_token_here

# Run complete scan
./sonar-scan-all.sh
```

### Scan Individual Service

```bash
# User Service
cd user-service
npm run sonar:scan

# Product Service
cd product-service
npm run sonar:scan

# Cart Service
cd cart-service
npm run sonar:scan

# Order Service
cd order-service
npm run sonar:scan
```

---

## Step 9: CI/CD Integration

### GitHub Actions Workflow

Create `.github/workflows/sonarqube-analysis.yml`:

```yaml
name: SonarQube Analysis

on:
  push:
    branches:
      - main
      - develop
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  sonarqube:
    name: SonarQube Code Analysis
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: sonar
          POSTGRES_PASSWORD: sonar
          POSTGRES_DB: sonarqube
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      sonarqube:
        image: sonarqube:10-community
        env:
          SONAR_JDBC_URL: jdbc:postgresql://postgres:5432/sonarqube
          SONAR_JDBC_USERNAME: sonar
          SONAR_JDBC_PASSWORD: sonar
        options: >-
          --health-cmd "wget -q -O - http://localhost:9000/api/system/status | grep UP"
          --health-interval 30s
          --health-timeout 10s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Shallow clones should be disabled for better analysis

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      # User Service
      - name: Install Dependencies - User Service
        run: |
          cd user-service
          npm ci

      - name: Run Tests - User Service
        run: |
          cd user-service
          npm run test:coverage

      - name: SonarQube Scan - User Service
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
        with:
          projectBaseDir: user-service

      # Product Service
      - name: Install Dependencies - Product Service
        run: |
          cd product-service
          npm ci

      - name: Run Tests - Product Service
        run: |
          cd product-service
          npm run test:coverage

      - name: SonarQube Scan - Product Service
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
        with:
          projectBaseDir: product-service

      # Cart Service
      - name: Install Dependencies - Cart Service
        run: |
          cd cart-service
          npm ci

      - name: Run Tests - Cart Service
        run: |
          cd cart-service
          npm run test:coverage

      - name: SonarQube Scan - Cart Service
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
        with:
          projectBaseDir: cart-service

      # Order Service
      - name: Install Dependencies - Order Service
        run: |
          cd order-service
          npm ci

      - name: Run Tests - Order Service
        run: |
          cd order-service
          npm run test:coverage

      - name: SonarQube Scan - Order Service
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: ${{ secrets.SONAR_HOST_URL }}
        with:
          projectBaseDir: order-service

      # Quality Gate Check
      - name: SonarQube Quality Gate Check
        uses: SonarSource/sonarqube-quality-gate-action@master
        timeout-minutes: 5
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

---

## Step 10: Quality Gates Configuration

### Configure Quality Gates in SonarQube UI

1. Navigate to **Quality Gates**
2. Create new gate: "PronessMart Standards"
3. Add conditions:

```yaml
Conditions:
  # Code Coverage
  - Coverage on New Code: < 80% (ERROR)
  - Coverage: < 80% (WARNING)
  
  # Code Smells
  - Code Smells on New Code: > 5 (WARNING)
  - Maintainability Rating on New Code: Worse than A (ERROR)
  
  # Bugs
  - Bugs on New Code: > 0 (ERROR)
  - Reliability Rating on New Code: Worse than A (ERROR)
  
  # Vulnerabilities
  - Vulnerabilities on New Code: > 0 (ERROR)
  - Security Rating on New Code: Worse than A (ERROR)
  
  # Duplications
  - Duplicated Lines on New Code: > 3% (WARNING)
  
  # Technical Debt
  - Technical Debt Ratio on New Code: > 5% (ERROR)
```

4. Set as default for all projects

---

## Step 11: SonarQube Dashboard Configuration

### Create Custom Dashboard

1. Go to **Administration** → **Projects** → **Management**
2. For each project, configure:
   - **Main Branch:** `main`
   - **New Code Period:** Previous version
   - **Tags:** Add tags like `microservice`, `nodejs`, `ecommerce`

### Configure Webhooks

1. **Administration** → **Configuration** → **Webhooks**
2. Create webhook for Slack/Discord/Email notifications
3. URL: Your notification endpoint
4. Secret: Optional authentication

---

## Step 12: View Results

### Access SonarQube Dashboard

```
http://localhost:9000
```

### Key Metrics to Monitor

**Overview Dashboard:**
- Bugs
- Vulnerabilities
- Code Smells
- Coverage
- Duplications
- Security Hotspots

**Per Service:**
- Lines of Code
- Cyclomatic Complexity
- Cognitive Complexity
- Technical Debt
- Maintainability Rating
- Reliability Rating
- Security Rating

---

## Step 13: Maintenance Scripts

### Create `sonar-cleanup.sh`

```bash
#!/bin/bash

# Cleanup old analysis data
echo "Cleaning up SonarQube analysis data..."

# Remove coverage reports
find . -name "coverage" -type d -exec rm -rf {} +
find . -name "test-report.xml" -type f -delete
find . -name ".scannerwork" -type d -exec rm -rf {} +

echo "Cleanup completed!"
```

### Create `sonar-reset.sh`

```bash
#!/bin/bash

# Reset SonarQube (careful - this deletes all data!)
echo "WARNING: This will delete all SonarQube data!"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" == "yes" ]; then
    docker compose down sonarqube sonarqube-db
    docker volume rm pronessmart_sonarqube-data
    docker volume rm pronessmart_sonarqube-db-data
    docker volume rm pronessmart_sonarqube-extensions
    docker volume rm pronessmart_sonarqube-logs
    echo "SonarQube reset completed!"
    echo "Run 'docker compose up -d sonarqube' to restart"
else
    echo "Reset cancelled"
fi
```

---

## Troubleshooting

### Issue 1: SonarQube Won't Start

```bash
# Check logs
docker compose logs sonarqube

# Increase memory limits (if needed)
# Add to docker-compose.yml under sonarqube:
environment:
  - SONAR_JAVA_OPTS=-Xmx512m -Xms128m
```

### Issue 2: Scanner Fails

```bash
# Check Node.js version
node --version  # Should be v20+

# Reinstall scanner
npm install --save-dev sonarqube-scanner

# Clear cache
rm -rf .sonarqube/cache
```

### Issue 3: Coverage Not Showing

```bash
# Ensure coverage is generated
npm run test:coverage

# Check lcov file exists
ls -la coverage/lcov.info

# Verify path in sonar-project.properties
cat sonar-project.properties | grep lcov
```

---

## Quick Reference

### Common Commands

```bash
# Start SonarQube
docker compose up -d sonarqube

# Scan all services
./sonar-scan-all.sh

# Scan single service
cd order-service && npm run sonar:scan

# View SonarQube logs
docker compose logs -f sonarqube

# Stop SonarQube
docker compose stop sonarqube

# Access SonarQube
open http://localhost:9000
```

### URLs

- **SonarQube UI:** http://localhost:9000
- **API Endpoint:** http://localhost:9000/api
- **Documentation:** http://localhost:9000/documentation

---

## Summary

✅ **SonarQube Setup Complete:**
- PostgreSQL database for SonarQube
- SonarQube Community Edition
- Scanner configuration for all 4 services
- Automated scan scripts
- CI/CD integration ready
- Quality gates configured

✅ **Monitoring:**
- Code coverage per service
- Code smells and bugs
- Security vulnerabilities
- Technical debt
- Duplication analysis
- Maintainability ratings

Now you can continuously monitor code quality across all your microservices!