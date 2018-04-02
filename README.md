# React template for apps targetting Mobiles/Web/Desktop

To install everything just do:
```
  npm install .
```

## For web

### Development

To start dev server with autoreload please run:
```
  npm run web-dev
```

The server will be launched at localhost - port `dev.web-server-port` (build.json).

### Release

To prepare release files run:
```
  npm run web-release
```

The output files will be placed in the directory `./build-web`.

The output will be `index.html` available for static hosting by any server.

## For desktop

### Development

To start **Electron** with autoreload on application close please run:
```
  npm run desktop-dev
```

### Release

You can release desktop apps for the following platforms:
* Linux 32bit (run `npm run linux-release`)
* Windows 32bit (run `npm run windows-release`)

**Note:** You can build Linux releases only on Linux and similary for other platforms.

## For native mobile

### Development

To start *Expo* server for IP specified in `dev.expo-server-ip` (build.json)
please execute the following command:
```
  npm run mobile-dev
```

Then run *Expo* app on you phone entering the `exp://<IP>:<PORT>` (see `npm run mobile-dev` logs for actual address)
to run your app natively.

### Release

To release **Expo** you must set up environment variables (their names are defined in `release.expo-user-env` and `release.expo-passwd-env` - build.json)
By default it is `EXPO_USER_LOGIN` and `EXPO_USER_PASSWD`

That's the user and password for Expo account that the app will be published under.

Then run the command:
```
  android-release
```

Or/and:
```
  ios-release
```

The release will be performed in-cloud (Expo servers).
And the link for app download will be specified in the logs (not full automation support).

