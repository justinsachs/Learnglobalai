# LearnGlobal.ai Backend Orchestrator

Production-grade backend system for the Module-to-Assets pipeline that automates training module generation from standards, SOPs, and regulations.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LearnGlobal.ai System                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌─────────────────────────────────────────────────┐   │
│  │  Admin UI   │────▶│                   API Server                     │   │
│  │  (Web App)  │     │  (Fastify + JWT Auth + Audit Logging)           │   │
│  └─────────────┘     └─────────────────┬───────────────────────────────┘   │
│                                        │                                    │
│                                        ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Pipeline Orchestrator                           │   │
│  │  (State Machine with 14 States + Quality Gates)                     │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │  DRAFT_MODULE_SPEC ──▶ OUTLINE_GENERATED ──▶ SOURCEPACK_GENERATED  │   │
│  │         │                                            │               │   │
│  │         ▼                                            ▼               │   │
│  │  QA_PASSED ──▶ NOTEBOOK_CREATED ──▶ NOTEBOOK_SOURCES_UPLOADED      │   │
│  │         │                                            │               │   │
│  │         ▼                                            ▼               │   │
│  │  MEDIA_PROMPT_PACK_GENERATED ──▶ HEYGEN_SCRIPT_GENERATED           │   │
│  │         │                                            │               │   │
│  │         ▼                                            ▼               │   │
│  │  HEYGEN_VIDEO_REQUESTED ──▶ HEYGEN_VIDEO_READY ──▶ LMS_PUBLISHED   │   │
│  │         │                                            │               │   │
│  │         ▼                                            ▼               │   │
│  │  CHAT_CONFIGURED ──▶ AUDIT_FINALIZED                               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                        │                                    │
│         ┌──────────────────────────────┼──────────────────────────────┐    │
│         │                              │                              │    │
│         ▼                              ▼                              ▼    │
│  ┌─────────────┐              ┌─────────────┐              ┌─────────────┐ │
│  │ LLM Provider│              │  Connectors │              │   Chat/RAG  │ │
│  │  (OpenAI)   │              │             │              │   Service   │ │
│  └─────────────┘              │ ┌─────────┐ │              └─────────────┘ │
│                               │ │   S3    │ │                              │
│                               │ │ (MinIO) │ │                              │
│                               │ └─────────┘ │                              │
│                               │ ┌─────────┐ │                              │
│                               │ │NotebookLM│ │                              │
│                               │ └─────────┘ │                              │
│                               │ ┌─────────┐ │                              │
│                               │ │ HeyGen  │ │                              │
│                               │ └─────────┘ │                              │
│                               │ ┌─────────┐ │                              │
│                               │ │   LMS   │ │                              │
│                               │ └─────────┘ │                              │
│                               └─────────────┘                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Data Layer                                   │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  PostgreSQL  │  │    Redis     │  │    MinIO     │               │   │
│  │  │  (Drizzle)   │  │  (BullMQ)    │  │  (S3 Store)  │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **State Machine Orchestrator**: 14-state pipeline with quality gates and automatic transitions
- **Full-Length Prose Generation**: Generates complete training content, not outlines
- **Quality Gates**: Validates word count, bullet ratio, artifact completeness, standards coverage
- **Multi-Vertical Support**: MedViro, ClearClaims, Response Roofing, and custom brands
- **MCP-Style Connectors**: S3, NotebookLM, HeyGen, LMS with retry and logging
- **RAG-Powered Chat**: Module-specific chat with policy guardrails
- **Audit Logging**: Complete traceability and compliance tracking
- **Asset Manifest**: Machine-readable output of all generated artifacts

## Project Structure

```
learnglobal/
├── apps/
│   ├── api/                    # Fastify API server
│   │   ├── src/
│   │   │   ├── db/             # Database schema and migrations
│   │   │   ├── routes/         # API endpoints
│   │   │   └── utils/          # Utilities
│   │   └── package.json
│   └── admin/                  # Admin web interface
│       └── index.html
├── packages/
│   ├── contracts/              # TypeScript types and Zod schemas
│   │   └── src/
│   │       ├── types/          # Type definitions
│   │       └── schemas/        # Zod validation schemas
│   ├── orchestrator/           # State machine engine
│   │   └── src/
│   │       ├── engine/         # Core state machine
│   │       └── states/         # State handlers
│   ├── llm/                    # LLM provider abstraction
│   │   └── src/providers/      # OpenAI and other providers
│   ├── connectors/             # External service connectors
│   │   └── src/
│   │       ├── content-repo/   # S3/MinIO connector
│   │       ├── notebooklm/     # NotebookLM connector
│   │       ├── heygen/         # HeyGen connector
│   │       └── lms/            # LMS connector
│   └── chat/                   # RAG and policy engine
├── samples/                    # Sample data
│   └── medviro-module-spec.json
├── docker-compose.yml
├── Dockerfile.api
├── Dockerfile.admin
└── turbo.json
```

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/learnglobal.git
cd learnglobal
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment file and configure:
```bash
cp .env.example .env
# Edit .env with your API keys and configuration
```

