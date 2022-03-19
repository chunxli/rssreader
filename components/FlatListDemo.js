import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  SafeAreaView,
  StyleSheet,
  StatusBar,
  Image,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import * as rssParser from 'react-native-rss-parser';
import HTML from 'react-native-render-html';

const FlatListDemo = ({navigation, source}) => {
  const [rss, setRss] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // console.log("useEffect")
    // fetchRSS().then((items)=>setRss(items))
    fetchRSS(source);
  }, [source]);

  const fetchRSS = async (source) => {
    setLoading(true);
    let array = [];

    for (let index = 0; index < source.data.length; index++) {
      const element = source.data[index];

      if (!element.isOn) {
        continue;
      }

      await fetch(element.feed)
        .then((res) => res.text())
        .then((resData) => rssParser.parse(resData))
        .then((rssObj) => {
          array = [...array, ...rssObj.items];
        })
        .catch((err) => {
          console.error(err);
        });
    }

    setRss(
      array.sort((a, b) => {
        return new Date(b.published) - new Date(a.published);
      }),
    );

    setLoading(false);
  };

  const getAuthors = (authors) => {
    if (authors == null) {
      return;
    }
    let authorsText = '';
    authors.forEach((element) => {
      authorsText += element.name + ' ';
    });

    return authorsText;
  };

  const Item = ({item}) => {
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() =>
          navigation.navigate('Details', {Url: item.links[0].url})
        }>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.author}>{getAuthors(item.authors)} </Text>
        <Text style={styles.dateTime}>{item.published}</Text>
        <HTML source={{html: item.description}} ignoredTags={['img']} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {loading ? (
        <Text>Loading...</Text>
      ) : (
        <FlatList
          data={rss}
          renderItem={({item}) => <Item item={item} />}
          keyExtractor={(item) => item.id}
          extraData={source}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    // marginTop: StatusBar.currentHeight || 0,
    // paddingTop: StatusBar.currentHeight || 0,
    // backgroundColor: 'white'// '#fefae0'
  },
  item: {
    backgroundColor: 'white', //'#fefae0',// '#faedcd',
    shadowColor: '#d4a373',
    padding: 40,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  content: {
    fontSize: 12,
  },
  author: {
    fontSize: 14,
  },
  dateTime: {
    fontSize: 10,
  },
});

export default FlatListDemo;
