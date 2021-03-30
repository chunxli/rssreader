# if [[ $PLATFORM == "Android" ]]; then
#     echo "Generate CodePush release to Android app."
#     appcenter codepush release-react -a KevinApps/RSSReader-RN-Android -d Staging -k ./private.pem --token $API_Token
# else
#     echo "Generate CodePush release to iOS app."
#     appcenter codepush release-react -a KevinApps/RSSReader-RN-iOS -d Staging -k ./private.pem --token $API_Token
# fi