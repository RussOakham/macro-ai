[ ] NAME:Current Task List DESCRIPTION:Root task for conversation __NEW_AGENT__
-[ ] NAME:Phase 1: DNS Infrastructure Setup
    DESCRIPTION:Set up Route 53 hosted zone and transfer DNS management from GoDaddy to AWS
--[ ] NAME:Create Route 53 hosted zone for russoakham.dev
    DESCRIPTION:Create AWS Route 53 hosted zone and obtain nameservers for domain delegation
--[ ] NAME:Update GoDaddy nameservers to Route 53
    DESCRIPTION:Change nameservers in GoDaddy control panel to delegate DNS to Route 53
--[ ] NAME:Verify DNS propagation
    DESCRIPTION:Confirm DNS delegation is working and Route 53 is authoritative for the domain
-[ ] NAME:Phase 2: CDK Infrastructure Updates
    DESCRIPTION:Update CDK stacks to support custom domains with SSL certificates
--[ ] NAME:Update CDK context and environment variables
    DESCRIPTION:Add domain configuration to CDK context and environment variables for all environments
--[ ] NAME:Modify MacroAiPreviewStack to accept custom domain props
    DESCRIPTION:Update preview stack constructor to accept and pass custom domain configuration to networking construct
    with new subdomain structure: pr-{number}-api.macro-ai.russoakham.dev for API endpoints
--[ ] NAME:Update app.ts to pass custom domain configuration
    DESCRIPTION:Modify infrastructure/src/app.ts to pass domain configuration to preview stack
--[ ] NAME:Test CDK synthesis with custom domain
    DESCRIPTION:Run cdk synth to verify infrastructure changes compile correctly
-[ ] NAME:Phase 3: Backend API Configuration
    DESCRIPTION:Configure backend infrastructure to use custom domains with HTTPS
--[ ] NAME:Deploy updated CDK stack to create SSL certificates
    DESCRIPTION:Deploy preview stack with custom domain to trigger ACM certificate creation and DNS validation
--[ ] NAME:Update stack outputs to use HTTPS custom domain URLs
    DESCRIPTION:Modify CloudFormation outputs to return HTTPS URLs with new custom domain pattern:
    <https://pr-{number}-api.macro-ai.russoakham.dev/api> instead of ALB DNS names
--[ ] NAME:Update CORS configuration for custom domains
    DESCRIPTION:Add new custom domain origins to Express API CORS configuration:
    pr-{number}.macro-ai.russoakham.dev for frontend and pr-{number}-api.macro-ai.russoakham.dev for API
--[ ] NAME:Verify SSL certificate creation and validation
    DESCRIPTION:Confirm ACM certificates are created and DNS validation records are automatically added to Route 53
-[ ] NAME:Phase 4: Frontend Amplify Configuration
    DESCRIPTION:Set up custom domains for Amplify frontend deployments
--[ ] NAME:Configure Amplify custom domains for production
    DESCRIPTION:Set up custom domain macro-ai.russoakham.dev for production Amplify app using new frontend subdomain
    structure
--[ ] NAME:Configure Amplify custom domains for staging
    DESCRIPTION:Set up custom domain staging.macro-ai.russoakham.dev for staging Amplify app using new frontend
    subdomain structure
--[ ] NAME:Update preview deployment script for custom domains
    DESCRIPTION:Modify Amplify preview deployment to use pr-{number}.macro-ai.russoakham.dev pattern for frontend
    custom domains
--[ ] NAME:Test Amplify custom domain SSL certificate creation
    DESCRIPTION:Verify Amplify automatically creates and validates SSL certificates for custom domains
-[ ] NAME:Phase 5: GitHub Actions Integration
    DESCRIPTION:Update CI/CD workflows to use new custom domain endpoints
--[ ] NAME:Update GitHub Actions environment variable generation
    DESCRIPTION:Modify .github/actions/generate-frontend-env to use new HTTPS custom domain API endpoints with pattern:
    <https://pr-{number}-api.macro-ai.russoakham.dev/api>
--[ ] NAME:Update preview deployment workflow
    DESCRIPTION:Modify .github/workflows/deploy-preview.yml to handle custom domain resolution and validation
--[ ] NAME:Update backend resolution scripts
    DESCRIPTION:Modify apps/client-ui/scripts/resolve-backend-api.sh to construct custom domain URLs using new pattern:
    pr-{number}-api.macro-ai.russoakham.dev
--[ ] NAME:Test GitHub Actions workflow with custom domains
    DESCRIPTION:Run preview deployment workflow to verify custom domain integration works end-to-end
-[ ] NAME:Phase 6: Testing & Verification
    DESCRIPTION:Comprehensive testing of the new custom domain setup
--[ ] NAME:Test mixed content resolution
    DESCRIPTION:Verify HTTPS frontend (pr-{number}.macro-ai.russoakham.dev) can successfully communicate with HTTPS backend
    (pr-{number}-api.macro-ai.russoakham.dev) without browser security warnings
--[ ] NAME:Test SSL certificate functionality
    DESCRIPTION:Verify SSL certificates are working correctly for all custom domains: *.macro-ai.russoakham.dev wildcard
    certificate covering both frontend and API subdomains
--[ ] NAME:Test preview environment creation and teardown
    DESCRIPTION:Create and destroy preview environments to verify custom domain lifecycle management
--[ ] NAME:Performance and security testing
    DESCRIPTION:Test API response times and security headers with new custom domain setup
-[ ] NAME:Phase 7: Documentation & Rollback Procedures
    DESCRIPTION:Document the implementation and create rollback procedures
--[ ] NAME:Create implementation documentation
    DESCRIPTION:Document the custom domain setup process, configuration details, and troubleshooting guide
--[ ] NAME:Create rollback procedures
    DESCRIPTION:Document step-by-step rollback procedures to revert to HTTP-only setup if issues occur
--[ ] NAME:Update development environment documentation
    DESCRIPTION:Update local development setup instructions to work with new custom domain configuration
