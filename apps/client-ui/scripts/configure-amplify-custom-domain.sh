#!/bin/bash

# Configure Amplify Custom Domain
# Sets up custom domains for Amplify applications with SSL certificates

set -Eeuo pipefail
IFS=$'\n\t'

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m' # No Color

# Configuration
AMPLIFY_APP_ID=${AMPLIFY_APP_ID:-""}
CUSTOM_DOMAIN_NAME=${CUSTOM_DOMAIN_NAME:-""}
HOSTED_ZONE_ID=${HOSTED_ZONE_ID:-""}
ENVIRONMENT=${ENVIRONMENT:-"production"}
BRANCH_NAME=${BRANCH_NAME:-"main"}
DRY_RUN=${DRY_RUN:-"false"}
FORCE=${FORCE:-"false"}
WAIT_FOR_VERIFICATION=${WAIT_FOR_VERIFICATION:-"true"}

# Script directory
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Function to print status messages
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# Function to show usage
show_usage() {
    cat << EOF
Configure Amplify Custom Domain

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --app-id APP_ID              Amplify application ID
    --domain DOMAIN              Custom domain name (e.g., macro-ai.russoakham.dev)
    --hosted-zone-id ZONE_ID     Route 53 hosted zone ID
    --environment ENV            Environment name (default: production)
    --branch BRANCH              Branch name (default: main)
    --dry-run                    Show what would be done without making changes
    --force                      Force domain configuration even if already exists
    --no-wait                    Don't wait for SSL certificate verification
    --help                       Show this help message

ENVIRONMENT VARIABLES:
    AMPLIFY_APP_ID              Amplify application ID
    CUSTOM_DOMAIN_NAME          Custom domain name
    HOSTED_ZONE_ID              Route 53 hosted zone ID
    ENVIRONMENT                 Environment name
    BRANCH_NAME                 Branch name
    DRY_RUN                     Set to 'true' for dry run mode
    FORCE                       Set to 'true' to force configuration
    WAIT_FOR_VERIFICATION       Set to 'false' to skip waiting

EXAMPLES:
    # Configure production domain
    $0 --app-id d1234567890 --domain macro-ai.russoakham.dev --hosted-zone-id Z1234567890ABC

    # Configure staging subdomain
    $0 --app-id d1234567890 --domain staging.macro-ai.russoakham.dev --hosted-zone-id Z1234567890ABC --environment staging --branch staging

    # Preview environment (PR-specific subdomain)
    $0 --app-id d1234567890 --domain pr-123.macro-ai.russoakham.dev --hosted-zone-id Z1234567890ABC --environment preview --branch feature/custom-domain

    # Dry run mode
    $0 --app-id d1234567890 --domain macro-ai.russoakham.dev --hosted-zone-id Z1234567890ABC --dry-run

EOF
}

# Function to validate prerequisites
validate_prerequisites() {
    print_info "Validating prerequisites..."

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI not found. Please install AWS CLI."
        exit 1
    fi

    # Check jq
    if ! command -v jq &> /dev/null; then
        print_error "jq not found. Please install jq."
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials not configured or invalid."
        exit 1
    fi

    print_status "Prerequisites validated"
}

