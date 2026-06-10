const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: 'ca.trustcyber.mdviewer',
    // Kokoro TTS worker must live outside app.asar so python3 can execute it.
    // Lands at Contents/Resources/tts/; the codesign afterComplete hook covers it.
    extraResource: ['./resources/tts'],
    afterComplete: [
      (buildPath, electronVersion, platform, arch, done) => {
        if (platform !== 'darwin') return done();
        try {
          const appName = fs.readdirSync(buildPath).find((e) => e.endsWith('.app'));
          if (!appName) return done(new Error(`No .app bundle in ${buildPath}`));
          const appPath = path.join(buildPath, appName);
          execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
            stdio: 'inherit',
          });
          done();
        } catch (err) {
          done(err);
        }
      },
    ],
    extendInfo: {
      NSDocumentsFolderUsageDescription:
        'mdviewer needs access to your Documents folder to load images referenced by markdown files you open from there.',
      NSDesktopFolderUsageDescription:
        'mdviewer needs access to your Desktop to load images referenced by markdown files you open from there.',
      NSDownloadsFolderUsageDescription:
        'mdviewer needs access to your Downloads folder to load images referenced by markdown files you open from there.',
      NSRemovableVolumesUsageDescription:
        'mdviewer needs access to removable volumes to load images referenced by markdown files you open from external drives.',
      NSNetworkVolumesUsageDescription:
        'mdviewer needs access to network volumes to load images referenced by markdown files you open from network drives.',
      CFBundleDocumentTypes: [
        {
          CFBundleTypeName: 'Markdown File',
          CFBundleTypeRole: 'Editor',
          LSHandlerRank: 'Owner',
          LSItemContentTypes: ['net.daringfireball.markdown'],
          CFBundleTypeExtensions: ['md', 'markdown'],
        },
        {
          CFBundleTypeName: 'Document',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          CFBundleTypeExtensions: ['pdf', 'docx', 'pptx', 'xlsx', 'html', 'htm', 'csv', 'json', 'xml', 'epub', 'txt', 'rst', 'rtf'],
        },
        {
          CFBundleTypeName: 'Image',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          CFBundleTypeExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'tiff', 'bmp'],
        },
        {
          CFBundleTypeName: 'Audio or Video',
          CFBundleTypeRole: 'Viewer',
          LSHandlerRank: 'Alternate',
          CFBundleTypeExtensions: ['wav', 'mp3', 'm4a', 'mp4'],
        },
      ],
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
            entry: 'src/main.ts',
            config: 'vite.main.config.mjs',
            target: 'main',
          },
          {
            entry: 'src/preload.ts',
            config: 'vite.preload.config.mjs',
            target: 'preload',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
