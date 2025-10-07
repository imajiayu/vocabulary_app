# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an IELTS vocabulary learning application built with Flask backend and Vue.js frontend, implementing a spaced repetition system for vocabulary memorization and speaking practice with real-time audio transcription using Whisper.cpp.

## Development Commands

### Starting the Application
```bash
# Start both backend and frontend
./start.sh start

# Stop both services
./start.sh stop
```

### Frontend Development (Vue.js)
```bash
cd vue_project
npm install                    # Install dependencies
npm run dev                    # Start development server (with HTTPS)
npm run build                  # Build for production
npm run preview                # Preview production build
npm run type-check             # TypeScript type checking
```

### Backend Development (Flask)
```bash
# Activate virtual environment (required)
source .venv/bin/activate

# Install Python dependencies
pip install -r web_app/requirements.txt

# Run backend directly
python -m web_app.app
```

### Whisper.cpp Setup
```bash
# Download AI models (if not already present)
cd whisper.cpp/models
./download-ggml-model.sh small          # Download small model (465MB)
./download-coreml-model.sh              # Download CoreML models

# Build whisper.cpp (if needed)
cd whisper.cpp
mkdir build && cd build
cmake ..
make

# Test stream_stdin (custom implementation)
./build/bin/whisper-stream-stdin --model models/ggml-small.bin
```

## Architecture

### Backend Structure (`web_app/`)
- **Flask App**: Main entry point at `app.py`, runs on port 5001
- **Database**: SQLite database (`vocabulary.db`) with SQLAlchemy ORM
  - ⚠️ `vocabulary.db` is excluded from git (see .gitignore)
  - Database schema is defined in `models/`
- **API Endpoints**:
  - `api/vocabulary.py` - Vocabulary CRUD and review endpoints
  - `api/speaking.py` - Speaking practice and recording endpoints
- **Core Logic**:
  - `core/review_repetition.py` - Spaced repetition algorithm (SM-2 based)
- **Data Access**:
  - `database/vocabulary_dao.py` - Word database operations
  - `database/speaking_dao.py` - Speaking practice data operations
  - `database/progress_dao.py` - Learning progress tracking
- **Services**:
  - `services/vocabulary_service.py` - Business logic for vocabulary
  - `services/websocket_service.py` - WebSocket event handlers
  - `services/word_update_service.py` - Word synchronization
- **Models**:
  - `models/word.py` - Word model with spaced repetition metadata
  - `models/speaking.py` - Speaking practice questions and responses
- **Utils**:
  - `utils/whisper_integration.py` - Whisper.cpp audio transcription
  - `utils/audio_processing.py` - Audio file processing
  - `utils/speech_processing.py` - Speech recognition utilities

### Frontend Structure (`vue_project/src/`)
- **Pages**:
  - `pages/HomePage.vue` - Main landing page
  - `pages/VocabularyManagementPage.vue` - Word CRUD interface
  - `pages/ReviewPage.vue` - Spaced repetition review interface
  - `pages/SpeakingPage.vue` - IELTS speaking practice
  - `pages/StatisticsPage.vue` - Learning analytics
- **Features**:
  - `features/vocabulary/` - Word management components
  - `features/speaking/` - Speaking practice with audio recording
  - `features/statistics/` - Data visualization components
- **Shared**:
  - `shared/api/` - API client with type definitions
  - `shared/components/` - Reusable UI components
  - `shared/composables/` - Vue composition functions
  - `shared/services/websocket.ts` - WebSocket client
- **Tech Stack**: Vue 3 + TypeScript + Vite + Tailwind CSS + ECharts + Socket.io

### Whisper.cpp Integration (`whisper.cpp/`)
- **Custom Implementation**:
  - `examples/stream/stream_stdin.cpp` - Custom real-time transcription from stdin
  - Modified for IELTS speaking practice with low latency
- **Models** (not in git):
  - `models/ggml-small.bin` - Primary model (465MB)
  - `models/*.mlmodelc` - CoreML optimized models
  - Use download scripts to obtain models
