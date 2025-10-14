<img src="src/assets/img/icon-128.png" width="64"/>

# CowPilot

## Installing and Running

Currently this extension is only available through this GitHub repo. We'll release it on the Chrome Web Store after adding features to increase its usability for a non-technical audience. To build and install the extension locally on your machine, follow the instructions below.

### Installing the extension

1. Ensure you have [Node.js](https://nodejs.org/) >= **16**.
2. Clone this repository
3. Run `yarn` to install the dependencies
4. Run `yarn start` to build the package
5. Load your extension on Chrome by doing the following:
   1. Navigate to `chrome://extensions/`
   2. Toggle `Developer mode`
   3. Click on `Load unpacked extension`
   4. Select the `build` folder that `yarn start` generated