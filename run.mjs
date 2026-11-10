import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from './server.mjs';
import {createAccessPolicy} from './src/server-access.js';

export function settingsFromOptions(options, dataRoot='/data') {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('App configuration must be an object.');
  }
  const requireLogin = options.require_login === undefined ? true : options.require_login;
  if (typeof requireLogin !== 'boolean') {
    throw new Error('Require login must be true or false.');
  }
  if (requireLogin && (typeof options.username !== 'string' || typeof options.password !== 'string')) {
    throw new Error('Set Username and a Password of at least 8 characters in the app Configuration tab.');
  }
  if (!Array.isArray(options.origins) || !options.origins.length ||
      options.origins.some(value => typeof value !== 'string')) {
    throw new Error('Allowed addresses must be a non-empty list of HTTP(S) origins.');
  }
  const settings = {
    host: '0.0.0.0', port: 8099,
    requireLogin,
    username: requireLogin ? options.username : '', password: requireLogin ? options.password : '',
    origins: options.origins, dataDirectory: path.join(dataRoot, 'shoes')
  };
  createAccessPolicy(settings); // Reject invalid configuration before opening the database.
  return settings;
}

export async function startAddon({dataRoot='/data', port=8099}={}) {
  process.umask(0o077);
  const options = JSON.parse(await readFile(path.join(dataRoot, 'options.json'), 'utf8'));
  const settings = settingsFromOptions(options, dataRoot);
  for (const [option, variable] of [
    ['google_client_id', 'SHOES_GOOGLE_CLIENT_ID'],
    ['google_api_key', 'SHOES_GOOGLE_API_KEY'],
    ['google_app_id', 'SHOES_GOOGLE_APP_ID']
  ]) {
    if (options[option] !== undefined && typeof options[option] !== 'string') {
      throw new Error('Optional Google configuration values must be text.');
    }
    if (options[option]) process.env[variable] = options[option];
    else delete process.env[variable];
  }
  const app = await createServer({...settings, port});
  console.log('Shoes is ready at ' + settings.origins[0]);
  console.log(settings.requireLogin ? 'Shoe-app login is required.' : 'Shoe-app login is off. Anyone who can reach this app can view and edit the collection.');
  console.log('Database and photos are stored persistently in ' + settings.dataDirectory);
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const app = await startAddon();
    let stopping = false;
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
      if (stopping) return;
      stopping = true;
      try { await app.close(); process.exit(0); }
      catch { console.error('Shoes could not close cleanly.'); process.exit(1); }
    });
  } catch (error) {
    console.error('Shoes could not start: ' + error.message);
    process.exitCode = 1;
  }
}
