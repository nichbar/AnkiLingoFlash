# Contribution Workflow

This document outlines the complete workflow for contributing to the AnkiLingoFlash project, including development practices, pull request process, and code review guidelines.

## Overview

The AnkiLingoFlash project follows a structured contribution workflow to maintain code quality, ensure cross-browser compatibility, and facilitate collaborative development.

## Development Workflow

### 1. Before You Start

**Prerequisites**:
- Complete the [Environment Setup](../getting-started/environment-setup.md)
- Read the [Architecture Overview](../architecture/overview.md)
- Understand the [Multi-Browser Pattern](../architecture/multi-browser-pattern.md)

**First Steps**:
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/YOUR_USERNAME/AnkiLingoFlash.git

# Add upstream remote
git remote add upstream https://github.com/pictoune/AnkiLingoFlash.git

# Navigate to project directory
cd AnkiLingoFlash

# Install dependencies (optional)
npm install
```

### 2. Branch Strategy

**Main Branches**:
- `main`: Production-ready code
- `develop`: Integration branch for new features (if exists)

**Feature Branches**:
```bash
# Create a new feature branch from main
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description

# Or for documentation
git checkout -b docs/documentation-updates
```

**Branch Naming Conventions**:
- `feature/`: New features and enhancements
- `fix/`: Bug fixes and patches
- `docs/`: Documentation updates
- `refactor/`: Code refactoring
- `test/`: Test additions or improvements
- `chore/`: Maintenance tasks, dependencies, build changes

### 3. Development Process

**Step-by-Step**:

1. **Sync with Upstream**:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**:
   - Edit files in `src/` directory
   - Follow the [Code Style](code-style.md) guidelines
   - Test across all browsers

4. **Build and Test**:
   ```bash
   # Build for all browsers
   ./build.sh

   # Test in each browser:
   # Chrome: Load dist/chrome
   # Firefox: Load dist/firefox
   # Edge: Load dist/edge
   ```

5. **Commit Changes**:
   ```bash
   # Stage changes
   git add .

   # Commit with conventional commit message
   git commit -m "feat: add new language detection feature"
   ```

### 4. Commit Message Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

**Examples**:
```bash
# Feature addition
git commit -m "feat(popup): add dark mode toggle to settings"

# Bug fix
git commit -m "fix(auth): resolve OAuth2 redirect issue for Firefox"

# Documentation
git commit -m "docs(api): update backend endpoint documentation"

# Refactoring
git commit -m "refactor(common): extract API client to separate module"
```

## Pull Request Process

### 1. Before Opening a PR

**Checklist**:
- [ ] Code follows [Code Style](code-style.md) guidelines
- [ ] All browsers build successfully with `./build.sh`
- [ ] Feature works across Chrome, Firefox, and Edge
- [ ] No console errors in any browser
- [ ] Authentication flow works (if applicable)
- [ ] Documentation is updated (if needed)
- [ ] Commits follow conventional commit format

### 2. Creating a Pull Request

**Steps**:
1. **Push to GitHub**:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open Pull Request**:
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select your feature branch
   - Target: `main` branch
   - Fill out PR template

### 3. Pull Request Template

```markdown
## Description
Brief description of the changes and the problem they solve.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Tested in Chrome
- [ ] Tested in Firefox
- [ ] Tested in Edge
- [ ] Tested AnkiConnect integration (if applicable)
- [ ] Tested authentication flow (if applicable)

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated (if needed)
- [ ] Build passes for all browsers
- [ ] No console errors in any browser

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Context
Any other context about the pull request.
```

### 4. Pull Request Review Process

**Review Criteria**:
1. **Code Quality**: Clean, readable, maintainable code
2. **Functionality**: Works as intended across all browsers
3. **Architecture**: Follows established patterns
4. **Security**: No security vulnerabilities introduced
5. **Performance**: No performance regressions
6. **Documentation**: Appropriate documentation updates

**Review Types**:
- **Required**: At least one maintainer approval
- **Optional**: Community review and feedback

**Addressing Feedback**:
```bash
# Make requested changes
git add .
git commit -m "fix: address PR feedback - add missing error handling"

