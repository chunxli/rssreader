import React from 'react'
import { WebView } from 'react-native-webview';

const WebViewDemo = ( { route } ) => {
    return (
        <WebView source={{ uri: route.params.Url}} 
            
        />
    )
}

export default WebViewDemo
