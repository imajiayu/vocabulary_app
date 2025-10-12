#!/bin/bash

# IELTS Vocabulary App - Installation Script
# This script automates the setup process for the application

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)

print_info "Starting IELTS Vocabulary App setup..."
print_info "Detected OS: $OS"
echo ""

# Check prerequisites
print_info "Checking prerequisites..."

if ! command_exists python3; then
    print_error "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
print_success "Python $PYTHON_VERSION found"

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 16.x or higher."
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js $NODE_VERSION found"

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm."
    exit 1
fi

NPM_VERSION=$(npm --version)
print_success "npm $NPM_VERSION found"

if ! command_exists git; then
    print_error "Git is not installed. Please install Git."
    exit 1
fi

print_success "Git found"

if ! command_exists cmake; then
    print_warning "CMake is not installed. It's required for building Whisper.cpp."
    if [[ "$OS" == "macos" ]]; then
        print_info "You can install it with: brew install cmake"
    elif [[ "$OS" == "linux" ]]; then
        print_info "You can install it with: sudo apt-get install cmake (Ubuntu/Debian) or sudo yum install cmake (CentOS/RHEL)"
    fi
    read -p "Do you want to continue without CMake? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    SKIP_WHISPER=true
else
    print_success "CMake found"
    SKIP_WHISPER=false
fi

echo ""

# Step 1: Python Backend Setup
print_info "Step 1/5: Setting up Python backend..."

if [ ! -d ".venv" ]; then
    print_info "Creating Python virtual environment..."
    python3 -m venv .venv
    print_success "Virtual environment created"
else
    print_warning "Virtual environment already exists, skipping creation"
fi

print_info "Activating virtual environment and installing dependencies..."
source .venv/bin/activate

print_info "Upgrading pip..."
pip install --upgrade pip > /dev/null 2>&1

print_info "Installing Python dependencies from web_app/requirements.txt..."
pip install -r web_app/requirements.txt

print_success "Python backend setup completed"
echo ""

# Step 2: Frontend Setup
print_info "Step 2/5: Setting up Vue.js frontend..."

cd vue_project

if [ -d "node_modules" ]; then
    print_warning "node_modules already exists. Do you want to reinstall? (y/n)"
    read -p "" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Removing existing node_modules..."
        rm -rf node_modules package-lock.json
    fi
fi

print_info "Installing Node.js dependencies..."
npm install

print_success "Frontend setup completed"

cd ..
echo ""

# Step 3: Whisper.cpp Setup
if [ "$SKIP_WHISPER" = false ]; then
    print_info "Step 3/5: Setting up Whisper.cpp..."

    if [ ! -d "whisper.cpp" ]; then
        print_info "Cloning Whisper.cpp repository..."
        git clone https://github.com/ggml-org/whisper.cpp.git
        print_success "Whisper.cpp cloned"
    else
        print_warning "Whisper.cpp directory already exists, skipping clone"
    fi

    cd whisper.cpp

    # Step 4: Download Whisper Models
    print_info "Step 4/5: Downloading Whisper models..."

    if [ ! -f "models/ggml-small.bin" ]; then
        print_info "Downloading small model (~465MB, this may take a few minutes)..."
        bash ./models/download-ggml-model.sh small
        print_success "Whisper small model downloaded"
    else
        print_warning "Whisper small model already exists, skipping download"
    fi

    # Step 5: Build Whisper.cpp
    print_info "Step 5/5: Building Whisper.cpp..."

    if [ -d "build" ]; then
        print_warning "Build directory exists. Do you want to rebuild? (y/n)"
        read -p "" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cleaning build directory..."
            rm -rf build
        fi
    fi

    if [ ! -d "build" ]; then
        print_info "Creating build directory..."
        mkdir build
        cd build

        print_info "Running CMake..."
        cmake .. -DCMAKE_BUILD_TYPE=Release

        print_info "Building Whisper.cpp (this may take several minutes)..."
        cmake --build . --config Release

        print_success "Whisper.cpp build completed"

        # Verify binaries
        print_info "Verifying built binaries..."
        if [ -f "bin/whisper-cli" ]; then
            print_success "whisper-cli built successfully"
        else
            print_warning "whisper-cli not found in build/bin/"
        fi

        if [ -f "bin/whisper-stream" ]; then
            print_success "whisper-stream built successfully"
        fi

        # Check for custom stream_stdin if it exists
        if [ -f "../examples/stream/stream_stdin.cpp" ]; then
            if [ -f "bin/whisper-stream-stdin" ]; then
                print_success "whisper-stream-stdin built successfully"
            else
                print_info "whisper-stream-stdin not found (may need custom build)"
            fi
        fi

        cd ..
    else
        print_warning "Build directory exists and rebuild was skipped"
    fi

    cd ..
else
    print_warning "Step 3/5: Skipping Whisper.cpp setup (CMake not available)"
    print_warning "Step 4/5: Skipping model download"
    print_warning "Step 5/5: Skipping Whisper.cpp build"
fi

echo ""

# Final verification
print_info "Setup completed! Verifying installation..."
echo ""

# Check Python packages
print_info "Python packages installed:"
source .venv/bin/activate
pip list | grep -E "(Flask|SQLAlchemy|beautifulsoup4|requests)" || true

# Check Node packages
print_info "Node.js packages installed:"
cd vue_project
npm list --depth=0 2>/dev/null | grep -E "(vue|vite|typescript)" || true
cd ..

# Check Whisper
if [ "$SKIP_WHISPER" = false ]; then
    if [ -f "whisper.cpp/models/ggml-small.bin" ]; then
        MODEL_SIZE=$(ls -lh whisper.cpp/models/ggml-small.bin | awk '{print $5}')
        print_success "Whisper model found (size: $MODEL_SIZE)"
    fi

    if [ -f "whisper.cpp/build/bin/whisper-cli" ]; then
        print_success "Whisper binaries ready"
    fi
fi

echo ""
print_success "============================================"
print_success "Installation completed successfully!"
print_success "============================================"
echo ""

print_info "Next steps:"
echo "  1. Start the application:"
echo "     ./start.sh start"
echo ""
echo "  2. Access the application:"
echo "     Frontend: https://localhost:443 (or https://localhost:444 if port 443 is in use)"
echo "     Backend:  http://localhost:5001"
echo ""
echo "  3. Stop the application:"
echo "     ./start.sh stop"
echo ""

if [ "$SKIP_WHISPER" = true ]; then
    print_warning "Note: Whisper.cpp was not set up. Speaking features may not work."
    print_info "To set up Whisper.cpp later, install CMake and run this script again."
    echo ""
fi

print_info "For more information, see README.md"
echo ""

deactivate 2>/dev/null || true
