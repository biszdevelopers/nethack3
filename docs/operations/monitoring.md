# Monitoring

## Health

- `GET /health` — process liveness, version, uptime.
- `GET /health/ready` — database readiness. Returns `503` and `status: "unavailable"` when the database check fails.

Health responses are `no-store`. Use them for container and proxy probes only.

## Logs

Fastify emits structured JSON logs with a request id on every request. Tokens, cookies, authorization headers, CSRF headers, and secret fields are redacted. Correlation id: `x-request-id` response header.

Do not log tokens, authorization codes, cookies, verifiers, secrets, or raw provider responses. Authentication failures log a private reason; the browser receives a generic message.

## Tracing

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to export OpenTelemetry traces. The API starts an OpenTelemetry Node SDK with an OTLP HTTP exporter and records request method, route, status, and request id. When the variable is unset, tracing is disabled without affecting requests.

## Metrics and alerting

Use the platform's metrics stack rather than a bespoke monitoring system. Minimum signals:

- API request rate, error rate, p95/p99 latency.
- Database connection saturation, slow queries, replication and backup status.
- Authentication success/failure counts, refresh failures, backchannel failures.
- Worker queue depth, oldest pending job, dead-letter count, retry rate.
- Public site Core Web Vitals and availability.
- Disk usage for uploaded files and backups.

Alert on sustained 5xx rates, readiness failures, authentication error spikes, growing dead-letter queues, and failed backups.

## Worker

The worker logs claims, completions, retries, dead-letter transitions, and session-refresh failures. A job that exhausts retries moves to `dead`; outbox events that exhaust attempts are retained with a `dead-lettered:` error prefix. Neither is silently discarded.

## Performance measurements

Record production measurements for LCP, INP, CLS, TTFB, API p95/p99, Lighthouse performance and accessibility, and worker latency. Store measured results with the release; do not claim targets without measurement.