# Function to validate inputs
validate_inputs() {
    print_info "Validating inputs..."

    if [[ -z "$AMPLIFY_APP_ID" ]]; then
        print_error "Amplify app ID is required. Use --app-id or set AMPLIFY_APP_ID environment variable."
        exit 1
    fi

    if [[ -z "$CUSTOM_DOMAIN_NAME" ]]; then
        print_error "Custom domain name is required. Use --domain or set CUSTOM_DOMAIN_NAME environment variable."
        exit 1
    fi

    if [[ -z "$HOSTED_ZONE_ID" ]]; then
        print_error "Hosted zone ID is required. Use --hosted-zone-id or set HOSTED_ZONE_ID environment variable."
        exit 1
    fi

    # Debug: Show input parameters
    print_info "Validating input parameters:"
    print_info "  App ID: $AMPLIFY_APP_ID"
    print_info "  Domain: $CUSTOM_DOMAIN_NAME"
    print_info "  Hosted Zone: $HOSTED_ZONE_ID"
    print_info "  Environment: $ENVIRONMENT"
    print_info "  Branch: $BRANCH_NAME"

    # Validate domain format (supports multi-level subdomains)
    # Pattern: subdomain.domain.tld or subdomain.subdomain.domain.tld etc.
    # Examples: example.com, sub.example.com, pr-123.macro-ai.russoakham.dev
    if [[ ! "$CUSTOM_DOMAIN_NAME" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$ ]]; then
        print_error "Invalid domain format: $CUSTOM_DOMAIN_NAME"
        print_error "Expected format: domain.tld or subdomain.domain.tld (e.g., example.com, pr-123.macro-ai.russoakham.dev)"
        exit 1
    fi

    # Parse domain to extract root domain and subdomain prefix for AWS Amplify
    # AWS Amplify expects: --domain-name "root.domain.tld" --sub-domain-settings "prefix=subdomain"
    ROOT_DOMAIN=""
    SUBDOMAIN_PREFIX=""

    # Count dots to determine if this is a subdomain
    local dot_count=$(echo "$CUSTOM_DOMAIN_NAME" | tr -cd '.' | wc -c)

    if [[ $dot_count -ge 2 ]]; then
        # Extract subdomain prefix (everything before the first dot)
        SUBDOMAIN_PREFIX=$(echo "$CUSTOM_DOMAIN_NAME" | cut -d'.' -f1)
        # Extract root domain (everything after the first dot)
        ROOT_DOMAIN=$(echo "$CUSTOM_DOMAIN_NAME" | cut -d'.' -f2-)

        print_info "Parsed domain components:"
        print_info "  Root domain: $ROOT_DOMAIN"
        print_info "  Subdomain prefix: $SUBDOMAIN_PREFIX"
    else
        # This is already a root domain
        ROOT_DOMAIN="$CUSTOM_DOMAIN_NAME"
        SUBDOMAIN_PREFIX=""

        print_info "Using root domain without subdomain: $ROOT_DOMAIN"
    fi

    # Validate Amplify app exists
    if ! aws amplify get-app --app-id "$AMPLIFY_APP_ID" &> /dev/null; then
        print_error "Amplify app not found: $AMPLIFY_APP_ID"
        exit 1
    fi

    # Validate hosted zone exists
    print_info "Validating hosted zone access..."
    local zone_validation_result
    zone_validation_result=$(aws route53 get-hosted-zone --id "$HOSTED_ZONE_ID" 2>&1)
    local zone_validation_exit_code=$?

    if [[ $zone_validation_exit_code -ne 0 ]]; then
        print_error "Hosted zone validation failed: $HOSTED_ZONE_ID"
        print_error "AWS CLI Error: $zone_validation_result"

        # Check if it's a permissions issue
        if echo "$zone_validation_result" | grep -q "AccessDenied\|UnauthorizedOperation\|Forbidden"; then
            print_error "This appears to be a permissions issue. Required permissions:"
            print_error "  - route53:GetHostedZone"
            print_error "  - route53:ListHostedZones (optional, for debugging)"
            print_error ""
            print_error "Please ensure the GitHub Actions IAM role has Route53 permissions."
        elif echo "$zone_validation_result" | grep -q "NoSuchHostedZone"; then
            print_error "The hosted zone ID does not exist or is not accessible."
            print_error "Please verify the hosted zone ID is correct: $HOSTED_ZONE_ID"
        fi

        exit 1
    fi

    # Extract zone name for verification
    local zone_name
    zone_name=$(echo "$zone_validation_result" | jq -r '.HostedZone.Name // empty' 2>/dev/null || echo "")
    if [[ -n "$zone_name" ]]; then
        # Remove trailing dot from zone name
        zone_name=${zone_name%.}
        print_info "✅ Hosted zone validated: $zone_name (ID: $HOSTED_ZONE_ID)"

        # Verify the zone name is compatible with our root domain
        # The root domain should either match the zone exactly or be a subdomain of the zone
        if [[ "$zone_name" == "$ROOT_DOMAIN" ]]; then
            print_info "✅ Zone name matches root domain exactly"
        elif [[ "$ROOT_DOMAIN" == *".$zone_name" ]]; then
            print_info "✅ Root domain ($ROOT_DOMAIN) is a valid subdomain of zone ($zone_name)"
        else
            print_warning "⚠️  Zone name ($zone_name) may not be compatible with root domain ($ROOT_DOMAIN)"
            print_warning "Expected: $ROOT_DOMAIN should end with .$zone_name"
            print_warning "This may cause domain association issues."
        fi
    else
        print_info "✅ Hosted zone access confirmed (ID: $HOSTED_ZONE_ID)"
    fi

    print_status "Inputs validated"
}

