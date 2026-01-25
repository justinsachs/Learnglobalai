# Operations Runbook

This runbook provides procedures for operating, monitoring, and troubleshooting the LearnGlobal.ai backend system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Starting and Stopping Services](#starting-and-stopping-services)
3. [Health Checks](#health-checks)
4. [Monitoring](#monitoring)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)
7. [Disaster Recovery](#disaster-recovery)

## System Overview

### Components

| Component | Port | Description |
|-----------|------|-------------|
| API Server | 3000 | Main application server |
| Admin UI | 3001 | Web administration interface |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Job queue and cache |
| MinIO | 9000/9001 | Object storage (dev) |

### Dependencies

```
API Server
├── PostgreSQL (required)
├── Redis (required)
├── MinIO/S3 (required)
├── OpenAI API (required for content generation)
├── HeyGen API (optional, for video generation)
└── NotebookLM API (optional, for audio generation)
```

## Starting and Stopping Services

### Development Environment

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d api

# Stop all services
docker-compose down

# Stop with volume cleanup
docker-compose down -v

# Restart a service
docker-compose restart api

# View logs
docker-compose logs -f api
```

### Production Environment

```bash
# Start services
systemctl start learnglobal-api
systemctl start learnglobal-worker

# Stop services
systemctl stop learnglobal-api
systemctl stop learnglobal-worker

# Check status
systemctl status learnglobal-api

# View logs
journalctl -u learnglobal-api -f
```

### Graceful Shutdown

The API server handles SIGTERM gracefully:

1. Stops accepting new requests
2. Completes in-flight requests (30s timeout)
3. Finishes current job processing
4. Closes database connections
5. Exits with code 0

```bash
# Send graceful shutdown
kill -TERM $(pgrep -f learnglobal-api)

# Force kill (last resort)
kill -9 $(pgrep -f learnglobal-api)
```

## Health Checks

### API Health Endpoint

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok"
  }
}
```

### Deep Health Check

```bash
curl http://localhost:3000/health/deep
```

**Response:**
```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "ok",
      "latency": 5
    },
    "redis": {
      "status": "ok",
      "latency": 2
    },
    "storage": {
      "status": "ok",
      "latency": 15
    },
    "openai": {
      "status": "ok",
      "latency": 200
    }
  }
}
```

### Database Connection Test

```bash
PGPASSWORD=password psql -h localhost -U learnglobal -d learnglobal -c "SELECT 1"
```

### Redis Connection Test

```bash
redis-cli -h localhost ping
```

### MinIO/S3 Test

```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc ls local/learnglobal
```

## Monitoring

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `api_request_duration_seconds` | Request latency | p99 > 5s |
| `api_requests_total` | Request count | N/A |
| `api_errors_total` | Error count | > 10/min |
| `pipeline_runs_active` | Active pipeline runs | > 50 |
| `pipeline_state_duration_seconds` | Time in each state | varies |
| `job_queue_depth` | Pending jobs | > 100 |
| `db_connections_active` | Database connections | > 80% pool |
| `llm_tokens_used` | LLM token consumption | > 1M/day |

### Prometheus Queries

```promql
# API error rate
sum(rate(api_errors_total[5m])) / sum(rate(api_requests_total[5m]))

# Pipeline completion rate
sum(rate(pipeline_state_transitions_total{to_state="AUDIT_FINALIZED"}[1h]))

# Average pipeline duration
histogram_quantile(0.5, rate(pipeline_run_duration_seconds_bucket[1h]))

# Queue depth
job_queue_depth{queue="default"}
```

### Log Queries (Loki/CloudWatch)

```
# Find failed runs
{app="learnglobal-api"} |= "FAILED" | json

# Find slow LLM calls
{app="learnglobal-api"} | json | duration > 30s | label="llm"

# Find authentication failures
{app="learnglobal-api"} |= "auth" |= "failed"
```

### Alerting Rules

```yaml
groups:
  - name: learnglobal
    rules:
      - alert: HighErrorRate
        expr: sum(rate(api_errors_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High error rate detected

      - alert: PipelineStuck
        expr: pipeline_state_duration_seconds > 3600
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Pipeline run stuck in state

      - alert: DatabaseConnectionsHigh
        expr: db_connections_active / db_connections_max > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Database connection pool nearly exhausted
```

## Common Operations

### Running a Pipeline Manually

```bash
# Via API
curl -X POST http://localhost:3000/api/modules/{moduleId}/runs \
  -H "Authorization: Bearer $TOKEN"

# Check status
curl http://localhost:3000/api/runs/{runId} \
  -H "Authorization: Bearer $TOKEN"
```

### Resuming a Failed Pipeline

```bash
# Resume from failure point
curl -X POST http://localhost:3000/api/runs/{runId}/resume \
  -H "Authorization: Bearer $TOKEN"

# Rerun from specific state
curl -X POST http://localhost:3000/api/runs/{runId}/rerun \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fromState": "QA_PASSED"}'
```

### Database Migrations

```bash
# Run pending migrations
npm run migrate -w @learnglobal/api

# Check migration status
npm run migrate:status -w @learnglobal/api

# Rollback last migration
npm run migrate:rollback -w @learnglobal/api
```

### Clearing the Job Queue

```bash
# Clear all pending jobs (careful!)
redis-cli FLUSHDB

# Clear specific queue
redis-cli DEL bull:default:wait
redis-cli DEL bull:default:active
```

### Rotating Secrets

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update environment variable
export JWT_SECRET_NEW=$NEW_SECRET

# 3. Deploy with both secrets active
# (application supports multiple secrets during rotation)

# 4. After token expiration period, remove old secret
unset JWT_SECRET_OLD
```

### Exporting Audit Logs

```bash
# Export to JSON
curl "http://localhost:3000/api/admin/audit/export?from=2024-01-01&to=2024-01-31" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o audit-january.json

# Export to CSV
curl "http://localhost:3000/api/admin/audit/export?format=csv&from=2024-01-01" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o audit-january.csv
```

## Troubleshooting

### Pipeline Stuck in State

**Symptoms:** Run status shows same state for extended period

**Diagnosis:**
```bash
# Check run details
curl http://localhost:3000/api/runs/{runId}

# Check job queue
redis-cli LLEN bull:default:wait
redis-cli LLEN bull:default:active

# Check for errors in logs
docker-compose logs api | grep {runId}
```

**Resolution:**
1. Check if external API (HeyGen, NotebookLM) is responding
2. Check if LLM API has quota remaining
3. Resume the run: `POST /api/runs/{runId}/resume`
4. If stuck in video generation, check HeyGen dashboard

### High Memory Usage

**Symptoms:** API server using excessive memory

**Diagnosis:**
```bash
# Check process memory
docker stats learnglobal-api

# Check for memory leaks
curl http://localhost:3000/debug/memory
```

**Resolution:**
1. Restart the service: `docker-compose restart api`
2. Check for large file uploads in memory
3. Review recent code changes for leaks

### Database Connection Exhaustion

**Symptoms:** "too many connections" errors

**Diagnosis:**
```sql
SELECT count(*) FROM pg_stat_activity WHERE datname = 'learnglobal';
SELECT * FROM pg_stat_activity WHERE datname = 'learnglobal' AND state = 'idle';
```

**Resolution:**
1. Increase `max_connections` in PostgreSQL
2. Reduce connection pool size per instance
3. Kill idle connections:
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'learnglobal'
AND state = 'idle'
AND state_change < now() - interval '10 minutes';
```

### LLM Rate Limiting

**Symptoms:** 429 errors from OpenAI

**Diagnosis:**
```bash
# Check token usage
curl http://localhost:3000/api/admin/metrics/llm
```

**Resolution:**
1. Implement backoff (already built-in)
2. Reduce concurrent pipeline runs
3. Contact OpenAI for rate limit increase
4. Switch to different model tier

### Content Quality Failures

**Symptoms:** Runs failing at QA_PASSED state

**Diagnosis:**
```bash
# Get QA report
curl http://localhost:3000/api/runs/{runId}/qa-report
```

**Resolution:**
1. Review QA report for specific failures
2. Adjust content constraints in module spec
3. Regenerate from OUTLINE_GENERATED state
4. Update prompt templates if systematic issue

### Storage Issues

**Symptoms:** Upload failures, missing artifacts

**Diagnosis:**
```bash
# Check storage connectivity
mc ls local/learnglobal

# Check disk space
df -h /data

# Check bucket permissions
mc policy get local/learnglobal
```

**Resolution:**
1. Verify S3/MinIO credentials
2. Check bucket exists and has write permissions
3. Increase disk space if needed
4. Re-upload failed artifacts

## Disaster Recovery

### Database Backup

```bash
# Create backup
pg_dump -h localhost -U learnglobal learnglobal > backup-$(date +%Y%m%d).sql

# Restore backup
psql -h localhost -U learnglobal learnglobal < backup-20240115.sql
```

### Point-in-Time Recovery

```bash
# Requires WAL archiving enabled
pg_restore --target-time="2024-01-15 10:00:00" ...
```

### Storage Backup

```bash
# Sync to backup location
mc mirror local/learnglobal backup/learnglobal

# Restore from backup
mc mirror backup/learnglobal local/learnglobal
```

### Full System Recovery

1. **Restore infrastructure** (database, redis, storage)
2. **Verify connectivity** to all services
3. **Run health checks** on API
4. **Resume any interrupted runs**
5. **Verify data integrity** with checksums
6. **Notify stakeholders** of recovery completion

### Recovery Time Objectives

| Component | RTO | RPO |
|-----------|-----|-----|
| API Server | 5 min | 0 (stateless) |
| Database | 30 min | 1 hour |
| Object Storage | 1 hour | 24 hours |
| Full System | 2 hours | 24 hours |

## Contact and Escalation

| Level | Contact | Response Time |
|-------|---------|---------------|
| L1 | ops@learnglobal.ai | 15 min |
| L2 | engineering@learnglobal.ai | 1 hour |
| L3 | cto@learnglobal.ai | 4 hours |

### Escalation Triggers

- Service unavailable > 5 minutes → L2
- Data loss detected → L2 + L3
- Security incident → L2 + L3 + security@learnglobal.ai
- Customer-impacting issue > 30 minutes → L3
