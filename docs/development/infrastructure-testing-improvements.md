# Infrastructure Testing Improvements Roadmap

## Overview

This document outlines planned improvements for testing infrastructure and Docker components in the macro-ai monorepo. It
focuses on enhancing test coverage and reliability for AWS CDK infrastructure code and ECS container deployments.

## Table of Contents

1. [CDK Infrastructure Testing](#cdk-infrastructure-testing)
2. [Docker Container Testing](#docker-container-testing)
3. [Implementation Roadmap](#implementation-roadmap)
4. [Testing Strategy](#testing-strategy)

---

## CDK Infrastructure Testing

### Current State Analysis

The `/infrastructure` package currently lacks comprehensive testing, leaving potential issues undetected until deployment.
We need to implement multiple levels of testing to ensure infrastructure reliability.

### Recommended Testing Packages

#### 🔹 1. Unit Testing CDK Constructs

**Purpose**: Test synthesized CloudFormation templates to ensure constructs create correct resources.

**Key Packages**:

- **`aws-cdk-lib/assertions`** (official, built-in)
- **`jest-cdk-snapshot`** (optional, for snapshot testing)

##### aws-cdk-lib/assertions Implementation

```typescript
import { Template } from 'aws-cdk-lib/assertions'
import { App, Stack } from 'aws-cdk-lib'
import { NetworkingConstruct } from '../src/constructs/NetworkingConstruct'

describe('NetworkingConstruct', () => {
	test('creates a VPC with correct configuration', () => {
		const app = new App()
		const stack = new Stack(app, 'TestStack')
		new NetworkingConstruct(stack, 'Networking', {
			environmentName: 'dev',
			vpcCidr: '10.0.0.0/16',
		})

		const template = Template.fromStack(stack)

		// Test VPC creation
		template.hasResourceProperties('AWS::EC2::VPC', {
			CidrBlock: '10.0.0.0/16',
			EnableDnsHostnames: true,
			EnableDnsSupport: true,
		})

		// Test subnet counts
		template.resourceCountIs('AWS::EC2::Subnet', 6) // 3 public + 3 private

		// Test security group creation
		template.hasResourceProperties('AWS::EC2::SecurityGroup', {
			GroupDescription: 'ALB Security Group',
			SecurityGroupEgress: [
				{
					CidrIp: '0.0.0.0/0',
					IpProtocol: '-1',
				},
			],
		})
	})

	test('creates ALB with HTTPS listener', () => {
		const app = new App()
		const stack = new Stack(app, 'TestStack')
		new NetworkingConstruct(stack, 'Networking', {
			environmentName: 'dev',
		})

		const template = Template.fromStack(stack)

		template.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', {
			Protocol: 'HTTPS',
			Port: 443,
		})
	})
})
```

##### jest-cdk-snapshot Implementation

```typescript
import { App, Stack } from 'aws-cdk-lib'
import { NetworkingConstruct } from '../src/constructs/NetworkingConstruct'

describe('NetworkingConstruct Snapshots', () => {
	test('matches expected CloudFormation template', () => {
		const app = new App()
		const stack = new Stack(app, 'TestStack')
		new NetworkingConstruct(stack, 'Networking', {
			environmentName: 'dev',
		})

		// Snapshot the entire synthesized template
		expect(stack).toMatchCdkSnapshot()
	})
})
```

#### 🔹 2. Integration Testing

**Purpose**: Test resource interconnections and configurations without deployment.

**Key Packages**:

- **`cdk-nag`** (security and best practices validation)
- **`constructs`** (construct testing utilities)

##### cdk-nag Implementation

```typescript
import { App, Aspects } from 'aws-cdk-lib'
import { AwsSolutionsChecks } from 'cdk-nag'
import { NetworkingConstruct } from '../src/constructs/NetworkingConstruct'

describe('NetworkingConstruct Security', () => {
	test('passes security best practices', () => {
		const app = new App()

		// Add cdk-nag security checks
		Aspects.of(app).add(new AwsSolutionsChecks())

		const stack = new Stack(app, 'TestStack')
		new NetworkingConstruct(stack, 'Networking', {
			environmentName: 'dev',
		})

		// This will throw if security violations are found
		app.synth()
	})
})
```

#### 🔹 3. Post-Deployment Testing

**Purpose**: Validate deployed infrastructure works correctly in AWS.

**Key Packages**:

- **`aws-sdk-client-mock`** (AWS SDK mocking)
- **`localstack`** (local AWS cloud simulation)

##### aws-sdk-client-mock Implementation

```typescript
import { mockClient } from 'aws-sdk-client-mock'
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { ECSClient, DescribeServicesCommand } from '@aws-sdk/client-ecs'
import { ParameterStoreService } from '../src/services/ParameterStoreService'

describe('ParameterStoreService', () => {
	const ssmMock = mockClient(SSMClient)
	const ecsMock = mockClient(ECSClient)

	beforeEach(() => {
		ssmMock.reset()
		ecsMock.reset()
	})

	test('retrieves parameter value correctly', async () => {
		ssmMock.on(GetParameterCommand).resolves({
			Parameter: {
				Name: '/dev/database/url',
				Value: 'postgresql://localhost:5432/mydb',
				Type: 'String',
			},
		})

		const service = new ParameterStoreService()
		const value = await service.getParameter('/dev/database/url')

		expect(value).toBe('postgresql://localhost:5432/mydb')
	})

	test('handles parameter not found', async () => {
		ssmMock.on(GetParameterCommand).rejects({
			name: 'ParameterNotFound',
			message: 'Parameter not found',
		})

		const service = new ParameterStoreService()

		await expect(service.getParameter('/nonexistent/param')).rejects.toThrow(
			'Parameter not found',
		)
	})
})
```

---

## Docker Container Testing

### Current State Analysis

The `express-api` Docker containers lack comprehensive testing, leading to potential runtime issues in ECS deployments.

### Recommended Testing Packages

#### 🔹 Container Testing with Testcontainers

**Purpose**: Test Docker containers in isolated environments before ECS deployment.

**Key Package**: **`testcontainers`**

##### Testcontainers Implementation

```typescript
import { GenericContainer, Wait } from 'testcontainers'
import fetch from 'node-fetch'

describe('Express API Container', () => {
	let container: GenericContainer

	beforeAll(async () => {
		container = await new GenericContainer('macro-ai/express-api:latest')
			.withExposedPorts(3000)
			.withEnvironment({
				NODE_ENV: 'test',
				PORT: '3000',
			})
			.withWaitStrategy(Wait.forHttp('/health', 3000))
			.start()
	}, 60000) // Extended timeout for container startup

	afterAll(async () => {
		if (container) {
			await container.stop()
		}
	})

	test('container starts and serves health endpoint', async () => {
		const url = `http://${container.getHost()}:${container.getMappedPort(3000)}/health`
		const response = await fetch(url)
		const body = await response.json()

		expect(response.status).toBe(200)
		expect(body).toHaveProperty('status', 'healthy')
		expect(body).toHaveProperty('timestamp')
	})

	test('container handles API requests', async () => {
		const url = `http://${container.getHost()}:${container.getMappedPort(3000)}/api/users`
		const response = await fetch(url)

		expect(response.status).toBe(200)
		const users = await response.json()
		expect(Array.isArray(users)).toBe(true)
	})

	test('container has correct environment variables', async () => {
		const url = `http://${container.getHost()}:${container.getMappedPort(3000)}/debug/env`
		const response = await fetch(url)
		const env = await response.json()

		expect(env.NODE_ENV).toBe('test')
		expect(env.PORT).toBe('3000')
	})
})
```

##### Advanced Container Testing

```typescript
import { GenericContainer, Network } from 'testcontainers'
import { PostgreSqlContainer } from 'testcontainers'