4. Start infrastructure services:
```bash
docker-compose up -d postgres redis minio
```

5. Run database migrations:
```bash
npm run migrate -w @learnglobal/api
```

6. Start the development server:
```bash
npm run dev
```

### Using Docker Compose (Full Stack)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## API Reference

### Modules

#### Create Module
```http
POST /api/modules
Content-Type: application/json
Authorization: Bearer <token>

{
  "verticalId": "medviro",
  "title": "Respiratory Protection Training",
  "description": "OSHA 1910.134 compliant respiratory protection program"
}
```

#### Submit Module Spec
```http
POST /api/modules/:moduleId/spec
Content-Type: application/json

{
  "learningObjectives": ["..."],
  "standardsMapping": [...],
  "scenarios": [...],
  "requiredArtifacts": [...],
  "constraints": {...},
  "safetyBoundaries": {...}
}
```

#### Start Pipeline Run
```http
POST /api/modules/:moduleId/runs
```

#### Get Run Status
```http
GET /api/runs/:runId
```

#### Resume Failed Run
```http
POST /api/runs/:runId/resume
```

### Chat

#### Send Message
```http
POST /api/chat/:moduleId/message
Content-Type: application/json

{
  "message": "What PPE is required for spray painting?"
}
```

### Admin

#### List Runs
```http
GET /api/admin/runs?status=running&limit=50
```

#### Get Audit Log
```http
GET /api/admin/audit?runId=<runId>
```

## Pipeline States

| State | Description |
|-------|-------------|
| `DRAFT_MODULE_SPEC` | Initial state, spec validated |
| `OUTLINE_GENERATED` | Learning outline created |
| `SOURCEPACK_GENERATED` | Full prose content generated |
| `QA_PASSED` | Quality gates validated |
| `NOTEBOOK_CREATED` | NotebookLM project created |
| `NOTEBOOK_SOURCES_UPLOADED` | Source documents uploaded |
| `MEDIA_PROMPT_PACK_GENERATED` | Media prompts prepared |
| `HEYGEN_SCRIPT_GENERATED` | Video scripts created |
| `HEYGEN_VIDEO_REQUESTED` | Video generation initiated |
| `HEYGEN_VIDEO_READY` | Videos completed |
| `LMS_PUBLISHED` | Content published to LMS |
| `CHAT_CONFIGURED` | Chat service configured |
| `AUDIT_FINALIZED` | Audit complete, manifest generated |
| `FAILED` | Pipeline failed (can resume) |

## Quality Gates

The `QA_PASSED` state validates:

1. **Word Count**: Minimum 3000 words per section
2. **Bullet Ratio**: Maximum 20% bullet points (enforces prose)
3. **Artifact Validation**: All required artifacts present
4. **Standards Coverage**: All referenced standards addressed
5. **Scenario Completeness**: All scenarios have decision points

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/learnglobal

# Redis
REDIS_URL=redis://localhost:6379

# Storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=learnglobal

# LLM
OPENAI_API_KEY=sk-...

# External Services
HEYGEN_API_KEY=...
NOTEBOOKLM_API_KEY=...
LMS_API_URL=...
LMS_API_KEY=...

# Security
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=32-byte-hex-key
```

### Vertical Configuration

Each vertical (brand) can have custom settings in the database:

```json
{
  "verticalId": "medviro",
  "name": "MedViro",
  "branding": {
    "primaryColor": "#0066cc",
    "logo": "https://..."
  },
  "defaultConstraints": {
    "minWordCount": 3000,
    "maxBulletRatio": 0.2
  },
  "llmConfig": {
    "provider": "openai",
    "model": "gpt-4-turbo"
  }
}
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run specific package tests
npm test -w @learnglobal/orchestrator

# Run with coverage
npm run test:coverage
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build -w @learnglobal/api
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure proper database credentials
- [ ] Set up Redis with persistence
- [ ] Configure S3 bucket with proper permissions
- [ ] Set strong JWT secret (32+ bytes)
- [ ] Enable HTTPS/TLS
- [ ] Configure rate limiting
- [ ] Set up log aggregation
- [ ] Configure health check endpoints
- [ ] Set up monitoring and alerting

### Docker Production Build

```bash
# Build images
docker build -f Dockerfile.api -t learnglobal-api:latest .
docker build -f Dockerfile.admin -t learnglobal-admin:latest .

# Run with production config
docker-compose -f docker-compose.prod.yml up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.
