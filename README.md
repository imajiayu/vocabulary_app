# IELTS Vocabulary Learning Application

A full-stack web application for IELTS vocabulary learning with spaced repetition system and AI-powered speaking practice.

## Features

- **Spaced Repetition System**: Smart vocabulary review algorithm based on SM-2 algorithm
- **Word Management**: Full CRUD operations with batch import/export
- **Speaking Practice**: IELTS speaking questions (Part 1, 2, 3) with real-time audio transcription
- **Progress Tracking**: Comprehensive learning statistics and progress visualization
- **Word Relations**: Manage synonyms, antonyms, root words, confused words, and topics
- **Real-time Updates**: WebSocket integration for live audio streaming and updates

## Tech Stack

### Backend
- **Flask** - Python web framework
- **SQLAlchemy** - ORM for SQLite database
- **Flask-SocketIO** - WebSocket support
- **Whisper.cpp** - Fast audio transcription (C++ implementation)

### Frontend
- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first CSS framework
- **ECharts** - Data visualization
- **Socket.io** - Real-time communication

## Prerequisites

- **Python**: 3.8 or higher
- **Node.js**: 16.x or higher
- **npm**: 8.x or higher
- **CMake**: 3.10 or higher (for building Whisper.cpp)
- **Git**: For cloning repositories

### macOS Specific
- **Xcode Command Line Tools**: `xcode-select --install`
- **Homebrew** (recommended): For installing dependencies

### Linux Specific
- **Build tools**: `gcc`, `g++`, `make`
- **Development headers**: `libasound2-dev` (for audio support)

## Quick Start

### Automated Installation (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd vocabulary_app

# Run the setup script
chmod +x setup.sh
./setup.sh
```

The setup script will:
1. Install Python dependencies
2. Install Node.js dependencies
3. Clone and build Whisper.cpp
4. Download the Whisper small model (~465MB)
5. Build the custom stream_stdin binary
6. Build whisper-cli for audio transcription

### Manual Installation

If you prefer to install manually or the setup script fails:

#### 1. Python Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install Python dependencies
pip install -r web_app/requirements.txt
```

#### 2. Frontend Setup

```bash
cd vue_project

# Install dependencies
npm install

# Generate SSL certificates for HTTPS (optional but recommended)
# Install mkcert first: brew install mkcert (macOS) or see https://github.com/FiloSottile/mkcert
mkcert -install
mkcert localhost
```

#### 3. Whisper.cpp Setup

```bash
# Clone Whisper.cpp
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp

# Download the small model (~465MB)
bash ./models/download-ggml-model.sh small

# Build Whisper.cpp
mkdir build && cd build
cmake ..
cmake --build . --config Release

# The binaries will be in whisper.cpp/build/bin/
# - whisper-cli: Main transcription tool
# - whisper-stream-stdin: Custom real-time streaming (if custom implementation exists)
```

## Running the Application

### Using the Start Script (Recommended)

```bash
# Start both backend and frontend
./start.sh start

# Stop both services
./start.sh stop

# Check status
./start.sh status
```

The application will be available at:
- **Frontend**: http://localhost:80 (HTTP)
- **Backend API**: http://localhost:5001 (HTTP)
- **WebSocket**: ws://localhost:5001 (same as backend)

### Manual Start

#### Start Backend
```bash
# Activate virtual environment
source .venv/bin/activate

# Run Flask application
python -m web_app.app
```

Backend will run on `http://localhost:5001`

#### Start Frontend
```bash
cd vue_project

# Development mode
npm run dev

# Production build
npm run build
npm run preview
```

Frontend will run on `http://localhost:80`

## Project Structure

```
vocabulary_app/
├── web_app/                    # Flask backend
│   ├── api/                    # API endpoints
│   │   ├── vocabulary.py       # Vocabulary CRUD APIs
│   │   └── speaking.py         # Speaking practice APIs
│   ├── core/                   # Core business logic
│   │   └── spaced_repetition.py # SM-2 algorithm implementation
│   ├── database/               # Data access layer
│   │   ├── vocabulary_dao.py   # Word database operations
│   │   ├── speaking_dao.py     # Speaking practice data
│   │   └── progress_dao.py     # Progress tracking
│   ├── models/                 # SQLAlchemy models
│   │   ├── word.py             # Word model
│   │   └── speaking.py         # Speaking models
│   ├── services/               # Business services
│   │   ├── vocabulary_service.py    # Vocabulary logic
│   │   ├── websocket_service.py     # WebSocket handlers
│   │   └── word_update_service.py   # Word sync service
│   ├── utils/                  # Utilities
│   │   ├── whisper_integration.py   # Whisper.cpp integration
│   │   ├── audio_processing.py      # Audio file processing
│   │   └── speech_processing.py     # Speech recognition
│   ├── app.py                  # Flask application entry
│   ├── config.py               # Configuration
│   └── requirements.txt        # Python dependencies
│
├── vue_project/                # Vue.js frontend
│   ├── src/
│   │   ├── pages/              # Page components
│   │   │   ├── HomePage.vue
│   │   │   ├── VocabularyManagementPage.vue
│   │   │   ├── ReviewPage.vue
│   │   │   ├── SpeakingPage.vue
│   │   │   └── StatisticsPage.vue
│   │   ├── features/           # Feature modules
│   │   │   ├── vocabulary/     # Word management
│   │   │   ├── speaking/       # Speaking practice
│   │   │   └── statistics/     # Data visualization
│   │   ├── shared/             # Shared resources
│   │   │   ├── api/            # API clients
│   │   │   ├── components/     # Reusable components
│   │   │   ├── composables/    # Vue composables
│   │   │   └── services/       # Frontend services
│   │   ├── App.vue             # Root component
│   │   └── main.ts             # Application entry
│   ├── package.json            # Node dependencies
│   └── vite.config.ts          # Vite configuration
│
├── whisper.cpp/                # Whisper.cpp (cloned)
│   ├── models/                 # AI models (downloaded)
│   │   └── ggml-small.bin      # Small model (465MB)
│   ├── build/                  # Compiled binaries
│   │   └── bin/
│   │       ├── whisper-cli     # Main CLI tool
│   │       └── whisper-stream-stdin  # Custom streaming
│   └── examples/
│       └── stream/
│           └── stream_stdin.cpp # Custom implementation
│
├── vocabulary.db               # SQLite database (generated)
├── start.sh                    # Start/stop script
├── setup.sh                    # Installation script
├── CLAUDE.md                   # Development guidelines
└── README.md                   # This file
```

