# Backend API Reference

This document provides a complete reference for the AnkiLingoFlash Cloudflare Workers backend API. The backend handles user management, rate limiting, API proxying, and OAuth2 authentication.

## Base URL

```
https://anki-lingo-flash.piriouvictor.workers.dev
```

## Overview

The backend provides the following core functionality:
- **User Management**: User data storage and retrieval
- **Rate Limiting**: Free tier usage tracking and limits enforcement
- **API Proxying**: Secure proxying to OpenAI and Google AI APIs
- **OAuth2 Handling**: Google OAuth2 redirect processing
- **CORS Support**: Cross-origin request handling for browser extensions

## API Endpoints

### 1. Chat Completions

**Endpoint**: `POST /api/chat`

**Description**: Proxy requests to OpenAI's chat completions API for generating flashcard content.

**Request Body**:
```json
{
  "model": "gpt-4o-2024-08-06",
  "messages": [
    {
      "role": "user",
      "content": "Generate a flashcard for..."
    }
  ],
  "response_format": {
    "type": "json_object"
  }
}
```

**Response**: Returns the OpenAI API response directly:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4o-2024-08-06",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"word\":\"...\",\"translation\":\"...\"}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 30,
    "total_tokens": 80
  }
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Example Usage**:
```javascript
const response = await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-2024-08-06',
    messages: [
      {
        role: 'user',
        content: 'Create a flashcard for the word:Bonjour'
      }
    ],
    response_format: {
      type: 'json_object'
    }
  })
});
```

### 2. Available Models

**Endpoint**: `GET /api/models`

**Description**: Retrieve available GPT models from OpenAI API.

**Response**:
```json
{
  "result": [
    "gpt-4o-2024-08-06",
    "gpt-4o-mini",
    "gpt-3.5-turbo"
  ],
  "error": null
}
```

