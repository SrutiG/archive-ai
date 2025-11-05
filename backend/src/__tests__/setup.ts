import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3002'; // Use different port for tests

// Disable console.log during tests (comment out to see logs)
// global.console.log = jest.fn();
// global.console.error = jest.fn();