# Function to check if domain is already configured
check_existing_domain() {
    print_info "Checking for existing domain configuration..."

    local existing_domains
    existing_domains=$(aws amplify list-domain-associations --app-id "$AMPLIFY_APP_ID" --query 'domainAssociations[].domainName' --output text 2>/dev/null || echo "")

    if [[ -n "$existing_domains" ]] && echo "$existing_domains" | grep -q "$ROOT_DOMAIN"; then
        if [[ "$FORCE" == "true" ]]; then
            print_warning "Domain already configured but --force specified. Will reconfigure."
            return 0
        else
            # Check if the domain is properly configured for our subdomain
            print_info "Domain already configured: $CUSTOM_DOMAIN_NAME"
            print_info "Checking if subdomain configuration is correct..."

            # Get detailed domain association info
            local domain_status
            domain_status=$(aws amplify get-domain-association --app-id "$AMPLIFY_APP_ID" --domain-name "$ROOT_DOMAIN" --query 'domainAssociation.domainStatus' --output text 2>/dev/null || echo "UNKNOWN")

            if [[ "$domain_status" == "AVAILABLE" ]]; then
                print_success "✅ Domain is properly configured and available"
                print_info "🌐 Custom domain URL: https://${CUSTOM_DOMAIN_NAME}/"
                return 0  # Success - domain is already properly configured
            else
                print_warning "⚠️ Domain exists but status is: $domain_status"
                print_info "Use --force to reconfigure existing domain"
                return 1  # Domain exists but not properly configured
            fi
        fi
    fi

    print_status "No existing domain configuration found"
    return 0  # Continue with domain configuration
}

