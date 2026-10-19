import { networkInterfaces } from 'node:os';
import { isIPv4 } from 'node:net';
import { createHash, timingSafeEqual } from 'node:crypto';

export const BASIC_USERNAME = 'demo';

export function networkConfig({ access = 'localhost', bindIPv4, lanPassword = '', interfaces = networkInterfaces() } = {}) {
  if (!['localhost', 'lan'].includes(access)) throw new Error('DEMO_ACCESS must be localhost or lan.');
  if (access === 'localhost') {
    if (bindIPv4 !== undefined) throw new Error('Unset DEMO_BIND_IPV4 for localhost mode.');
    return { bindAddress: '127.0.0.1', authorized: () => true };
  }
  const octets = typeof bindIPv4 === 'string' && isIPv4(bindIPv4) ? bindIPv4.split('.').map(Number) : [];
  const privateIP = octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168);
  const assigned = Object.values(interfaces).flat().some(item => item && !item.internal && item.address === bindIPv4);
  if (!privateIP || !assigned) throw new Error('LAN requires DEMO_BIND_IPV4 to be a specific assigned RFC1918 IPv4 address (not 0.0.0.0, loopback or a public IP).');
  if (typeof lanPassword !== 'string' || !lanPassword.trim() || /[\r\n\0]/.test(lanPassword)) throw new Error('LAN requires a non-empty server-side DEMO_LAN_PASSWORD.');
  const expected = createHash('sha256').update(`${BASIC_USERNAME}:${lanPassword}`, 'utf8').digest();
  return {
    bindAddress: bindIPv4,
    authorized(header) {
      const match = typeof header === 'string' && /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header);
      if (!match) return false;
      const bytes = Buffer.from(match[1], 'base64');
      if (bytes.toString('base64') !== match[1]) return false;
      return timingSafeEqual(createHash('sha256').update(bytes).digest(), expected);
    },
  };
}
