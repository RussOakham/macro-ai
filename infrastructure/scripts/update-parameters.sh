#!/bin/bash

# Macro AI Parameter Store Update Script
# This script helps update Parameter Store values after infrastructure deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${CDK_DEPLOY_ENV:-hobby}
AWS_REGION=${AWS_REGION:-us-east-1}
PARAMETER_PREFIX="/macro-ai/$ENVIRONMENT"

echo -e "${BLUE}🔧 Macro AI Parameter Store Update${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Region: $AWS_REGION${NC}"
echo -e "${BLUE}Parameter Prefix: $PARAMETER_PREFIX${NC}"
echo ""

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to update a parameter
update_parameter() {
    local param_name="$1"
    local param_type="$2"
    local description="$3"
    local current_value
    
    echo -e "${BLUE}📝 Updating parameter: $param_name${NC}"
    echo "Description: $description"
    
    # Get current value (if exists)
    if current_value=$(aws ssm get-parameter --name "$param_name" --query 'Parameter.Value' --output text 2>/dev/null); then
        if [ "$current_value" != "PLACEHOLDER_VALUE_UPDATE_AFTER_DEPLOYMENT" ]; then
            echo -e "${YELLOW}Current value exists (not showing for security)${NC}"
            read -p "Do you want to update this parameter? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "Skipping $param_name"
                return
            fi
        fi
    fi
    
    # Prompt for new value
    if [ "$param_type" = "SecureString" ]; then
        read -s -p "Enter new value for $param_name (input hidden): " new_value
        echo
    else
        read -p "Enter new value for $param_name: " new_value
    fi
    
    if [ -z "$new_value" ]; then
        print_warning "Empty value provided, skipping $param_name"
        return
    fi
    
    # Update the parameter
    aws ssm put-parameter \
        --name "$param_name" \
        --value "$new_value" \
        --type "$param_type" \
        --overwrite \
        --region "$AWS_REGION"
    
    print_status "Updated $param_name"
}

# Function to show current parameters
show_parameters() {
    echo -e "${BLUE}📋 Current Parameter Store values:${NC}"
    echo ""
    
    # Get all parameters under our prefix
    aws ssm get-parameters-by-path \
        --path "$PARAMETER_PREFIX" \
        --recursive \
        --query 'Parameters[*].[Name,Type,LastModifiedDate]' \
        --output table \
        --region "$AWS_REGION" 2>/dev/null || {
        print_warning "No parameters found or unable to access Parameter Store"
        return 1
    }
    echo ""
}

# Main menu
show_menu() {
    echo -e "${BLUE}🎯 What would you like to do?${NC}"
    echo "1. Update all parameters interactively"
    echo "2. Update specific parameter"
    echo "3. Show current parameters"
    echo "4. Update critical parameters only"
    echo "5. Update standard parameters only"
    echo "6. Exit"
    echo ""
}

# Update all parameters
update_all_parameters() {
    echo -e "${BLUE}🔄 Updating all parameters...${NC}"
    echo ""
    
    # Critical parameters
    echo -e "${YELLOW}=== Critical Parameters (Advanced Tier) ===${NC}"
    update_parameter "$PARAMETER_PREFIX/critical/openai-api-key" "SecureString" "OpenAI API key for AI chat functionality"
    update_parameter "$PARAMETER_PREFIX/critical/neon-database-url" "SecureString" "Neon PostgreSQL connection string"
    
    echo ""
    echo -e "${YELLOW}=== Standard Parameters ===${NC}"
    update_parameter "$PARAMETER_PREFIX/standard/upstash-redis-url" "SecureString" "Upstash Redis connection string"
    update_parameter "$PARAMETER_PREFIX/standard/cognito-user-pool-id" "String" "AWS Cognito User Pool ID"
    update_parameter "$PARAMETER_PREFIX/standard/cognito-user-pool-client-id" "String" "AWS Cognito User Pool Client ID"
    
    print_status "All parameters updated!"
}

# Update critical parameters only
update_critical_parameters() {
    echo -e "${BLUE}🔒 Updating critical parameters...${NC}"
    echo ""
    
    update_parameter "$PARAMETER_PREFIX/critical/openai-api-key" "SecureString" "OpenAI API key for AI chat functionality"
    update_parameter "$PARAMETER_PREFIX/critical/neon-database-url" "SecureString" "Neon PostgreSQL connection string"
    
    print_status "Critical parameters updated!"
}

# Update standard parameters only
update_standard_parameters() {
    echo -e "${BLUE}📊 Updating standard parameters...${NC}"
    echo ""
    
    update_parameter "$PARAMETER_PREFIX/standard/upstash-redis-url" "SecureString" "Upstash Redis connection string"
    update_parameter "$PARAMETER_PREFIX/standard/cognito-user-pool-id" "String" "AWS Cognito User Pool ID"
    update_parameter "$PARAMETER_PREFIX/standard/cognito-user-pool-client-id" "String" "AWS Cognito User Pool Client ID"
    
    print_status "Standard parameters updated!"
}

# Update specific parameter
update_specific_parameter() {
    echo -e "${BLUE}🎯 Available parameters:${NC}"
    echo "1. openai-api-key (Critical/SecureString)"
    echo "2. neon-database-url (Critical/SecureString)"
    echo "3. upstash-redis-url (Standard/SecureString)"
    echo "4. cognito-user-pool-id (Standard/String)"
    echo "5. cognito-user-pool-client-id (Standard/String)"
    echo ""
    
    read -p "Enter parameter number (1-5): " param_choice
    
    case $param_choice in
        1) update_parameter "$PARAMETER_PREFIX/critical/openai-api-key" "SecureString" "OpenAI API key for AI chat functionality" ;;
        2) update_parameter "$PARAMETER_PREFIX/critical/neon-database-url" "SecureString" "Neon PostgreSQL connection string" ;;
        3) update_parameter "$PARAMETER_PREFIX/standard/upstash-redis-url" "SecureString" "Upstash Redis connection string" ;;
        4) update_parameter "$PARAMETER_PREFIX/standard/cognito-user-pool-id" "String" "AWS Cognito User Pool ID" ;;
        5) update_parameter "$PARAMETER_PREFIX/standard/cognito-user-pool-client-id" "String" "AWS Cognito User Pool Client ID" ;;
        *) print_error "Invalid choice" ;;
    esac
}

# Check prerequisites
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Main loop
while true; do
    show_menu
    read -p "Enter your choice (1-6): " choice
    echo ""
    
    case $choice in
        1) update_all_parameters ;;
        2) update_specific_parameter ;;
        3) show_parameters ;;
        4) update_critical_parameters ;;
        5) update_standard_parameters ;;
        6) 
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please enter 1-6."
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    echo ""
done
