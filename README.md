# Introduction

React Native List Demo 

Fetch RSS contents from following sources and display them.

- App Center Dev Blog: https://devblogs.microsoft.com/appcenter/feed/
- Apple Developer: https://developer.apple.com/news/rss/news.rss
- Xamarin Dev Blog: https://devblogs.microsoft.com/xamarin/feed/

# CodePush Integrated and Code Signing Enabled

If you want to test with your own CodePush configuration, please update following fields:

## Android

Update the `CodePushDeploymentKey` and `CodePushPublicKey` in strings.xml file with your own values.

## iOS

Update the `CodePushDeploymentKey` and `CodePushPublicKey` in Info.plist file with your own values.

## Release Command Line

```bash
appcenter codepush release-react -a <ownerName>/<appName> -d Staging -k <pathToPrivateKeyFile>
```

For example:

```bash
appcenter codepush release-react -a KevinApps/RSSReader-RN-Android -d Staging -k ./private.pem
```


# Overview

## Android

![AndroidOverView](./imgs/Android.png)

## iOS

![iOSOverView](./imgs/iOS.png)