**Error Response**:
```json
{
  "result": null,
  "error": "Failed to fetch models from OpenAI"
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Example Usage**:
```javascript
const response = await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/models');
const data = await response.json();
console.log('Available models:', data.result);
```

### 3. Usage Limits

**Endpoint**: `GET /api/limits`

**Description**: Get current usage limits for the free tier.

**Response**:
```json
{
  "freeGenerationLimit": 100,
  "regenerationLimit": 5
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Example Usage**:
```javascript
const response = await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/limits');
const limits = await response.json();
console.log('Free limit:', limits.freeGenerationLimit);
```

### 4. User Data Management

**Endpoint**: `GET /api/user-data/{userId}`

**Description**: Retrieve user data including usage statistics.

**Parameters**:
- `userId` (path): User identifier from Google OAuth2

**Response**:
```json
{
  "userId": "123456789",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "flashcardCount": 25,
  "freeGenerationLimit": 100,
  "regenerationLimit": 5
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Error Response** (Invalid User ID):
```json
{
  "error": "Invalid user ID"
}
```
Status: 400

---

**Endpoint**: `POST /api/user-data/{userId}`

**Description**: Update user profile information.

**Request Body**:
```json
{
  "userId": "123456789",
  "userName": "John Doe",
  "userEmail": "john@example.com"
}
```

**Response**: Returns updated user data

```json
{
  "userId": "123456789",
  "userName": "John Doe",
  "userEmail": "john@example.com",
  "flashcardCount": 25,
  "freeGenerationLimit": 100,
  "regenerationLimit": 5
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

### 5. Flashcard Generation Authorization

**Endpoint**: `POST /api/generate-flashcard`

**Description**: Check if user can generate flashcards based on usage limits.

**Request Body**:
```json
{
  "userId": "123456789",
  "isOwnCredits": false
}
```

**Response (Allowed)**:
```json
{
  "canGenerate": true
}
```

**Response (Limit Reached)**:
```json
{
  "canGenerate": false,
  "reason": "LIMIT_REACHED"
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Example Usage**:
```javascript
const response = await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/generate-flashcard', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: '123456789',
    isOwnCredits: false
  })
});
const data = await response.json();
if (data.canGenerate) {
  console.log('User can generate flashcards');
} else {
  console.log('Limit reached:', data.reason);
}
```

### 6. Increment Usage Count

**Endpoint**: `POST /api/increment-flashcard-count`

**Description**: Increment user's flashcard generation count after successful generation.

**Request Body**:
```json
{
  "userId": "123456789"
}
```

**Response**:
```json
{
  "success": true,
  "newCount": 26,
  "remainingCards": 74
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Example Usage**:
```javascript
const response = await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/increment-flashcard-count', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: '123456789'
  })
});
const data = await response.json();
console.log('New count:', data.newCount);
console.log('Remaining:', data.remainingCards);
```

### 7. OAuth2 Redirect Handler

**Endpoint**: `GET /oauth-redirect`

**Description**: Handle OAuth2 redirect from Google authentication flow.

**Parameters**: URL fragment contains `access_token`

**Response**: HTML page that posts the token back to the extension

```html
<html>
    <body>
        <script>
            if (window.opener) {
                window.opener.postMessage({token: "ACCESS_TOKEN_HERE"}, "*");
            } else {
                // For Firefox, we need to use browser.runtime.sendMessage
                browser.runtime.sendMessage({action: "auth_success", token: "ACCESS_TOKEN_HERE"});
            }
            window.close();
        </script>
    </body>
</html>
```

**Headers**:
```
Content-Type: text/html
```

**Error Response**:
```
Authentication failed
```
Status: 400

### 8. Connectivity Check

**Endpoint**: `GET /api/check-connectivity`

**Description**: Health check endpoint to verify backend connectivity.

**Response**:
```json
{
  "status": "online"
}
```

**Headers**:
```
Content-Type: application/json
Access-Control-Allow-Origin: *
```

**Example Usage**:
```javascript
const response = await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/check-connectivity');
const data = await response.json();
console.log('Backend status:', data.status);
```

## CORS Support

The backend implements full CORS support for cross-origin requests from browser extensions.

**Preflight Response** (`OPTIONS`):
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

**Standard Headers** (included in all responses):
```
Access-Control-Allow-Origin: *
Content-Type: application/json
```

## Error Handling

### HTTP Status Codes

- **200 OK**: Request successful
- **400 Bad Request**: Invalid parameters or malformed request
- **404 Not Found**: Endpoint not found
- **405 Method Not Allowed**: HTTP method not supported for endpoint

### Common Error Patterns

**Invalid User ID**:
```json
{
  "error": "Invalid user ID"
}
```

**API Failure**:
```json
{
  "result": null,
  "error": "Failed to fetch models from OpenAI"
}
```

**Limit Reached**:
```json
{
  "canGenerate": false,
  "reason": "LIMIT_REACHED"
}
```

## Rate Limiting

### Free Tier Limits

- **Flashcard Generation**: 100 cards per user
- **Regeneration Limit**: 5 regenerations per card
- **Storage**: User data stored in Cloudflare Workers KV

### Rate Limiting Logic

1. **Pre-generation Check**: `/api/generate-flashcard` verifies user has remaining quota
2. **Post-generation Increment**: `/api/increment-flashcard-count` updates usage count
3. **User Data Tracking**: Usage statistics stored per user ID
4. **Premium Override**: Users with `isOwnCredits: true` bypass limits

## Security Considerations

### API Key Management

- **Backend API Keys**: Stored as Cloudflare Workers environment variables
- **No Client Exposure**: API keys never exposed to browser extensions
- **Request Proxying**: All AI API calls proxied through backend

### Data Protection

- **Minimal Data Storage**: Only essential user information stored
- **KV Storage**: User data stored in Cloudflare Workers KV
- **No PII**: No sensitive personal information collected beyond OAuth2 profile

### CORS Security

- **Wildcard Origin**: Allows cross-origin requests from any extension
- **Method Restrictions**: Only allows GET, POST, OPTIONS methods
- **Header Validation**: Validates preflight requests properly

## Performance Characteristics

### Response Times

- **CORS Preflight**: ~10ms
- **User Data Operations**: ~50ms (KV read/write)
- **API Proxying**: Depends on upstream AI provider (200-2000ms)
- **Static Responses**: ~10ms (limits, connectivity)

### Scalability

- **Edge Computing**: Global distribution via Cloudflare Workers
- **Auto-scaling**: No capacity limits or manual scaling required
- **KV Storage**: Distributed, low-latency data storage
- **Connection Pooling**: Efficient HTTP request handling

## Integration Examples

### Complete Flashcard Generation Flow

```javascript
// 1. Check if user can generate flashcards
const canGenerate = await checkGenerationLimits(userId);
if (!canGenerate) {
  throw new Error('Usage limit reached');
}

// 2. Generate flashcard content via AI API
const flashcardData = await generateFlashcardContent(text, language);

// 3. Increment usage count
await incrementFlashcardCount(userId);

// 4. Save to Anki via AnkiConnect
await saveToAnki(flashcardData);

async function checkGenerationLimits(userId) {
  const response = await fetch('/api/generate-flashcard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, isOwnCredits: false })
  });
  const data = await response.json();
  return data.canGenerate;
}

async function generateFlashcardContent(text, language) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-2024-08-06',
      messages: [
        {
          role: 'user',
          content: `Create a flashcard for: ${text} (${language})`
        }
      ],
      response_format: { type: 'json_object' }
    })
  });
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function incrementFlashcardCount(userId) {
  const response = await fetch('/api/increment-flashcard-count', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  return await response.json();
}
```

This API reference provides complete information for integrating with the AnkiLingoFlash backend, including all endpoints, request/response formats, error handling, and security considerations.