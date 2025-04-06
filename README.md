# dolphin-ai-buddy
Tools for reading/writing memory to dolphin games on mac, wrapped with typescript for easy integration.

## Re-signing Dolphin
If you don't want to turn off SIP, you'll have to re-sign Dolphin with a cert to allow `dolphin-ai-buddy` to read/write memory directly to it.

### Generating a code signing cert
1. Open "Keychain Access" application (from Applications/Utilities)
2. Go to menu: Keychain Access → Certificate Assistant → Create a Certificate
3. Enter the following details:
```
Name: dolphin-debug-cert (you can choose any name)
Identity Type: Self Signed Root
Certificate Type: Code Signing
Check "Let me override defaults"
```

4. Click "Continue" several times until you reach "Specify a Location For The Certificate"
5. Set Keychain to "System"
6. Continue and complete the certificate creation

### Using the cert
1. Assuming a normal installation, you'll need to move Dolphin to a non-protected folder via
```sh
cp -R /Applications/Dolphin.app ~/Applications/Dolphin.app
```
2. Replace `DOLPHIN_PATH` in `certs/sign-dolphin.sh` with the new location
3. Sign Dolphin and sign node:
```sh
cd certs
./sign-dophin.sh
./sign-node.sh
```

Now you can run the app
```sh
npm run build
cd certs
./run-with-debug.sh
```
Note: This also runs the app via `sudo`, definitely not ideal :(

## cpp
Most of the C++ integration comes from randovania's [py-dolphin-memory-engine](https://github.com/randovania/py-dolphin-memory-engine), used under the MIT license.
