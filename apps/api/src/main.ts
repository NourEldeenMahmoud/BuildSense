import { setServers } from 'node:dns';
import { getDnsServers } from '@buildsense/config';

const servers = getDnsServers();

if (servers.length > 0) {
  setServers(servers);
}

await import('./startup.js');
