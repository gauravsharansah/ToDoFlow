# Setup notes

Nothing in this file is a secret value. Keys and passwords stay out of the repo.

## Firestore security rules

The rules live in [`../firestore.rules`](../firestore.rules). They are **not** deployed
automatically. After changing them, paste the file into
Firebase console → Firestore Database → Rules → Publish.

After publishing, check: create an account, change the username, try a taken
username (must be refused), and in the Rules Playground try reading `usernames`
while signed out (must be denied).

## GitHub secrets used by the build

Add under the repo's Settings → Secrets and variables → Actions → New repository secret.

| Secret | Used for |
|---|---|
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | Replace the `__FIREBASE_*__` placeholders in `src/index.html` during CI (values from Firebase console → Project settings → Your apps). |
| `ANDROID_KEYSTORE_BASE64` | The permanent Android signing key, base64-encoded. |
| `ANDROID_KEYSTORE_PASSWORD` | Password of that key (also used as the key password). |

### Android signing key

Android only installs an update over an existing app when the package name is the
same, the **signing key is the same**, and the version code is higher. So every
release must be signed with one permanent key. If the key is lost, nobody can
update in place any more (users would have to uninstall once) — **back it up**
(e.g. a password manager or an encrypted drive), never commit it.

Copy the key to the clipboard for the secret (PowerShell; adjust the path):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\ToDoFlow-signing\todoflow-release.p12")) | Set-Clipboard
```

macOS / Linux:

```bash
base64 -w0 ~/ToDoFlow-signing/todoflow-release.p12      # macOS: base64 -i file | pbcopy
```

Copy the password to the clipboard (PowerShell):

```powershell
Get-Content "$env:USERPROFILE\ToDoFlow-signing\keystore-password.txt" | Set-Clipboard
```

Create a new key (only if you have no key yet; needs OpenSSL, included with Git for Windows):

```bash
PW=$(openssl rand -hex 12); echo "$PW" > keystore-password.txt
openssl req -x509 -newkey rsa:2048 -sha256 -days 10000 -nodes \
  -keyout k.key -out k.crt -subj "/CN=ToDoFlow/O=ToDoFlow/C=IN"
openssl pkcs12 -export -inkey k.key -in k.crt -name todoflow -out todoflow-release.p12 \
  -passout pass:$PW -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1
rm k.key k.crt
```

The key alias must stay `todoflow`. Without the two Android secrets, CI still builds a
debug-signed APK and prints a warning, but that APK cannot update one built by a
different run.

## Releasing

```bash
# bump "version" in package.json (and package-lock.json), commit, then:
git tag vX.Y.Z && git push origin main vX.Y.Z
```

The workflow builds Windows, Linux, macOS (x64 + arm64) and Android and publishes
five files. GitHub adds its own "Source code" archives to every release.
Android's version code is derived from the version (2.1.0 -> 20100), so it always
increases with it.