describe('Express API with Database Integration', () => {
	let network: Network
	let postgresContainer: PostgreSqlContainer
	let apiContainer: GenericContainer

	beforeAll(async () => {
		// Create a network for container communication
		network = await new Network().start()

		// Start PostgreSQL container
		postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
			.withNetwork(network)
			.withNetworkAliases('postgres')
			.withDatabase('testdb')
			.withUsername('testuser')
			.withPassword('testpass')
			.start()

		// Start API container with database connection
		apiContainer = await new GenericContainer('macro-ai/express-api:latest')
			.withNetwork(network)
			.withEnvironment({
				NODE_ENV: 'test',
				DATABASE_URL: `postgresql://testuser:testpass@postgres:5432/testdb`,
			})
			.withExposedPorts(3000)
			.withWaitStrategy(Wait.forHttp('/health', 3000))
			.start()
	}, 120000)

	afterAll(async () => {
		if (apiContainer) await apiContainer.stop()
		if (postgresContainer) await postgresContainer.stop()
		if (network) await network.stop()
	})

	test('API can connect to database', async () => {
		const url = `http://${apiContainer.getHost()}:${apiContainer.getMappedPort(3000)}/api/test-db-connection`
		const response = await fetch(url)
		const result = await response.json()

		expect(response.status).toBe(200)
		expect(result.databaseConnected).toBe(true)
	})

	test('API can perform database operations', async () => {
		// Test user creation
		const createUrl = `http://${apiContainer.getHost()}:${apiContainer.getMappedPort(3000)}/api/users`
		const createResponse = await fetch(createUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: 'test@example.com',
				firstName: 'Test',
				lastName: 'User',
			}),
		})

		expect(createResponse.status).toBe(201)
		const createdUser = await createResponse.json()

		// Test user retrieval
		const getUrl = `http://${apiContainer.getHost()}:${apiContainer.getMappedPort(3000)}/api/users/${createdUser.id}`
		const getResponse = await fetch(getUrl)
		const retrievedUser = await getResponse.json()

		expect(getResponse.status).toBe(200)
		expect(retrievedUser.email).toBe('test@example.com')
	})
})
```

---

## Implementation Roadmap

### Phase 1: Foundation Setup (Week 1-2)

#### Infrastructure Testing Setup

1. **Install Testing Dependencies**

   ```bash
   cd infrastructure
   pnpm add -D aws-cdk-lib vitest @types/node
   pnpm add -D aws-sdk-client-mock testcontainers
   pnpm add -D cdk-nag jest-cdk-snapshot
   ```

2. **Create Test Infrastructure**

   ```bash
   mkdir -p src/__tests__ test
   # Create vitest.config.ts
   # Create test setup files
   ```

3. **Basic CDK Unit Tests**
   - Test NetworkingConstruct VPC creation
   - Test ECSConstruct cluster configuration
   - Test ParameterStoreConstruct parameter handling

#### Docker Testing Setup

1. **Install Testcontainers**

   ```bash
   cd apps/express-api
   pnpm add -D testcontainers
   ```

2. **Create Docker Test Utilities**

   ```bash
   mkdir -p src/__tests__/docker
   # Create container test helpers
   ```

### Phase 2: Core Implementation (Week 3-4)

#### Infrastructure Tests

1. **CDK Construct Tests**
   - NetworkingConstruct (VPC, subnets, security groups)
   - ECSConstruct (cluster, services, tasks)
   - ParameterStoreConstruct (parameters, secrets)

2. **Integration Tests**
   - Cross-construct dependencies
   - Security group rules validation
   - IAM policy attachments

#### Docker Tests

1. **Container Health Tests**
   - Health endpoint validation
   - Environment variable verification
   - Port availability testing

2. **API Functionality Tests**
   - Basic endpoint responses
   - Authentication flows
   - Database connectivity

### Phase 3: Advanced Features (Week 5-6)

#### Infrastructure Tests

1. **Security Testing**
   - cdk-nag rule validation
   - IAM policy least-privilege verification
   - Network security configuration

2. **Performance Testing**
   - CloudFormation template size validation
   - Resource count limits
   - Cost estimation validation

#### Docker Tests

1. **Integration Testing**
   - Database connectivity tests
   - External service integration
   - Multi-container scenarios

2. **Performance Testing**
   - Container startup time
   - Memory usage validation
   - Response time benchmarks

### Phase 4: CI/CD Integration (Week 7-8)

1. **GitHub Actions Setup**
   - Infrastructure test workflows
   - Docker build and test pipelines
   - Pre-deployment validation

2. **Quality Gates**
   - Test coverage requirements
   - Security scan integration
   - Performance benchmark validation

---

## Testing Strategy

### Test Organization

```text
infrastructure/
├── src/
│   ├── __tests__/
│   │   ├── constructs/          # CDK construct unit tests
│   │   ├── integration/         # Cross-construct integration tests
│   │   └── security/            # Security and compliance tests
│   └── constructs/
│       ├── NetworkingConstruct.ts
│       ├── ECSConstruct.ts
│       └── ParameterStoreConstruct.ts
└── test/
    ├── fixtures/                # Test data and fixtures
    └── utils/                   # Test utilities and helpers