# Function to configure custom domain
configure_domain() {
    print_header "Configuring Custom Domain"
    print_info "Domain: $CUSTOM_DOMAIN_NAME"
    print_info "App ID: $AMPLIFY_APP_ID"
    print_info "Environment: $ENVIRONMENT"
    print_info "Branch: $BRANCH_NAME"

    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "DRY RUN MODE - No changes will be made"
        print_info "Would configure domain: $CUSTOM_DOMAIN_NAME"
        print_info "Would associate with branch: $BRANCH_NAME"
        return 0
    fi

    # Create domain association
    print_info "Creating domain association..."
    print_info "  Using root domain: $ROOT_DOMAIN"
    print_info "  Using subdomain prefix: $SUBDOMAIN_PREFIX"
    print_info "  Branch: $BRANCH_NAME"

    local domain_result
    domain_result=$(aws amplify create-domain-association \
        --app-id "$AMPLIFY_APP_ID" \
        --domain-name "$ROOT_DOMAIN" \
        --sub-domain-settings "prefix=$SUBDOMAIN_PREFIX,branchName=$BRANCH_NAME" \
        --auto-sub-domain-creation-patterns "*" \
        --enable-auto-sub-domain \
        --output json 2>/dev/null || echo "")

    if [[ -z "$domain_result" ]]; then
        print_error "Failed to create domain association"
        exit 1
    fi

    print_status "Domain association created successfully"

    # Extract certificate verification record
    local cert_verification_record
    cert_verification_record=$(echo "$domain_result" | jq -r '.domainAssociation.certificateVerificationDNSRecord // empty')

    if [[ -n "$cert_verification_record" ]]; then
        print_info "SSL certificate verification record required:"
        print_info "$cert_verification_record"

        # Parse the DNS record components
        local record_name record_value
        record_name=$(echo "$cert_verification_record" | awk '{print $1}')
        record_value=$(echo "$cert_verification_record" | awk '{print $3}')

        if [[ -n "$record_name" && -n "$record_value" ]]; then
            print_info "Creating DNS validation record in Route53..."

            if [[ "$DRY_RUN" == "true" ]]; then
                print_info "[DRY RUN] Would create DNS record:"
                print_info "  Name: $record_name"
                print_info "  Type: CNAME"
                print_info "  Value: $record_value"
                print_info "  Hosted Zone: $HOSTED_ZONE_ID"
            else
                # Create the DNS validation record
                local change_result
                change_result=$(aws route53 change-resource-record-sets \
                    --hosted-zone-id "$HOSTED_ZONE_ID" \
                    --change-batch "{
                        \"Changes\": [
                            {
                                \"Action\": \"UPSERT\",
                                \"ResourceRecordSet\": {
                                    \"Name\": \"$record_name\",
                                    \"Type\": \"CNAME\",
                                    \"TTL\": 300,
                                    \"ResourceRecords\": [
                                        {
                                            \"Value\": \"$record_value\"
                                        }
                                    ]
                                }
                            }
                        ]
                    }" 2>&1)

                if [[ $? -eq 0 ]]; then
                    print_status "✅ DNS validation record created successfully"

                    # Extract change ID for monitoring
                    local change_id
                    change_id=$(echo "$change_result" | jq -r '.ChangeInfo.Id // empty')

                    if [[ -n "$change_id" ]]; then
                        print_info "DNS change ID: $change_id"
                        print_info "Waiting for DNS propagation..."

                        # Wait for DNS change to propagate
                        local dns_wait_attempts=0
                        local max_dns_wait=30

                        while [[ $dns_wait_attempts -lt $max_dns_wait ]]; do
                            local change_status
                            change_status=$(aws route53 get-change --id "$change_id" --query 'ChangeInfo.Status' --output text 2>/dev/null)

                            if [[ "$change_status" == "INSYNC" ]]; then
                                print_status "✅ DNS change propagated successfully"
                                break
                            fi

                            ((dns_wait_attempts++))
                            print_info "DNS propagation in progress... (attempt $dns_wait_attempts/$max_dns_wait)"
                            sleep 2
                        done

                        if [[ $dns_wait_attempts -ge $max_dns_wait ]]; then
                            print_warning "DNS propagation taking longer than expected, but continuing..."
                        fi
                    fi
                else
                    print_warning "Failed to create DNS validation record:"
                    print_warning "$change_result"
                    print_warning "Domain verification may require manual DNS record creation"
                fi
            fi
        else
            print_warning "Could not parse DNS validation record format"
            print_warning "Raw record: $cert_verification_record"
        fi
    fi

    return 0
}