# Push to update PR
git push origin feature/your-feature-name
```

## Code Review Guidelines

### For Reviewers

**What to Look For**:
1. **Functionality**: Does the code work as intended?
2. **Cross-Browser Compatibility**: Will it work on Chrome, Firefox, and Edge?
3. **Security**: Are there any security concerns?
4. **Performance**: Any performance implications?
5. **Code Quality**: Is the code clean and maintainable?
6. **Testing**: Has it been adequately tested?
7. **Documentation**: Is documentation updated appropriately?

**Review Process**:
1. **Initial Review**: Overall functionality and approach
2. **Detailed Review**: Code-level issues and suggestions
3. **Testing Verification**: Confirm testing was done
4. **Approval**: Approve when ready or request changes

**Constructive Feedback**:
- Be specific and actionable
- Explain the "why" behind suggestions
- Provide code examples for improvements
- Acknowledge good work and approaches

### For Authors

**Before Submitting for Review**:
1. **Self-Review**: Review your own code first
2. **Test Thoroughly**: Test across all target browsers
3. **Check Style**: Ensure code follows project guidelines
4. **Update Documentation**: Update relevant documentation

**During Review**:
1. **Be Responsive**: Respond to feedback promptly
2. **Ask Questions**: Clarify any unclear feedback
3. **Be Open**: Consider alternative approaches
4. **Learn**: Use feedback as a learning opportunity

## Testing Requirements

### Manual Testing Checklist

**Core Functionality**:
- [ ] Extension loads without errors in all browsers
- [ ] Popup opens and displays correctly
- [ ] Settings are saved and loaded
- [ ] Context menu appears on text selection
- [ ] Flashcard generation works
- [ ] Authentication flow completes successfully

**Cross-Browser Testing**:
- [ ] Chrome: Extension loads and functions correctly
- [ ] Firefox: Extension loads and functions correctly
- [ ] Edge: Extension loads and functions correctly

**Integration Testing**:
- [ ] AnkiConnect integration (if applicable)
- [ ] AI API calls work correctly
- [ ] OAuth2 authentication completes
- [ ] Error handling works properly

**UI/UX Testing**:
- [ ] Responsive design works
- [ ] Text is readable and well-formatted
- [ ] User feedback is clear (toasts, notifications)
- [ ] Loading states work correctly

### Test Environment Setup

**Local Testing**:
```bash
# Build for all browsers
./build.sh

# Load extensions:
# Chrome: chrome://extensions/ → Load unpacked → dist/chrome
# Firefox: about:debugging → Load Temporary Add-on → dist/firefox
# Edge: edge://extensions/ → Load unpacked → dist/edge
```

**Anki Testing**:
```bash
# Ensure Anki is running with AnkiConnect
curl -X POST http://127.0.0.1:8765 \
  -H "Content-Type: application/json" \
  -d '{"action": "version", "version": 6}'
