#!/bin/bash

# Docker Image Analysis Script
# Uses dive and other tools to analyze Docker image layers and optimize size

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="macro-ai-express-api:latest"
ANALYSIS_TYPE="all"
OUTPUT_FORMAT="table"

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Analyze Docker image for optimization opportunities

OPTIONS:
    -i, --image IMAGE_NAME         Image name to analyze [default: macro-ai-express-api:latest]
    -t, --type ANALYSIS_TYPE       Analysis type: dive, size, layers, all [default: all]
    -o, --output OUTPUT_FORMAT     Output format: table, json [default: table]
    -h, --help                     Show this help message

ANALYSIS TYPES:
    dive      - Interactive layer analysis using dive tool
    size      - Basic size analysis and comparison
    layers    - Layer-by-layer breakdown
    all       - Run all analyses

EXAMPLES:
    # Analyze latest image with dive
    $0 -i macro-ai-express-api:latest -t dive

    # Full analysis of production image
    $0 -i macro-ai-express-api:production -t all

    # Size comparison between tags
    $0 -t size

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--image)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--type)
            ANALYSIS_TYPE="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option $1"
            show_help
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🔍 Docker Image Analysis${NC}"
echo -e "${BLUE}📋 Configuration:${NC}"
echo -e "   Image: ${YELLOW}$IMAGE_NAME${NC}"
echo -e "   Analysis Type: ${YELLOW}$ANALYSIS_TYPE${NC}"
echo -e "   Output Format: ${YELLOW}$OUTPUT_FORMAT${NC}"
echo ""

# Check if image exists
if ! docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "$IMAGE_NAME"; then
    echo -e "${RED}❌ Image not found: $IMAGE_NAME${NC}"
    echo -e "${YELLOW}Available images:${NC}"
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep macro-ai || echo "No macro-ai images found"
    exit 1
fi

# Function to analyze image size
analyze_size() {
    echo -e "${BLUE}📊 Image Size Analysis${NC}"
    echo ""
    
    # Get image details
    IMAGE_SIZE=$(docker images --format "{{.Size}}" "$IMAGE_NAME")
    IMAGE_ID=$(docker images --format "{{.ID}}" "$IMAGE_NAME")
    CREATED=$(docker images --format "{{.CreatedAt}}" "$IMAGE_NAME")
    
    echo -e "Image: ${YELLOW}$IMAGE_NAME${NC}"
    echo -e "Size: ${YELLOW}$IMAGE_SIZE${NC}"
    echo -e "ID: ${YELLOW}$IMAGE_ID${NC}"
    echo -e "Created: ${YELLOW}$CREATED${NC}"
    echo ""
    
    # Compare with other tags if available
    echo -e "${BLUE}📈 Size Comparison with Other Tags:${NC}"
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep macro-ai | head -10
    echo ""
    
    # Get layer information
    echo -e "${BLUE}🍰 Layer Information:${NC}"
    docker history --no-trunc "$IMAGE_NAME" | head -20
    echo ""
}

# Function to analyze layers
analyze_layers() {
    echo -e "${BLUE}🍰 Layer Analysis${NC}"
    echo ""
    
    # Show layer sizes
    echo -e "${BLUE}Layer sizes (largest first):${NC}"
    docker history --format "table {{.Size}}\t{{.CreatedBy}}" "$IMAGE_NAME" | \
        sort -hr | head -15
    echo ""
    
    # Show layer commands
    echo -e "${BLUE}Layer commands:${NC}"
    docker history --format "table {{.Size}}\t{{.CreatedSince}}\t{{.CreatedBy}}" "$IMAGE_NAME" | head -15
    echo ""
}

