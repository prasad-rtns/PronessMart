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