- **Build Artifacts** (not in git):
  - `build/` - Compiled binaries and libraries

### Key Features
- **Spaced Repetition**: Four learning modes (new, review, lapse, spelling)
- **Word Management**: Full CRUD with batch operations
- **Statistics**: Learning progress visualization with ECharts
- **Speaking Practice**: IELTS speaking questions with real-time transcription
- **Real-time Audio**: WebSocket streaming with Whisper.cpp integration
- **Word Relations**: Synonyms, antonyms, roots, topics

### Database Models
- **Word**: Core vocabulary model with spaced repetition metadata
  - Fields: word, definition, example, source_type, ease_factor, interval, etc.
  - Supports IELTS and GRE categorization
- **Speaking Models**: IELTS speaking questions (Part 1, 2, 3) and user responses
- **Progress Tracking**: Learning statistics and review history

### Configuration
- **Database**: `web_app/config.py` - SQLite database path
- **CORS**: Enabled for frontend-backend communication
- **WebSocket**: Socket.io for real-time features (port 5001)
- **HTTPS**: Frontend uses HTTPS with local certificates (*.pem files excluded from git)

## Git and Version Control

### What's Tracked in Git
- ✅ Source code (Python, TypeScript, Vue)
- ✅ Configuration files
- ✅ Whisper.cpp source code (including custom stream_stdin.cpp)
- ✅ Documentation

### What's NOT Tracked (see .gitignore)
- ❌ `vocabulary.db` - Database file (too large, user-specific data)
- ❌ `.venv/` - Python virtual environment (1.3GB)
- ❌ `node_modules/` - NPM dependencies (257MB)
- ❌ `whisper.cpp/models/*.bin` - AI models (465MB+, use download scripts)
- ❌ `whisper.cpp/models/*.mlmodelc` - CoreML models (168MB+)
- ❌ `whisper.cpp/build/` - Compiled binaries (41MB)
- ❌ `web_app/static/audios/` - Recording files (*.wav)
- ❌ `*.pem`, `*.key` - SSL certificates
- ❌ `*.tsbuildinfo` - TypeScript build cache
- ❌ `.DS_Store` - macOS metadata

### Repository Size
- Git repository: ~5MB (after cleanup)
- Full project with dependencies: ~2.5GB

## Important Notes

### Development Workflow
1. Always activate Python virtual environment before backend development
2. Ensure Whisper models are downloaded before using speech features
3. SSL certificates are needed for HTTPS in development (use mkcert)
4. Frontend runs on HTTPS, backend on HTTP (CORS configured)

### Database Management
- `vocabulary.db` is NOT in git - each developer needs their own copy
- Use database migration scripts if schema changes
- Backup database regularly as it contains user learning data

### Whisper.cpp
- Contains custom modifications in `examples/stream/stream_stdin.cpp`
- Models must be downloaded separately (not in git)
- Build directory regenerated on each compile
- Use the provided download scripts for model acquisition

### Dependencies
- **Python**: torch, transformers, scipy (large packages, ~1GB)
- **Node.js**: echarts, typescript, tailwind (257MB total)
- Backend dependencies focus on NLP and ML for word processing
- Frontend dependencies focus on UI and visualization

### Performance Considerations
- Spaced repetition algorithm is in `core/spaced_repetition.py`
- WebSocket used for real-time audio streaming
- Database queries optimized with SQLAlchemy
- Frontend uses lazy loading for better performance

## Troubleshooting

### Backend Issues
```bash
# Reset virtual environment
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -r web_app/requirements.txt
```

### Frontend Issues
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Whisper Issues
```bash
# Rebuild whisper.cpp
cd whisper.cpp
rm -rf build
mkdir build && cd build
cmake ..
make
```

### Database Issues
- If `vocabulary.db` is corrupted, restore from backup
- Schema is defined in `models/` - can regenerate empty database
