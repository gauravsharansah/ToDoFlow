/**
 * afterSign hook — ad-hoc signs and verifies the macOS .app.
 * An unsigned or half-signed arm64 app is reported by Gatekeeper as
 * "damaged / malware" with a Move to Trash button; a valid ad-hoc
 * signature downgrades that to the normal "unidentified developer" prompt.
 */
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('xattr', ['-cr', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app], { stdio: 'inherit' });
};
