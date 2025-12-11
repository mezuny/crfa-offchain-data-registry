// Load environment variables from .env file
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Validate required environment variables
const requiredEnvVars = [
  'DBS_DATABASE_NAME',
  'DBS_DATABASE_HOST',
  'DBS_DATABASE_USER',
  'DBS_DATABASE_PASSWORD',
  'DBS_DATABASE_PORT'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}\n` +
    'Please ensure your .env file is properly configured.'
  );
}

// Export the 5 ENV variables
export const DBS_DATABASE_NAME = process.env.DBS_DATABASE_NAME;
export const DBS_DATABASE_HOST = process.env.DBS_DATABASE_HOST;
export const DBS_DATABASE_USER = process.env.DBS_DATABASE_USER;
export const DBS_DATABASE_PASSWORD = process.env.DBS_DATABASE_PASSWORD;
export const DBS_DATABASE_PORT = process.env.DBS_DATABASE_PORT;
