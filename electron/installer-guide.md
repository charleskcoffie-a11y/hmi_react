# Electron Windows Installer Guide

This guide will help you package your Electron app as a Windows installer (EXE) using `electron-builder`.

## 1. Install electron-builder

Open a terminal in the `electron` folder and run:

```
npm install --save-dev electron-builder
```

## 2. Update electron/package.json

Add the following fields to your `electron/package.json`:

```
"main": "main.js",
"build": {
  "appId": "com.yourcompany.hmi",
  "productName": "HMI_React",
  "directories": {
    "buildResources": "build"
  },
  "files": [
    "main.js",
    "../build/**/*"
  ],
  "win": {
    "target": "nsis"
  }
},
"scripts": {
  "start": "electron .",
  "pack": "electron-builder --dir",
  "dist": "electron-builder"
}
```

## 3. Build the React app

From the root folder, run:

```
npm run build
```

## 4. Build the Electron installer

From the `electron` folder, run:

```
npm run dist
```

The installer EXE will be created in the `electron/dist/` folder.

## 5. Install on Windows

Copy the EXE to your target machine and run it to install your HMI app.

---

For updates, repeat steps 3 and 4 after making changes to your React app.