```

### Test Execution Strategy

1. **Unit Tests**: Run on every commit
2. **Integration Tests**: Run on PR creation
3. **Security Tests**: Run on PR creation and nightly
4. **Docker Tests**: Run on Docker image builds

### Quality Metrics

- **Unit Test Coverage**: 90%+ for construct logic
- **Integration Test Coverage**: 100% for critical paths
- **Security Compliance**: 100% cdk-nag rules passing
- **Docker Test Coverage**: All critical endpoints tested

### Maintenance Guidelines

1. **Keep Tests in Sync**: Update tests when infrastructure changes
2. **Use Descriptive Names**: Test names should explain what they're validating
3. **Isolate Test Concerns**: Each test should focus on a single aspect
4. **Use Realistic Data**: Test with production-like configurations
5. **Document Test Purpose**: Comments explaining why each test exists

---

## Next Steps

1. **Review and approve** this testing improvement plan
2. **Schedule implementation phases** based on team capacity
3. **Set up initial test infrastructure** for Phase 1
4. **Begin with high-impact tests** (NetworkingConstruct, container health)
5. **Monitor test effectiveness** and adjust strategy as needed

This roadmap provides a structured approach to significantly improve infrastructure and Docker testing reliability while
maintaining development velocity.

---

## Additional Future Improvements

### 🔹 1. End-to-End Testing Strategy

**Purpose**: Test complete user journeys across the entire application stack.

**Recommended Tools**:

- **`playwright`** or **`cypress`** for browser automation
- **`testcontainers`** for full-stack testing with real services

**Key Improvements**:

- User registration and login flows
- Complete chat workflows (create, send, stream, persist)
- Payment processing workflows (if applicable)
- Admin panel functionality
- Cross-browser compatibility testing

**Example Implementation**:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
	testDir: './e2e',
	use: {
		baseURL: 'http://localhost:3000',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
		{ name: 'firefox', use: { browserName: 'firefox' } },
		{ name: 'webkit', use: { browserName: 'webkit' } },
	],
})
```

