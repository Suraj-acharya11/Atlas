# ATLAS — AI-Powered Personal Intelligence Platform

ATLAS is an AI-powered Personal Intelligence Platform designed to help users organize their activities, manage tasks and goals, process knowledge, receive AI-assisted recommendations, plan their work, and reflect on their learning and progress.

Unlike a conventional task manager, ATLAS aims to connect user activities and context with decision support and planning to provide a more integrated personal productivity experience.

## Key Features

- **Dashboard:** A central interface for accessing key information and activities.
- **Task and Plan Management:** Organize tasks and interact with daily plans.
- **AI Chat:** Interact with the AI service through the application.
- **Knowledge Processing:** Support the organization and use of contextual knowledge.
- **Decision Support:** Analyze available context to support recommendations.
- **Planning:** Connect decisions and priorities with task and plan generation.
- **Reflection:** Record learning experiences, progress, and difficulties, and review previous reflections.
- **Backend API:** Provide API endpoints and services for application functionality.
- **Testing:** Validate API behaviour, mobile UI interactions, and baseline performance.

## Architecture

ATLAS follows a mobile-client and backend-service architecture.

- **Mobile Application:** React Native and Expo.
- **Backend API:** NestJS.
- **Database:** MongoDB with Mongoose.
- **Supporting Services:** Redis and Qdrant.
- **AI Integration:** An external AI service supporting AI-related functionality.

The mobile application communicates with the backend API, which coordinates application services and data access.

## Technology Stack

| Area | Technology |
|---|---|
| Mobile application | React Native, Expo |
| Backend | NestJS, Node.js |
| Database | MongoDB, Mongoose |
| Caching / supporting data services | Redis |
| Vector search / knowledge retrieval | Qdrant |
| API testing | Postman |
| Mobile UI automation | Appium, WebdriverIO |
| Performance testing | Apache JMeter |
| Project management | Jira |
| Version control | Git, GitHub |

## Project Structure

The project is organized as a monorepo.

```text
ATLAS/
├── apps/
│   ├── api/       # NestJS backend API
│   └── mobile/    # React Native / Expo application
├── mobile-e2e/    # Mobile end-to-end testing
├── package.json
├── pnpm-workspace.yaml
└── docker-compose.yml
```

The exact directory contents may vary as development progresses.

## Getting Started

### Prerequisites

Install the tools required by your local setup:

- Node.js
- pnpm
- Git
- Docker Desktop, if using Docker Compose
- Android development tools, if running the mobile application on Android

MongoDB, Redis, Qdrant, and the configured AI service must be available according to your environment configuration.

### Installation

Clone the repository:

```bash
git clone <YOUR_REPOSITORY_URL>
cd Atlas
```

Install dependencies:

```bash
pnpm install
```

Configure the environment variables required by the API and supporting services. Refer to the project's environment example files, if provided. Do not commit API keys, passwords, database credentials, JWT secrets, or other sensitive values.

### Run the Application

Start the services using the commands and configuration defined in the repository. For example, if the root scripts and Docker Compose configuration are set up for this workflow:

```bash
docker compose up -d
pnpm dev
```

Check the root `package.json` and project documentation for the exact available scripts. The API has been configured to use port `3000` in the development setup.

## Testing

ATLAS uses multiple testing approaches:

- **Postman:** API endpoint and response validation.
- **Appium and WebdriverIO:** Automated mobile UI interaction tests.
- **Apache JMeter:** Baseline API load and response-time measurements.

Testing results should be interpreted in the context of the test environment and the scenarios executed. Detailed results and known issues should be documented alongside the relevant test evidence.

## Project Management

Jira is used to organize project work into epics, tasks, and sprints, with work tracked across To Do, In Progress, and Done.

## Current Development Status

ATLAS is under active development. Features, integrations, and test coverage may change as implementation progresses. Refer to the repository and project board for the latest implementation status.

## Security

- Keep secrets and environment files out of version control.
- Use environment variables for credentials and service configuration.
- Never publish access tokens or private database connection strings.
- Use a sanitized `.env.example` file to document required configuration.

## Future Enhancements

Potential areas for continued development include:

- Improving AI-assisted decision-making and planning.
- Expanding automated test coverage.
- Resolving remaining mobile UI automation issues.
- Improving knowledge retrieval and contextual recommendations.
- Enhancing reliability and deployment documentation.

## License

No license has been specified yet. Add a license after deciding how the project may be used, modified, and distributed.