# Function to run dive analysis
analyze_with_dive() {
    echo -e "${BLUE}🏊 Running Dive Analysis${NC}"
    echo ""
    
    # Check if dive is installed
    if command -v dive >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Dive found, launching interactive analysis...${NC}"
        dive "$IMAGE_NAME"
    else
        echo -e "${YELLOW}⚠️  Dive not found. Installing dive...${NC}"
        
        # Try to install dive
        if command -v brew >/dev/null 2>&1; then
            echo -e "${BLUE}Installing dive via Homebrew...${NC}"
            brew install dive
        elif command -v apt-get >/dev/null 2>&1; then
            echo -e "${BLUE}Installing dive via apt...${NC}"
            wget https://github.com/wagoodman/dive/releases/download/v0.10.0/dive_0.10.0_linux_amd64.deb
            sudo apt install ./dive_0.10.0_linux_amd64.deb
            rm dive_0.10.0_linux_amd64.deb
        elif command -v yum >/dev/null 2>&1; then
            echo -e "${BLUE}Installing dive via yum...${NC}"
            curl -OL https://github.com/wagoodman/dive/releases/download/v0.10.0/dive_0.10.0_linux_amd64.rpm
            rpm -i dive_0.10.0_linux_amd64.rpm
            rm dive_0.10.0_linux_amd64.rpm
        else
            echo -e "${RED}❌ Could not install dive automatically${NC}"
            echo -e "${YELLOW}Please install dive manually:${NC}"
            echo -e "   macOS: brew install dive"
            echo -e "   Linux: Download from https://github.com/wagoodman/dive/releases"
            echo -e "   Windows: Download from https://github.com/wagoodman/dive/releases"
            return 1
        fi
        
        # Run dive after installation
        if command -v dive >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Dive installed successfully${NC}"
            dive "$IMAGE_NAME"
        else
            echo -e "${RED}❌ Failed to install dive${NC}"
            return 1
        fi
    fi
}

# Function to generate optimization recommendations
generate_recommendations() {
    echo -e "${BLUE}💡 Optimization Recommendations${NC}"
    echo ""
    
    # Check for common optimization opportunities
    IMAGE_SIZE_MB=$(docker inspect "$IMAGE_NAME" --format='{{.Size}}' | awk '{print int($1/1024/1024)}')
    
    echo -e "${BLUE}Current image size: ${YELLOW}${IMAGE_SIZE_MB}MB${NC}"
    echo ""
    
    # Size-based recommendations
    if [ "$IMAGE_SIZE_MB" -gt 200 ]; then
        echo -e "${YELLOW}🔍 Large image detected (>${IMAGE_SIZE_MB}MB). Consider:${NC}"
        echo "   • Use multi-stage builds to exclude build dependencies"
        echo "   • Use .dockerignore to exclude unnecessary files"
        echo "   • Use alpine-based images instead of full distributions"
        echo "   • Remove package caches and temporary files"
        echo ""
    fi
    
    # Layer-based recommendations
    LAYER_COUNT=$(docker history "$IMAGE_NAME" --quiet | wc -l)
    if [ "$LAYER_COUNT" -gt 20 ]; then
        echo -e "${YELLOW}🍰 Many layers detected (${LAYER_COUNT}). Consider:${NC}"
        echo "   • Combine RUN commands to reduce layers"
        echo "   • Use BuildKit for better layer caching"
        echo "   • Order commands from least to most frequently changing"
        echo ""
    fi
    
    # Check for common inefficiencies
    echo -e "${BLUE}🔍 Checking for common inefficiencies...${NC}"
    
    # Check history for potential issues
    if docker history "$IMAGE_NAME" --no-trunc | grep -q "apt-get update"; then
        if ! docker history "$IMAGE_NAME" --no-trunc | grep -q "apt-get clean"; then
            echo -e "${YELLOW}⚠️  Found apt-get update without cleanup${NC}"
            echo "   Recommendation: Add 'apt-get clean && rm -rf /var/lib/apt/lists/*'"
        fi
    fi
    
    if docker history "$IMAGE_NAME" --no-trunc | grep -q "npm install"; then
        if ! docker history "$IMAGE_NAME" --no-trunc | grep -q "npm cache clean"; then
            echo -e "${YELLOW}⚠️  Found npm install without cache cleanup${NC}"
            echo "   Recommendation: Add 'npm cache clean --force'"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}✅ Analysis complete!${NC}"
    echo ""
    echo -e "${BLUE}📚 Additional Resources:${NC}"
    echo "   • Docker Best Practices: https://docs.docker.com/develop/dev-best-practices/"
    echo "   • Multi-stage Builds: https://docs.docker.com/develop/dev-best-practices/multistage-build/"
    echo "   • Dive Tool: https://github.com/wagoodman/dive"
}

# Run analysis based on type
case $ANALYSIS_TYPE in
    "size")
        analyze_size
        ;;
    "layers")
        analyze_layers
        ;;
    "dive")
        analyze_with_dive
        ;;
    "all")
        analyze_size
        echo ""
        analyze_layers
        echo ""
        generate_recommendations
        echo ""
        echo -e "${BLUE}🏊 For interactive layer analysis, run:${NC}"
        echo -e "${YELLOW}$0 -i $IMAGE_NAME -t dive${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid analysis type: $ANALYSIS_TYPE${NC}"
        show_help
        exit 1
        ;;
esac


