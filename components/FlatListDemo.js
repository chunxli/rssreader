import React,{useState,useEffect} from 'react'
import { View, Text,FlatList,SafeAreaView,StyleSheet,StatusBar,Image, TouchableOpacity, Linking } from 'react-native'
import { WebView } from 'react-native-webview';
import * as rssParser from 'react-native-rss-parser';
import HTML from "react-native-render-html";


const fetchRSS = () => {
    return fetch("https://devblogs.microsoft.com/appcenter/feed/")
    .then(res=>res.text())
    .then(resData=>rssParser.parse(resData))
    .then((rss)=>{
      return rss.items
    })
    .catch((err)=>{
      console.error(err);
    });
}

const FlatListDemo = () => {
    const [rss,setRss] = useState([])
    // const [loadWebView,setLoadWebView] = useState(false)
    // const [url,setUrl] = useState("")
    

    useEffect(() => {
        // console.log("useEffect")
        fetchRSS().then((items)=>setRss(items))
    }, [])


    const getAuthors = (authors) => {
      let authorsText = ""
      authors.forEach(element => {
        authorsText += (element.name + " ")
      });
    
      return authorsText
    } 
    
    const onPressItem = (item) => {
      // // <WebView source={item.links[0].url}/>
      // setUrl(item.links[0].url)
      // setLoadWebView(true)
    }
    
    const Item = ({item}) => {
        return (
            <TouchableOpacity style={styles.item} onPress={() => onPressItem(item)}>
                
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.author}>{  getAuthors(item.authors) } </Text>
                <Text style={styles.dateTime}>{item.published}</Text>
                <HTML source={{ html: item.description}}  />
                
            </TouchableOpacity>
        );
    };

    return ( 
          <SafeAreaView style={styles.container}>
            <FlatList 
                data = {rss}
                renderItem = { ({item}) => <Item item = {item}  />   } 
                keyExtractor={item=>item.id}      
                    
            />  
          </SafeAreaView> 
    )
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      // marginTop: StatusBar.currentHeight || 0,
      // paddingTop: StatusBar.currentHeight || 0,
      backgroundColor: '#fefae0'
    },
    item: {
      backgroundColor: '#faedcd',
      shadowColor: '#d4a373',
      padding: 40,
      marginVertical: 8,
      marginHorizontal: 16,
      borderRadius: 20
    },
    title: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 10
    },
    content: {
      fontSize: 12,
    },
    author: {
      fontSize: 14,
    },
    dateTime: {
      fontSize: 10,
      // fontStyle: 'italic'
    },
  });

export default FlatListDemo