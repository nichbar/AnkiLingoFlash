# AnkiLingoFlash Documentation

Welcome to the comprehensive developer documentation for AnkiLingoFlash, a multi-browser extension for automated Anki flashcard creation.

## Quick Start

- **[New to the project?**](getting-started/environment-setup.md) Start with the environment setup guide
- **[Understanding the architecture?**](architecture/overview.md) Read the system architecture overview
- **[Need API reference?**](api/backend-endpoints.md) Check the backend API documentation
- **[Ready to contribute?**](development/contribution-workflow.md) Follow the contribution workflow

## Documentation Structure

### 🚀 Getting Started
New developers should start here to understand the project and set up their development environment.

- [Environment Setup](getting-started/environment-setup.md) - Prerequisites, local development setup, and first build
- [First Contribution](getting-started/first-contribution.md) - Step-by-step guide for your first contribution
- [Debugging Guide](getting-started/debugging-guide.md) - Tools and techniques for effective debugging

### 🏗️ Architecture
Understanding the system architecture is essential for making informed development decisions.

- [Architecture Overview](architecture/overview.md) - High-level system design and component relationships
- [Multi-Browser Pattern](architecture/multi-browser-pattern.md) - How the common + browser-specific strategy works
- [Component Interactions](architecture/component-interactions.md) - Data flow and communication patterns
- [Backend Architecture](architecture/backend-architecture.md) - Cloudflare Workers design and implementation

### 🔌 API Documentation
Reference documentation for all APIs used in the project.

- [Backend Endpoints](api/backend-endpoints.md) - Cloudflare Workers API reference
- [Browser Extension APIs](api/browser-extension-apis.md) - Chrome/Firefox extension API usage
- [AnkiConnect Integration](api/anki-connect-integration.md) - AnkiConnect API details and usage

### 💻 Development
Guidelines and workflows for contributing to the project.

- [Code Style](development/code-style.md) - Coding conventions and documentation standards
- [Contribution Workflow](development/contribution-workflow.md) - PR process, code review, and release management
- [Build System](development/build-system.md) - Detailed explanation of the build process
- [Testing Guide](development/testing-guide.md) - Manual testing procedures and guidelines

### ⚙️ Configuration
Setup and configuration documentation for development and deployment.

- [OAuth2 Setup](configuration/oauth2-setup.md) - Google OAuth2 configuration for all browsers
- [API Key Management](configuration/api-key-management.md) - Secure handling of API keys
- [Manifest Configuration](configuration/manifest-configuration.md) - Extension manifest details and options

### 🔧 Troubleshooting
Common issues and their solutions for developers and users.

- [Common Development Issues](troubleshooting/common-development-issues.md) - Setup and build problems
- [Browser-Specific Issues](troubleshooting/browser-specific-issues.md) - Chrome, Firefox, and Edge specific problems
- [Anki Connection Problems](troubleshooting/anki-connection-problems.md) - AnkiConnect debugging and solutions

## Project Overview

AnkiLingoFlash is a sophisticated browser extension that helps language learners create Anki flashcards automatically from web content. The project uses a unique multi-browser architecture that maximizes code reuse while accommodating browser-specific requirements.

### Key Features

- **Multi-Browser Support**: Chrome, Firefox, and Edge with shared core functionality
- **AI-Powered**: Integration with OpenAI and Google AI for intelligent flashcard generation
- **Language Detection**: Automatic language identification using the Franc library
- **Anki Integration**: Direct connection to Anki via AnkiConnect plugin
- **OAuth2 Authentication**: Secure Google authentication with free and premium tiers

### Architecture Highlights

- **Common + Browser-Specific Pattern**: 90% shared codebase with minimal browser-specific adaptations
- **Cloudflare Workers Backend**: Serverless API for rate limiting, user management, and API proxying
- **Modular Design**: Clear separation between content scripts, background scripts, and popup interface
- **Secure Key Management**: Encrypted API key storage with PBKDF2 key derivation

## Development Principles

- **Browser Compatibility**: Maintain consistent functionality across Chrome, Firefox, and Edge
- **Security First**: Implement proper encryption, CORS policies, and content security
- **Developer Experience**: Provide clear documentation and smooth onboarding process
- **User Privacy**: Minimize data collection and handle user information responsibly

## Getting Help

- **For users**: Check the main [README.md](../README.md) in the project root
- **For developers**: Start with the [Getting Started](getting-started/environment-setup.md) guide
- **For contributors**: Review the [Contribution Workflow](development/contribution-workflow.md)
- **For troubleshooting**: See the [Troubleshooting](troubleshooting/) section

## Contributing to Documentation

Documentation contributions are welcome! Please:

1. Follow the established [Code Style](development/code-style.md) guidelines
2. Ensure all links work and are properly formatted
3. Test code examples and configuration snippets
4. Update related documentation when making changes
5. Submit documentation changes through the standard [Contribution Workflow](development/contribution-workflow.md)

---

This documentation is continuously updated to reflect the current state of the AnkiLingoFlash project. Last updated: December 2024