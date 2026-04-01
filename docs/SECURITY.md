# Security Model

This document describes the security architecture, authentication, authorization, and audit mechanisms for the LearnGlobal.ai backend system.

## Authentication

### JWT-Based Authentication

All API endpoints (except health checks) require JWT authentication.

```
Authorization: Bearer <jwt-token>
```

**Token Structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@company.com",
  "roles": ["admin", "content-creator"],
  "verticals": ["medviro", "clearclaims"],
  "iat": 1704067200,
  "exp": 1704153600
}
```

**Token Lifecycle:**
- Access tokens expire after 24 hours
- Refresh tokens expire after 7 days
- Tokens are invalidated on password change
- Tokens can be revoked via admin API

### API Key Authentication

For service-to-service communication and integrations:

```
X-API-Key: <api-key>
```

API keys are:
- Scoped to specific operations
- Tied to a vertical/organization
- Rotatable without downtime
- Logged for audit purposes

## Authorization

### Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| `super-admin` | Full system access, manage verticals |
| `admin` | Manage modules, runs, users within vertical |
| `content-creator` | Create and edit modules, start runs |
| `reviewer` | Review and approve content, view runs |
| `viewer` | Read-only access to modules and runs |

### Vertical Isolation

Users are scoped to specific verticals. A user with access to "medviro" cannot access "clearclaims" data unless explicitly granted.

```typescript
// Middleware enforces vertical access
async function enforceVerticalAccess(req, reply) {
  const userVerticals = req.user.verticals;
  const requestedVertical = req.params.verticalId;

  if (!userVerticals.includes(requestedVertical)) {
    throw new ForbiddenError('Access denied to vertical');
  }
}
```

### Resource-Level Permissions

Fine-grained permissions on resources:

```json
{
  "resource": "module:uuid-123",
  "permissions": {
    "read": ["admin", "content-creator", "reviewer", "viewer"],
    "write": ["admin", "content-creator"],
    "delete": ["admin"],
    "approve": ["admin", "reviewer"],
    "publish": ["admin"]
  }
}
```

## Secrets Management

### Environment Variables

Sensitive configuration stored in environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `JWT_SECRET` | Token signing key (32+ bytes) | Yes |
| `ENCRYPTION_KEY` | Data encryption key (32 bytes hex) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `OPENAI_API_KEY` | LLM provider key | Yes |
| `HEYGEN_API_KEY` | Video generation key | For production |
| `S3_SECRET_KEY` | Object storage credentials | Yes |

### Secret Rotation

1. **JWT Secret Rotation:**
   - Support for multiple active secrets during rotation
   - Old tokens remain valid until expiration
   - New tokens signed with new secret

2. **API Key Rotation:**
   - Create new key before revoking old
   - Grace period for migration
   - Audit log captures rotation events

3. **Database Credentials:**
   - Use connection pooler with credential refresh
   - Support for IAM-based authentication in cloud deployments

### Encrypted Storage

Sensitive data encrypted at rest:

```typescript
// Fields encrypted in database
const encryptedFields = [
  'connector_credentials',
  'api_keys',
  'user_pii'
];

