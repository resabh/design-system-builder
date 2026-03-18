/**
 * Test setup - runs before all tests
 */

// Set environment variables for testing
process.env.NODE_ENV = 'test';

// Increase timeout for all tests
jest.setTimeout(60000);
