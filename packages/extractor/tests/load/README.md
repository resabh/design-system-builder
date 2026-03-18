# Load Testing Documentation

## Overview

This directory contains load tests for the Design System Extractor. These tests verify the system can handle concurrent extractions and identify performance bottlenecks.

## Test Categories

### 1. Concurrent Extraction Performance
Tests the system's ability to handle multiple simultaneous extractions:
- **5 concurrent extractions** - Basic concurrent load
- **10 concurrent extractions** - Moderate concurrent load
- **Sequential extractions** - Baseline performance comparison

### 2. Resource Management Under Load
Verifies proper resource cleanup and error handling:
- **Memory leak detection** - Monitors heap growth during repeated extractions
- **Failure recovery** - Tests graceful degradation under timeout/errors
- **Browser cleanup** - Ensures browsers close properly even under load

### 3. Rate Limiting Under Load
Tests rate limiting behavior with concurrent requests:
- **Concurrent rate limit enforcement** - Verifies limits apply across requests
- **Throughput measurement** - Measures actual request rate

### 4. Performance Benchmarks
Establishes performance SLAs:
- **Average response time** - Target: < 10 seconds
- **P95 response time** - Target: < 15 seconds
- **Throughput** - Extractions per second under load

## Running Load Tests

### Run All Load Tests

```bash
# From project root
npm run test:load

# Or from extractor package
cd packages/extractor
npm test -- tests/load/
```

### Run Specific Test Suite

```bash
# Concurrent extraction tests only
npm test -- tests/load/concurrent-extraction.test.ts

# With verbose output
npm test -- tests/load/concurrent-extraction.test.ts -t "concurrent"
```

### Run with Memory Profiling

To enable garbage collection and memory profiling:

```bash
# Run with GC exposed
node --expose-gc node_modules/.bin/jest tests/load/

# Generate heap snapshot
node --inspect --expose-gc node_modules/.bin/jest tests/load/
```

## Performance Targets

### Mock Provider (Load Tests)
These targets apply when using the LoadTestMockProvider:

| Metric | Target | Notes |
|--------|--------|-------|
| Avg Extraction Time | < 10s | Single extraction |
| P95 Extraction Time | < 15s | 95th percentile |
| 5 Concurrent Extractions | < 30s | Total duration |
| 10 Concurrent Extractions | < 60s | Total duration |
| Memory Growth | < 100MB | Per 15 extractions |
| Throughput | > 0.5/sec | Under concurrent load |

### Real Provider (Production)
These targets apply with actual LLM providers:

| Metric | Target | Notes |
|--------|--------|-------|
| Avg Extraction Time | < 60s | Includes API latency |
| P95 Extraction Time | < 120s | 95th percentile |
| API Rate Limit | 50/min | Configurable |
| Cost per Session | < $5 | Configurable |
| Browser Memory | < 500MB | Per browser instance |

## Test Scenarios

### Scenario 1: Burst Traffic
Simulates sudden spike in extraction requests:
```typescript
// 10 concurrent requests all at once
const promises = Array.from({ length: 10 }, () =>
  extractor.extract('https://example.com')
);
await Promise.all(promises);
```

### Scenario 2: Sustained Load
Simulates steady stream of requests:
```typescript
// Sequential extractions over time
for (let i = 0; i < 20; i++) {
  await extractor.extract('https://example.com');
}
```

### Scenario 3: Mixed Load
Simulates realistic traffic pattern:
```typescript
// Batches of concurrent requests with gaps
for (let batch = 0; batch < 5; batch++) {
  const promises = Array.from({ length: 3 }, () =>
    extractor.extract('https://example.com')
  );
  await Promise.all(promises);
  await sleep(5000); // 5s gap between batches
}
```

## Interpreting Results

### Console Output

Load tests print detailed metrics:

```
5 concurrent extractions:
  Duration: 8432ms
  API calls: 15
  Avg API latency: 152.34ms
```

- **Duration** - Total wall clock time for test
- **API calls** - Number of LLM API requests made
- **Avg API latency** - Average response time per API call

### Memory Metrics

```
Memory usage after 15 extractions:
  Heap growth: 12.45 MB
  RSS growth: 18.23 MB
```

- **Heap growth** - JavaScript heap increase (should be minimal)
- **RSS growth** - Resident Set Size (total memory including buffers)

Acceptable growth: < 100MB heap per 15 extractions

### Performance Metrics

```
Performance SLA metrics:
  Average: 4523.45ms
  P95: 6234.12ms
  Min: 3892.34ms
  Max: 7123.56ms
```

- **Average** - Mean extraction time
- **P95** - 95th percentile (most requests faster than this)
- **Min/Max** - Range of extraction times

## Common Issues

### Test Timeouts

If tests timeout, try:
1. Increase Jest timeout in test file
2. Reduce number of concurrent extractions
3. Check for browser cleanup issues

### High Memory Usage

If memory growth is excessive:
1. Check browser instances are closing
2. Verify no circular references
3. Run with `--expose-gc` flag

### Inconsistent Results

Load test results may vary due to:
- System resource availability
- Background processes
- Network conditions (if not mocked)
- Random latency in mock provider

Run tests multiple times to establish baseline.

## CI/CD Integration

Load tests are **not** run in CI by default due to:
- Long execution time
- Resource intensive
- Variable results

To run in CI, add to workflow:

```yaml
- name: Run load tests
  run: npm run test:load
  if: github.event_name == 'release'
```

## Local Development

### Quick Load Test

```bash
# Fast load test (5 concurrent)
npm test -- tests/load/ -t "5 concurrent"

# Full load test suite
npm run test:load
```

### Continuous Load Testing

For extended load testing:

```bash
# Run load tests in watch mode
npm test -- tests/load/ --watch

# Run with coverage
npm test -- tests/load/ --coverage
```

## Monitoring and Alerts

### Metrics to Monitor

1. **Extraction Duration** - Track P50, P95, P99
2. **Error Rate** - Failed extractions / total
3. **Memory Usage** - Heap size over time
4. **API Costs** - Total cost per session
5. **Rate Limit Hits** - Requests throttled

### Setting Up Alerts

Example metrics to alert on:
- P95 extraction time > 120s (real provider)
- Error rate > 10%
- Memory growth > 200MB/15 extractions
- Cost per session > $10

## Further Reading

- [Jest Performance Testing](https://jestjs.io/docs/timer-mocks)
- [Node.js Memory Management](https://nodejs.org/en/docs/guides/simple-profiling/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Load Testing Best Practices](https://github.com/playcanvas/playcanvas-engine/wiki/Load-Testing)

## Contributing

When adding new load tests:

1. Follow existing test structure
2. Document expected behavior
3. Set reasonable timeouts
4. Include performance metrics
5. Update this README