### 🔹 2. API Contract Testing

**Purpose**: Ensure frontend and backend maintain compatible API contracts.

**Recommended Tools**:

- **`pact`** or **`pact-js`** for consumer-driven contract testing
- **`swagger-test-templates`** for OpenAPI compliance

**Key Improvements**:

- Frontend-backend contract validation
- API versioning compatibility
- Breaking change detection
- Schema validation across services

### 🔹 3. Performance Testing Enhancements

**Purpose**: Validate application performance under various conditions.

**Recommended Tools**:

- **`k6`** for load testing and performance monitoring
- **`lighthouse-ci`** for frontend performance metrics
- **`artillery`** for API load testing

**Key Improvements**:

- API response time validation
- Database query performance monitoring
- Frontend bundle size optimization
- Memory leak detection in long-running processes

### 🔹 4. Security Testing Expansion

**Purpose**: Comprehensive security validation beyond infrastructure.

**Recommended Tools**:

- **`owasp-zap`** for API security scanning
- **`snyk`** for dependency vulnerability scanning
- **`trufflehog`** for secrets detection in codebase

**Key Improvements**:

- API endpoint security testing
- Authentication flow security validation
- Input sanitization and injection prevention
- CORS configuration validation
- Rate limiting effectiveness testing

### 🔹 5. Accessibility Testing

**Purpose**: Ensure application accessibility compliance.

**Recommended Tools**:

