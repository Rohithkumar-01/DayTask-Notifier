/**
 * Run this ONCE to generate your VAPID keys:
 *   node generate-keys.js
 *
 * Then copy the output into your Render environment variables.
 */

const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();

console.log('\n✅ VAPID Keys Generated!\n');
console.log('Copy these into your Render environment variables:\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_EMAIL=mailto:you@gmail.com');
console.log('\n⚠️  Keep VAPID_PRIVATE_KEY secret — never share it publicly!\n');
