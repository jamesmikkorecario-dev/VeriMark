import { mergeConfig } from 'vite';
import application from '../vite.config';

// The runner passes validated test credentials explicitly. Never read the development .env.local.
export default mergeConfig(application, { envDir: false });