// Encryption using AES-256-GCM
function encrypt(plaintext: string, key: Buffer): EncryptedData {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}
```

## Audit Logging

### What Gets Logged

Every significant action generates an audit event:

| Event Type | Data Captured |
|------------|---------------|
| `auth.login` | User ID, IP, user agent, success/failure |
| `auth.logout` | User ID, token revoked |
| `module.create` | User, module ID, vertical |
| `module.update` | User, module ID, changed fields |
| `run.start` | User, run ID, module ID |
| `run.state_change` | Run ID, from state, to state, duration |
| `run.fail` | Run ID, error message, stack trace |
| `approval.request` | User, resource, approval type |
| `approval.grant` | Approver, resource, conditions |
| `publish.lms` | Run ID, LMS course ID, assets published |
| `connector.call` | Connector type, operation, success/failure |
| `admin.user_modify` | Admin user, target user, changes |

### Audit Event Structure

```json
{
  "id": "evt_abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "eventType": "run.state_change",
  "actor": {
    "type": "user",
    "id": "user-uuid",
    "email": "user@company.com"
  },
  "resource": {
    "type": "run",
    "id": "run-uuid"
  },
  "context": {
    "ip": "192.168.1.1",
    "userAgent": "Mozilla/5.0...",
    "requestId": "req-uuid"
  },
  "data": {
    "fromState": "SOURCEPACK_GENERATED",
    "toState": "QA_PASSED",
    "duration": 45000
  },
  "metadata": {
    "verticalId": "medviro",
    "moduleId": "module-uuid"
  }
}
```

### Log Retention

- Audit logs retained for 7 years (compliance requirement)
- Searchable via admin API
- Exportable for compliance audits
- Immutable once written (append-only)

### Log Redaction

Sensitive data automatically redacted:

```typescript
const redactionPatterns = [
  { pattern: /sk-[a-zA-Z0-9]{48}/, replacement: 'sk-[REDACTED]' },
  { pattern: /password["\s:]+[^,}\s]+/gi, replacement: 'password: [REDACTED]' },
  { pattern: /bearer\s+[a-zA-Z0-9._-]+/gi, replacement: 'Bearer [REDACTED]' }
];
```

## Network Security

### TLS/HTTPS

- All external traffic over HTTPS (TLS 1.3)
- Internal service communication over TLS
- Certificate rotation via Let's Encrypt or AWS ACM

### Rate Limiting

```typescript
const rateLimits = {
  'api.general': { requests: 100, window: '1m' },
  'api.auth': { requests: 10, window: '1m' },
  'api.llm': { requests: 20, window: '1m' },
  'api.upload': { requests: 5, window: '1m', maxSize: '100MB' }
};
```

### IP Allowlisting

Optional IP allowlist for admin endpoints:

```
ADMIN_ALLOWED_IPS=10.0.0.0/8,192.168.1.0/24
```

## Input Validation

### Request Validation

All inputs validated using Zod schemas:

```typescript
const createModuleSchema = z.object({
  verticalId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional()
});

// Automatic validation middleware
app.post('/modules', {
  schema: { body: createModuleSchema },
  handler: createModuleHandler
});
```

### SQL Injection Prevention

- All queries use parameterized statements (Drizzle ORM)
- No raw SQL concatenation
- Input sanitization for search queries

### XSS Prevention

- HTML output escaped
- Content-Security-Policy headers
- No inline scripts in admin UI

## Data Protection

### Personal Data Handling

- PII minimized where possible
- Encrypted in transit and at rest
- Access logged for compliance
- Deletion available via API

### Data Classification

| Classification | Examples | Handling |
|----------------|----------|----------|
| Public | Module titles, descriptions | Standard storage |
| Internal | Generated content, scripts | Encrypted at rest |
| Confidential | API keys, credentials | Encrypted, access logged |
| Restricted | PII, audit logs | Encrypted, immutable, long retention |

### Data Retention

| Data Type | Retention | Deletion |
|-----------|-----------|----------|
| Module content | Indefinite | Manual request |
| Run artifacts | 1 year after completion | Automated |
| Audit logs | 7 years | Not deletable |
| User sessions | 30 days | Automated |
| Temporary files | 24 hours | Automated |

## Incident Response

### Security Event Detection

Monitoring for:
- Failed authentication attempts (>5 in 5 minutes)
- Unusual API access patterns
- Privilege escalation attempts
- Data exfiltration indicators

### Response Procedures

1. **Detection**: Automated alerting via monitoring
2. **Containment**: Revoke tokens, block IPs
3. **Investigation**: Audit log analysis
4. **Recovery**: Rotate affected credentials
5. **Post-mortem**: Document and improve

### Contact

Security issues should be reported to: security@learnglobal.ai

## Compliance

### Standards Supported

- SOC 2 Type II (in progress)
- GDPR (data handling procedures)
- HIPAA (for healthcare verticals)
- OSHA record-keeping requirements

### Audit Support

- Complete audit trail for all operations
- Exportable logs in standard formats
- Evidence collection automation
- Compliance dashboard in admin UI
