// Run the platform-specific installer lifecycle acceptance suite without accessing real host registrations.
if (process.platform === 'win32') await import('./setup-windows-test.mjs');
else await import('./setup-posix-test.mjs');