## Database Schema

### Word Model
- Word metadata (word, definition, examples, phonetics)
- Spaced repetition data (ease_factor, interval, repetitions)
- Learning mode (new, review, lapse, spelling)
- Source type (IELTS, GRE, custom)
- Word relations (synonyms, antonyms, roots, topics)

### Speaking Models
- Speaking questions (Part 1, 2, 3)
- User responses with audio recordings
- Transcription results

### Progress Tracking
- Learning statistics
- Review history
- Performance metrics

## Development

### Backend Development

```bash
# Activate virtual environment
source .venv/bin/activate

# Run with auto-reload
python -m web_app.app

# Type checking (if using type hints)
python -m mypy web_app/
```

### Frontend Development

```bash
cd vue_project

# Start dev server
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build
```

### Whisper.cpp Development

If you modify `whisper.cpp/examples/stream/stream_stdin.cpp`:

```bash
cd whisper.cpp/build

# Rebuild
cmake --build . --config Release

# Test the binary
./bin/whisper-stream-stdin --model ../models/ggml-small.bin
```

## Configuration

### Backend Configuration (`web_app/config.py`)
- Database path
- CORS settings
- WebSocket configuration
- Audio processing settings

### Frontend Configuration (`vue_project/vite.config.ts`)
- HTTPS settings
- API proxy configuration
- Build options

### Environment Variables
Create a `.env` file in the root directory (optional):
```bash
FLASK_ENV=development
DATABASE_URL=sqlite:///vocabulary.db
WHISPER_MODEL_PATH=whisper.cpp/models/ggml-small.bin
```

## Troubleshooting

### Backend Issues

**Issue**: `ModuleNotFoundError: No module named 'flask'`
```bash
source .venv/bin/activate
pip install -r web_app/requirements.txt
```

**Issue**: Database connection errors
```bash
# Delete and recreate database
rm vocabulary.db
python -m web_app.app  # Will auto-create tables
```

### Frontend Issues

**Issue**: `Cannot find module` errors
```bash
cd vue_project
rm -rf node_modules package-lock.json
npm install
```

**Issue**: HTTPS certificate errors
```bash
# Regenerate certificates
cd vue_project
mkcert localhost
```

### Whisper.cpp Issues

**Issue**: Whisper binary not found
```bash
# Verify build
ls -la whisper.cpp/build/bin/

# Rebuild if needed
cd whisper.cpp/build
cmake --build . --config Release
```

**Issue**: Model file not found
```bash
# Download model
cd whisper.cpp/models
bash ./download-ggml-model.sh small

# Verify
ls -lh ggml-small.bin
```

**Issue**: Audio transcription fails
```bash
# Test whisper-cli directly
./whisper.cpp/build/bin/whisper-cli \
  -m whisper.cpp/models/ggml-small.bin \
  -f path/to/audio.wav
```

### Common Issues

**Issue**: Port already in use
```bash
# Kill process on port 5001 (backend)
lsof -ti:5001 | xargs kill -9

# Kill process on port 443 (frontend)
lsof -ti:443 | xargs kill -9

# Or kill process on port 444 if 443 was in use
lsof -ti:444 | xargs kill -9
```

**Issue**: Permission denied on scripts
```bash
chmod +x start.sh setup.sh
```

## API Documentation

### Vocabulary Endpoints
- `GET /api/vocabulary/words` - List all words
- `POST /api/vocabulary/words` - Create new word
- `PUT /api/vocabulary/words/:id` - Update word
- `DELETE /api/vocabulary/words/:id` - Delete word
- `GET /api/vocabulary/review` - Get words for review

### Speaking Endpoints
- `GET /api/speaking/questions` - Get speaking questions
- `POST /api/speaking/responses` - Submit speaking response
- `POST /api/speaking/transcribe` - Transcribe audio

### WebSocket Events
- `connect` - Client connection
- `audio_stream` - Real-time audio streaming
- `transcription_result` - Transcription results
- `word_update` - Word data updates

## Performance

- **Backend**: Flask with SQLAlchemy, optimized queries
- **Frontend**: Vue 3 with lazy loading and code splitting
- **Audio**: Whisper.cpp (C++ implementation, much faster than Python)
- **Database**: SQLite with proper indexing
- **Real-time**: WebSocket for low-latency communication

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Credits

- **Whisper.cpp**: https://github.com/ggml-org/whisper.cpp
- **OpenAI Whisper**: https://github.com/openai/whisper
- **SM-2 Algorithm**: https://en.wikipedia.org/wiki/SuperMemo

## Support

For issues and questions:
- Open an issue on GitHub
- Check the [CLAUDE.md](CLAUDE.md) file for development guidelines

## Changelog

### v1.0.0 (Current)
- Initial release
- Spaced repetition system
- Speaking practice with Whisper.cpp
- Statistics and progress tracking
- Word relations management