# Function to create subdomain CNAME record
create_subdomain_cname() {
    local app_id="$1"
    local domain_name="$2"

    print_info "Checking for required subdomain CNAME record..."

    # Get the current domain association to check subdomain DNS record
    local domain_result
    domain_result=$(aws amplify get-domain-association \
        --app-id "$app_id" \
        --domain-name "$domain_name" 2>&1)

    if [[ $? -ne 0 ]]; then
        print_warning "Could not retrieve domain association for CNAME check"
        return 0
    fi

    # Extract subdomain DNS record
    local subdomain_dns_record
    subdomain_dns_record=$(echo "$domain_result" | jq -r '.domainAssociation.subDomains[0].dnsRecord // empty')

    if [[ -n "$subdomain_dns_record" && "$subdomain_dns_record" != "null" && "$subdomain_dns_record" != *"<pending>"* ]]; then
        print_info "Subdomain DNS record required: $subdomain_dns_record"

        # Parse the DNS record components (format: "prefix CNAME target")
        local subdomain_name cname_target
        subdomain_name=$(echo "$subdomain_dns_record" | awk '{print $1}')
        cname_target=$(echo "$subdomain_dns_record" | awk '{print $3}')

        if [[ -n "$subdomain_name" && -n "$cname_target" ]]; then
            local full_subdomain_name="${subdomain_name}.${domain_name}"

            if [[ "$DRY_RUN" == "true" ]]; then
                print_info "[DRY RUN] Would create subdomain CNAME record:"
                print_info "  Name: $full_subdomain_name"
                print_info "  Type: CNAME"
                print_info "  Value: $cname_target"
                print_info "  Hosted Zone: $HOSTED_ZONE_ID"
            else
                print_info "Creating subdomain CNAME record: $full_subdomain_name -> $cname_target"

                local change_result
                change_result=$(aws route53 change-resource-record-sets \
                    --hosted-zone-id "$HOSTED_ZONE_ID" \
                    --change-batch "{
                        \"Changes\": [
                            {
                                \"Action\": \"UPSERT\",
                                \"ResourceRecordSet\": {
                                    \"Name\": \"$full_subdomain_name\",
                                    \"Type\": \"CNAME\",
                                    \"TTL\": 300,
                                    \"ResourceRecords\": [
                                        {
                                            \"Value\": \"$cname_target\"
                                        }
                                    ]
                                }
                            }
                        ]
                    }" 2>&1)

                if [[ $? -eq 0 ]]; then
                    print_status "✅ Subdomain CNAME record created successfully"

                    # Wait for DNS propagation
                    local change_id
                    change_id=$(echo "$change_result" | jq -r '.ChangeInfo.Id // empty')

                    if [[ -n "$change_id" ]]; then
                        print_info "Waiting for subdomain DNS propagation..."
                        local dns_wait_attempts=0
                        local max_dns_wait=30

                        while [[ $dns_wait_attempts -lt $max_dns_wait ]]; do
                            local change_status
                            change_status=$(aws route53 get-change --id "$change_id" --query 'ChangeInfo.Status' --output text 2>/dev/null)

                            if [[ "$change_status" == "INSYNC" ]]; then
                                print_status "✅ Subdomain DNS propagated successfully"
                                break
                            fi

                            ((dns_wait_attempts++))
                            print_info "Subdomain DNS propagation in progress... (attempt $dns_wait_attempts/$max_dns_wait)"
                            sleep 2
                        done
                    fi
                else
                    print_warning "Failed to create subdomain CNAME record:"
                    print_warning "$change_result"
                fi
            fi
        else
            print_warning "Could not parse subdomain DNS record format: $subdomain_dns_record"
        fi
    else
        print_info "No subdomain CNAME record needed yet (status: pending or not available)"
    fi
}

# Function to handle failed domain associations
handle_failed_domain_association() {
    local app_id="$1"
    local domain_name="$2"

    print_info "Checking domain association status..."

    local domain_result
    domain_result=$(aws amplify get-domain-association \
        --app-id "$app_id" \
        --domain-name "$domain_name" 2>&1)

    if [[ $? -eq 0 ]]; then
        local domain_status
        domain_status=$(echo "$domain_result" | jq -r '.domainAssociation.domainStatus // empty')

        if [[ "$domain_status" == "FAILED" ]]; then
            print_warning "Domain association is in FAILED state. Attempting to recreate..."

            if [[ "$DRY_RUN" == "true" ]]; then
                print_info "[DRY RUN] Would delete and recreate domain association"
                return 0
            fi

            # Delete the failed domain association
            print_info "Deleting failed domain association..."
            aws amplify delete-domain-association \
                --app-id "$app_id" \
                --domain-name "$domain_name" >/dev/null 2>&1

            # Wait a moment for deletion to complete
            sleep 5

            # Recreate the domain association
            print_info "Recreating domain association..."
            local create_result
            create_result=$(aws amplify create-domain-association \
                --app-id "$app_id" \
                --domain-name "$domain_name" \
                --enable-auto-sub-domain \
                --auto-sub-domain-creation-patterns "*" \
                --sub-domain-settings "prefix=$SUBDOMAIN_PREFIX,branchName=$BRANCH_NAME" 2>&1)

            if [[ $? -eq 0 ]]; then
                print_status "✅ Domain association recreated successfully"
                return 0
            else
                print_error "Failed to recreate domain association:"
                print_error "$create_result"
                return 1
            fi
        else
            print_info "Domain association status: $domain_status"
        fi
    fi

    return 0
}

