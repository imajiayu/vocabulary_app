# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an IELTS vocabulary learning application built with Flask backend and Vue.js frontend, implementing a spaced repetition system for vocabulary memorization and speaking practice.

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
npm run dev                   # Start development server
npm run build                 # Build for production
npm run preview               # Preview production build
vue-tsc -b                    # TypeScript type checking
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

## Architecture

### Backend Structure (`web_app/`)
- **Flask App**: Main entry point at `app.py`, runs on port 5001
- **Database**: SQLite database (`vocabulary.db`) with SQLAlchemy models
- **API Routes**:
  - `routes/api_bp.py` - Main vocabulary API endpoints
  - `routes/speaking_api_bp.py` - Speaking practice endpoints
- **Models**: Word and speaking practice models in `models/`
- **Utils**: Database tools, algorithms, and word processing utilities
- **Extensions**: Socket.io for real-time features

### Frontend Structure (`vue_project/src/`)
- **Views**: Main pages (MainIndex, ReviewWords, Stats, WordsManagement, SpeakingIndex)
- **Components**:
  - `common/` - Reusable UI components (IOSSwitch, IndexButton, WheelSelector)
  - `review_page/` - Word review and spelling components
  - `charts/` - Data visualization (PieChart, HeatMap, LineChart)
  - `speaking_sidebar/` - Speaking practice interface
- **Router**: Vue Router with meta titles for IELTS pages
- **Tech Stack**: Vue 3 + TypeScript + Vite + Tailwind CSS + ECharts

### Key Features
- **Spaced Repetition**: Four learning modes (new, review, lapse, spelling)
- **Word Management**: CRUD operations for vocabulary words
- **Statistics**: Learning progress visualization with charts
- **Speaking Practice**: IELTS speaking question practice
- **Real-time Updates**: Socket.io integration for live features

### Database Models
- **Word**: Core vocabulary model with spaced repetition metadata
- **Speaking Models**: IELTS speaking practice questions and responses
- **Source Types**: IELTS and GRE vocabulary categorization

### Configuration
- **Database Path**: Configured in `web_app/config.py`
- **CORS**: Enabled for frontend-backend communication
- **Session Management**: Flask sessions for review state persistence

## Important Notes

- Always activate the Python virtual environment before backend development
- The application uses a single SQLite database for all data persistence
- Word review sessions maintain state through Flask sessions
- Frontend communicates with backend via REST API and Socket.io
- The spaced repetition algorithm is implemented in `web_app/utils/algorithms.py`