```

## Release Process

### Version Management

**Semantic Versioning**: Follow SemVer (MAJOR.MINOR.PATCH)

**Version Updates**:
1. Update version in `manifest_common.json`
2. Update version in `package.json`
3. Update changelog
4. Tag release with version number

### Release Checklist

**Before Release**:
- [ ] All PRs are merged and tested
- [ ] Version numbers updated consistently
- [ ] Documentation is updated
- [ ] Changelog is updated
- [ ] Build passes for all browsers
- [ ] Security review completed (if needed)

**Release Process**:
1. **Create Release Branch**:
   ```bash
   git checkout -b release/v0.6.0
   ```

2. **Update Versions**:
   - Update `src/common/manifest_common.json`
   - Update `package.json`
   - Update CHANGELOG.md

3. **Build and Test**:
   ```bash
   ./build.sh
   # Test release builds
   ```

4. **Tag and Push**:
   ```bash
   git commit -m "chore: bump version to 0.6.0"
   git tag -a v0.6.0 -m "Release version 0.6.0"
   git push origin main --tags
   ```

5. **Create GitHub Release**:
   - Go to GitHub releases page
   - Create new release
   - Upload built extensions
   - Add release notes

## Code Style Guidelines

### JavaScript Standards

**ES6+ Features**:
- Use `const` and `let` instead of `var`
- Use arrow functions where appropriate
- Use template literals for string interpolation
- Use destructuring for cleaner code

**Example**:
```javascript
// Good
const generateFlashcard = async (text, language) => {
  const settings = await getSettings();
  const { apiKey, model } = settings;

  try {
    const result = await callAI(text, language, { apiKey, model });
    return result;
  } catch (error) {
    console.error('Failed to generate flashcard:', error);
    throw error;
  }
};

// Avoid
function generateFlashcard(text, language) {
  var settings = getSettings();
  var apiKey = settings.apiKey;
  // ...
}
```

**Error Handling**:
- Use try-catch for async operations
- Provide meaningful error messages
- Log errors appropriately
- Handle edge cases

**Code Organization**:
- Group related functions together
- Use clear function and variable names
- Add JSDoc comments for public functions
- Keep functions focused on single responsibilities

### Browser Compatibility

**API Usage**:
```javascript
// Use feature detection
const api = typeof browser !== 'undefined' ? browser : chrome;

// Check for API availability
if (api.identity && api.identity.getAuthToken) {
  // Chrome implementation
} else if (api.identity && api.identity.launchWebAuthFlow) {
  // Firefox implementation
}
```

**ES6+ Features**: Ensure compatibility with target browsers
- Modern browsers support most ES6+ features
- Avoid experimental features without polyfills
- Test transpiled code if using newer features

## Issue Management

### Reporting Issues

**Bug Reports**:
- Use GitHub issue templates
- Provide detailed reproduction steps
- Include browser and OS information
- Add screenshots if applicable

**Feature Requests**:
- Describe the problem being solved
- Suggest implementation approach
- Consider cross-browser implications

### Issue Triage

**Labels**:
- `bug`: Bug reports
- `enhancement`: Feature requests
- `documentation`: Documentation issues
- `good first issue`: Good for newcomers
- `help wanted`: Community help needed

**Priority Levels**:
- **High**: Breaking bugs, security issues
- **Medium**: Important features, usability issues
- **Low**: Nice-to-have features, minor issues

## Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on what is best for the community

### Getting Help

- **Documentation**: Check existing docs first
- **Issues**: Search existing GitHub issues
- **Discussions**: Start a new discussion for questions
- **Maintainers**: Tag maintainainers for urgent issues

### Contributing Beyond Code

- **Documentation**: Help improve documentation
- **Testing**: Report bugs and test features
- **Translation**: Help with internationalization
- **Design**: Contribute UI/UX improvements

## Development Tools

### Recommended Extensions

**VS Code Extensions**:
- ESLint - Code quality checking
- Prettier - Code formatting
- GitLens - Enhanced Git capabilities
- Thunder Client - API testing
- Bracket Pair Colorizer - Visual code structure

**Browser Developer Tools**:
- Chrome DevTools
- Firefox Developer Tools
- Microsoft Edge DevTools

### Debugging Setup

**Debugging Configuration**:
```javascript
// Enable debug logging in development
const DEBUG = process.env.NODE_ENV === 'development';

const debugLog = (message, ...args) => {
  if (DEBUG) {
    console.log(`[AnkiLingoFlash] ${message}`, ...args);
  }
};
```

This contribution workflow ensures high-quality contributions while maintaining a collaborative and productive development environment. Following these guidelines helps the project maintain consistency and reliability across all supported browsers.