- **`axe-core`** with **`@testing-library/jest-dom`** for component testing
- **`pa11y`** for automated accessibility scanning
- **`cypress-axe`** for E2E accessibility testing

**Key Improvements**:

- WCAG compliance validation
- Screen reader compatibility
- Keyboard navigation testing
- Color contrast verification
- Focus management validation

### 🔹 6. Visual Regression Testing

**Purpose**: Detect unintended visual changes in UI components.

**Recommended Tools**:

- **`chromatic`** (Storybook integration)
- **`playwright-visual-comparison`**
- **`cypress-visual-regression`**

**Key Improvements**:

- Component visual consistency
- Cross-browser visual differences
- Responsive design validation
- Design system compliance

### 🔹 7. Database Testing Strategy

**Purpose**: Comprehensive database testing beyond basic integration tests.

**Recommended Tools**:

- **`pg-testcontainers`** for PostgreSQL testing
- **`testcontainers`** for multi-database scenarios
- **`database-cleaner`** for test isolation

**Key Improvements**:

- Schema migration testing
- Data integrity validation
- Performance query optimization
- Concurrent transaction testing
- Backup and recovery testing

### 🔹 8. Chaos Engineering

**Purpose**: Test system resilience under failure conditions.

**Recommended Tools**:

- **`chaostoolkit`** for chaos experiments
- **`toxiproxy`** for network failure simulation
- **`localstack`** for AWS service failure simulation

**Key Improvements**:

- Network failure resilience
- Service dependency failure handling
- Database connection failure recovery
- Load balancer failover testing

### 🔹 9. API Documentation Testing

**Purpose**: Ensure API documentation stays synchronized with implementation.

**Recommended Tools**:

- **`dredd`** for API blueprint validation
- **`swagger-codegen`** for documentation generation
- **`api-diff`** for breaking change detection

**Key Improvements**:

- OpenAPI specification validation
- Documentation accuracy verification
- API versioning documentation
- SDK generation validation

### 🔹 10. Mobile Responsiveness Testing

**Purpose**: Validate application behavior across different device sizes.

**Recommended Tools**:

- **`playwright`** with mobile viewports
- **`cypress-viewport`** for responsive testing
- **`lighthouse-ci`** for mobile performance

**Key Improvements**:

- Touch interaction testing
- Mobile navigation validation
- Responsive layout verification
- Mobile-specific feature testing

---

## Implementation Priority Recommendations

### **High Priority** (Next 3-6 months)

1. **E2E Testing Strategy** - Complete user journey validation
2. **API Contract Testing** - Frontend-backend compatibility
3. **Performance Testing** - Production readiness validation

### **Medium Priority** (6-12 months)

1. **Accessibility Testing** - Compliance and user experience
2. **Security Testing Expansion** - Comprehensive security validation
3. **Visual Regression Testing** - UI consistency maintenance

### **Low Priority** (12+ months)

1. **Chaos Engineering** - Advanced resilience testing
2. **Mobile Testing** - Device-specific validation
3. **Database Advanced Testing** - Complex scenario validation

---

## Success Metrics for Future Improvements

### **Coverage Goals**

- **E2E Coverage**: 80%+ of critical user journeys
- **Performance Benchmarks**: Established response time standards
- **Accessibility Score**: WCAG AA compliance (95%+)
- **Security Scan**: Zero critical vulnerabilities

### **Quality Gates**

- **E2E Tests**: Must pass before production deployment
- **Performance Tests**: Meet established benchmarks
- **Security Scans**: No critical issues in production
- **Accessibility**: Minimum compliance standards met

---

## Integration with Development Workflow

### **Test-Driven Development (TDD)**

- Write E2E tests first for new features
- Implement unit tests alongside feature development
- Use contract tests for API development

### **Continuous Testing**

- Run smoke tests on every deployment
- Performance tests in staging environment
- Full test suite before production releases

### **Monitoring & Alerting**

- Test failure notifications
- Performance regression alerts
- Security vulnerability notifications
- Coverage drop warnings

This comprehensive testing strategy ensures robust, reliable, and maintainable software delivery across all layers of the
application stack.
