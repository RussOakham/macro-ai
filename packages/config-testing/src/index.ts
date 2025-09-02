// Configuration objects (no Vitest imports)
export {
	commonTestConfig,
	integrationTestTimeouts,
	unitTestTimeouts,
	reactTestConfig,
} from './config.js'

// Test data factories
export {
	userFactory,
	authFactory,
	chatFactory,
	apiResponseFactory,
	dbFactory,
	testUtils,
} from './test-factories.js'

// MSW (Mock Service Worker) setup
export {
	handlers,
	authHandlers,
	userHandlers,
	chatHandlers,
	errorHandlers,
} from './msw-handlers.js'

export {
	server,
	worker,
	startServer,
	stopServer,
	resetServer,
	startWorker,
	stopWorker,
	resetWorker,
	setupServer,
	setupWorker,
} from './msw-setup.js'
