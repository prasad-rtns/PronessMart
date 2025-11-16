#!/bin/bash

# SonarQube Quick Start Script for PronessMart
# This script sets up SonarQube for all 4 microservices

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "============================================"
echo "  PronessMart - SonarQube Quick Setup"
echo "============================================"
echo -e "${NC}"

# Step 1: Create sonar-project.properties for each service
echo -e "${YELLOW}Step 1: Creating sonar-project.properties files...${NC}"

create_sonar_config() {
    SERVICE_NAME=$1
    SERVICE_KEY=$2
    SERVICE_DIR=$3
    
    cat > ../${SERVICE_DIR}/sonar-project.properties <<EOF
# Project identification
sonar.projectKey=pronessmart-${SERVICE_KEY}
sonar.projectName=PronessMart ${SERVICE_NAME}
sonar.projectVersion=1.0.0

# Source code location
sonar.sources=src
sonar.tests=tests

# Exclusions
sonar.exclusions=**/node_modules/**,**/coverage/**,**/dist/**,**/*.test.js,**/*.spec.js,**/build/**

# Test coverage
sonar.javascript.lcov.reportPaths=coverage/lcov.info

# Code analysis
sonar.sourceEncoding=UTF-8
sonar.language=js

# Additional paths for specific services
EOF

    # Add helpers and middlewares for order service
    if [ "$SERVICE_KEY" == "order-service" ]; then
        echo "sonar.sources=src,helpers,middlewares" >> ../${SERVICE_DIR}/sonar-project.properties
    fi
    
    echo -e "${GREEN}✓ Created ${SERVICE_DIR}/sonar-project.properties${NC}"
}

create_sonar_config "User Service" "user-service" "user-service"
create_sonar_config "Product Service" "product-service" "product-service"
create_sonar_config "Cart Service" "cart-service" "cart-service"
create_sonar_config "Order Service" "order-service" "order-service"

echo ""

# Step 2: Update package.json for each service
echo -e "${YELLOW}Step 2: Adding sonar scripts to package.json...${NC}"

add_sonar_scripts() {
    SERVICE_DIR=$1
    
    cd ../${SERVICE_DIR}
    
    # Install sonarqube-scanner if not present
    if ! grep -q "sonarqube-scanner" package.json; then
        npm install --save-dev sonarqube-scanner
    fi
    
    # Add scripts using npm pkg command (Node 16+)
    npm pkg set scripts.test:coverage="jest --coverage --coverageReporters=lcov"
    npm pkg set scripts.sonar="sonar-scanner"
    npm pkg set scripts.sonar:scan="npm run test:coverage && sonar-scanner"
    
    cd ..
    echo -e "${GREEN}✓ Updated ../${SERVICE_DIR}/package.json${NC}"
}

add_sonar_scripts "user-service"
add_sonar_scripts "product-service"
add_sonar_scripts "cart-service"
add_sonar_scripts "order-service"

echo ""

# Step 3: Create .gitignore entries
echo -e "${YELLOW}Step 3: Updating .gitignore...${NC}"

if ! grep -q ".sonarqube/" .gitignore 2>/dev/null; then
    cat >> .gitignore <<EOF

# SonarQube
.sonarqube/
.scannerwork/
coverage/
test-report.xml
EOF
    echo -e "${GREEN}✓ Updated .gitignore${NC}"
else
    echo -e "${GREEN}✓ .gitignore already contains SonarQube entries${NC}"
fi

echo ""

# Step 4: Start SonarQube
echo -e "${YELLOW}Step 4: Starting SonarQube...${NC}"
docker compose up -d sonarqube sonarqube-db

echo -e "${GREEN}✓ SonarQube containers started${NC}"
echo ""

# Step 5: Wait for SonarQube to be ready
echo -e "${YELLOW}Step 5: Waiting for SonarQube to be ready...${NC}"
echo "This may take 2-3 minutes..."

counter=0
max_attempts=60
while [ $counter -lt $max_attempts ]; do
    if curl -s http://localhost:9000/api/system/status | grep -q "UP"; then
        echo -e "${GREEN}✓ SonarQube is ready!${NC}"
        break
    fi
    echo -n "."
    sleep 5
    counter=$((counter + 1))
done

if [ $counter -eq $max_attempts ]; then
    echo -e "${RED}✗ SonarQube failed to start in time${NC}"
    echo "Check logs: docker compose logs sonarqube"
    exit 1
fi

echo ""

# Step 6: Instructions for user
echo -e "${BLUE}"
echo "============================================"
echo "  SonarQube Setup Complete!"
echo "============================================"
echo -e "${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Access SonarQube:"
echo -e "   ${GREEN}http://localhost:9000${NC}"
echo ""
echo "2. Login with default credentials:"
echo "   Username: admin"
echo "   Password: admin"
echo "   (You'll be prompted to change the password)"
echo ""
echo "3. Generate a token:"
echo "   - Click on your profile (top right)"
echo "   - Go to 'My Account' → 'Security'"
echo "   - Generate Token: 'pronessmart-scanner'"
echo "   - Copy the token"
echo ""
echo "4. Set the token in your environment:"
echo "   export SONAR_TOKEN=<your-token>"
echo ""
echo "5. Run analysis on all services:"
echo "   ./sonar-scan-all.sh"
echo ""
echo "Or scan individual services:"
echo "   cd user-service && npm run sonar:scan"
echo "   cd product-service && npm run sonar:scan"
echo "   cd cart-service && npm run sonar:scan"
echo "   cd order-service && npm run sonar:scan"
echo ""
echo -e "${BLUE}============================================${NC}"
echo ""