# Function to wait for domain verification
wait_for_verification() {
    if [[ "$WAIT_FOR_VERIFICATION" != "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi

    print_info "Waiting for SSL certificate verification..."
    print_info "This may take several minutes (typically 2-10 minutes for first-time setup)..."
    print_info "Future deployments will be much faster as they reuse existing validation"

    local max_attempts=60
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        local domain_status
        domain_status=$(aws amplify get-domain-association \
            --app-id "$AMPLIFY_APP_ID" \
            --domain-name "$ROOT_DOMAIN" \
            --query 'domainAssociation.domainStatus' \
            --output text 2>/dev/null || echo "UNKNOWN")

        case "$domain_status" in
            "AVAILABLE")
                print_status "Domain verification completed successfully!"
                return 0
                ;;
            "PENDING_VERIFICATION"|"PENDING_DEPLOYMENT")
                print_info "Verification in progress... (attempt $attempt/$max_attempts)"
                ;;
            "FAILED")
                print_error "Domain verification failed"
                return 1
                ;;
            *)
                print_warning "Unknown domain status: $domain_status"
                ;;
        esac

        sleep 30
        ((attempt++))
    done

    print_warning "Verification timeout reached. Domain may still be processing."
    print_info "Check Amplify console for current status."
    return 0
}

# Function to display results
display_results() {
    print_header "Configuration Results"

    if [[ "$DRY_RUN" == "true" ]]; then
        print_info "Dry run completed - no changes made"
        return 0
    fi

    # Get domain association details
    local domain_info
    domain_info=$(aws amplify get-domain-association \
        --app-id "$AMPLIFY_APP_ID" \
        --domain-name "$ROOT_DOMAIN" \
        --output json 2>/dev/null || echo "{}")

    if [[ "$domain_info" != "{}" ]]; then
        local domain_status
        local certificate_arn
        domain_status=$(echo "$domain_info" | jq -r '.domainAssociation.domainStatus // "UNKNOWN"')
        certificate_arn=$(echo "$domain_info" | jq -r '.domainAssociation.certificateArn // "Not available"')

        print_status "Domain: $CUSTOM_DOMAIN_NAME"
        print_status "Status: $domain_status"
        print_status "Certificate ARN: $certificate_arn"

        if [[ "$domain_status" == "AVAILABLE" ]]; then
            print_status "✅ Custom domain is ready!"
            print_info "Your application is now accessible at: https://$CUSTOM_DOMAIN_NAME"
        else
            print_info "Domain is still being configured. Check Amplify console for updates."
        fi
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --app-id)
            AMPLIFY_APP_ID="$2"
            shift 2
            ;;
        --domain)
            CUSTOM_DOMAIN_NAME="$2"
            shift 2
            ;;
        --hosted-zone-id)
            HOSTED_ZONE_ID="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --branch)
            BRANCH_NAME="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --no-wait)
            WAIT_FOR_VERIFICATION="false"
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_header "🌐 Amplify Custom Domain Configuration"

    validate_prerequisites
    validate_inputs

    # Check if domain already exists and is properly configured
    if check_existing_domain; then
        # Check if we found an existing domain that's properly configured
        local existing_domains
        existing_domains=$(aws amplify list-domain-associations --app-id "$AMPLIFY_APP_ID" --query 'domainAssociations[].domainName' --output text 2>/dev/null || echo "")

        if [[ -n "$existing_domains" ]] && echo "$existing_domains" | grep -q "$ROOT_DOMAIN"; then
            # Domain exists and is properly configured, exit successfully
            print_success "✅ Custom domain configuration already complete!"
            print_info "🌐 Custom Domain URL: https://${CUSTOM_DOMAIN_NAME}/"
            return 0
        fi
        # Domain doesn't exist, continue with configuration
    else
        # Domain exists but not properly configured
        print_error "❌ Domain exists but is not properly configured"
        print_info "Use --force to reconfigure existing domain"
        exit 1
    fi

    configure_domain

    # Wait a moment for domain association to be created before checking status
    if [[ "$DRY_RUN" != "true" ]]; then
        print_info "Waiting for domain association to initialize..."
        sleep 10
    fi

    # Handle any failed domain associations by recreating them
    handle_failed_domain_association "$APP_ID" "$ROOT_DOMAIN"

    # Create subdomain CNAME record if needed
    create_subdomain_cname "$APP_ID" "$ROOT_DOMAIN"

    wait_for_verification
    display_results

    print_status "Custom domain configuration completed!"
}

# Run main function
main "$@"
