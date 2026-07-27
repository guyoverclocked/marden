# Install Marden on an iPhone

Marden is an Expo/React Native iPhone app, not a web wrapper. It imports from the iOS Files picker, keeps Markdown in private app storage, and uses a maintained native Markdown renderer.

The renderer includes native code, so Marden cannot run in Expo Go. Use an Xcode or EAS development/release build instead.

## Route 1: install directly with Xcode and a free Apple Account

This produces a real Marden icon on the iPhone and does not require paid Apple Developer Program membership. Apple's Personal Team provisioning is for personal testing and expires after 7 days, so the app may need to be rebuilt and reinstalled periodically.

### One-time setup

1. Install the full Xcode app from the Mac App Store. Open it once and let it install the requested components.
2. Install CocoaPods. If Homebrew is already installed, run brew install cocoapods.
3. In Xcode, open Xcode > Settings > Accounts, press +, and sign in with your Apple Account.
4. Connect the unlocked iPhone to the Mac with a USB cable and tap Trust on both devices if prompted.
5. On the iPhone, enable Settings > Privacy & Security > Developer Mode, accept the restart, unlock the phone, and confirm Turn On.
6. Point command-line tools at the full Xcode installation:

~~~bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
~~~

### Build and install

1. From the project folder, run:

~~~bash
git clone https://github.com/guyoverclocked/marden.git
cd marden
npm install
npm run ios:prepare
npm run ios:pods
open ios/Marden.xcworkspace
~~~

2. In Xcode's left sidebar, select the blue Marden project, then the Marden target.
3. Open Signing & Capabilities.
4. Turn on Automatically manage signing and choose your Personal Team.
5. If Xcode says the bundle identifier is unavailable, replace app.marden.reader with a unique value such as com.yourname.marden.
6. Choose the connected iPhone as the run destination in Xcode's top toolbar.
7. In a separate Terminal window, start Metro and leave it running:

~~~bash
npm run start:dev
~~~

8. Press the Run triangle. Xcode will sign, install, and launch Marden.

For later reinstalls, npm run ios:device can compile and install to a connected iPhone once Xcode signing is configured.

## Route 2: self-contained EAS internal build

This is the closest equivalent to the Android APK sideload. It produces a signed IPA, installs Marden as its own app, and the preview build opens normally without a Mac or Metro server. Apple requires an active paid Apple Developer Program membership for EAS device builds.

### One-time setup

1. Create or sign in to an Expo account and make sure the Apple Account used for signing is enrolled in the Apple Developer Program.
2. In Terminal, run:

~~~bash
git clone https://github.com/guyoverclocked/marden.git
cd marden
npx eas-cli@latest login
npm run register:ios
~~~

3. The registration command displays a URL/QR code. Open it on the target iPhone and follow the prompts to register the device. EAS needs the iPhone UDID in the ad hoc provisioning profile.

### Build and install the standalone app

1. Create the self-contained internal build:

~~~bash
npm run build:ios:preview
~~~

2. When EAS asks about signing credentials, let it manage the distribution certificate and provisioning profile unless you already manage your own credentials.
3. After the build succeeds, open the install link on the registered iPhone or scan the QR code printed by EAS.
4. Tap Install. The Marden icon will appear in the App Library or on the Home Screen.
5. On iOS 16 or newer, enable Settings > Privacy & Security > Developer Mode if iOS requests it, restart, and confirm Turn On.
6. Open Marden. The preview build contains its JavaScript bundle, so the Mac and Metro server are not needed.

If you register another iPhone later, create a new build so its UDID is included in the provisioning profile.

## Development-client EAS build

Use this when actively changing code and wanting fast refresh:

~~~bash
npm run build:ios:dev
npm run start:dev
~~~

Install the resulting build through its EAS link. This version needs Metro while running the local project, but it normally needs rebuilding only when native dependencies or native configuration change.

## Which route should I use?

| Goal | Route | Paid Apple membership | Needs Metro after install |
| --- | --- | --- | --- |
| Install your own development copy | Xcode Personal Team | No | Yes |
| Use Marden as a normal self-contained app | EAS preview | Yes | No |
| Iterate with fast refresh | EAS development | Yes | Yes |

## Troubleshooting

- **Expo Go reports an unsupported native module:** install one of the development or preview builds above. Expo Go cannot load Marden's Markdown renderer.
- **Developer Mode is missing:** connect the iPhone to the Mac with Xcode open, or first attempt to open the installed internal build, then check Settings > Privacy & Security again.
- **Untrusted Developer or integrity error:** the app was not signed for this iPhone, the provisioning profile expired, or the device UDID was not included. Re-sign/rebuild using the correct device and team.
- **EAS build installs on one iPhone but not another:** register the second device and create a new preview build.
- **Development build cannot find Metro:** put the phone and Mac on the same network, run npm run start:dev, and scan the displayed QR code. A tunnel can help on restricted Wi-Fi.
- **Xcode says no signing certificate:** confirm the Apple Account is in Xcode > Settings > Accounts, select the target's Signing & Capabilities tab, choose the correct team, and keep automatic signing enabled.
