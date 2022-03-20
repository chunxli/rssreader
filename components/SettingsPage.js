import React, {useState, useEffect} from 'react';
import {
  StyleSheet,
  View,
  SectionList,
  SafeAreaView,
  Text,
  Switch,
  Button,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {AddANewRSSData, getData, toggleSwitch} from '../utils/DataStorage';
import RSSSource from '../data/RSSSource.json';

const SectionListDemo = () => {
  const [source, setSource] = useState({
    title: '',
    data: [],
  });
  const [updateSingle, setUpdateSingle] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newRSS, setNewRSS] = useState('');
  const [newRSSName, setNewRSSName] = useState('');

  useEffect(() => {
    setIsLoading(true);
    getData('@rss_source')
      .then((value) => {
        setSource({
          title: value.title,
          data: value.data,
        });
        console.log('set data finished');
        // console.log(source);
      })
      .catch((error) => console.log('error'))
      .finally(() => {
        setIsLoading(false);
        console.log('get data finished');
      });
  }, [newRSS, updateSingle]);

  const AddRSSToSource = async () => {
    console.log(newRSS);
    await AddANewRSSData(newRSSName, newRSS);
    getData('@rss_source').then((value) => {
      console.log(value);
      setUpdateSingle(!updateSingle);
    });
  };

  const Item = ({index, section, item}) => (
    <View style={styles.itemContainer}>
      <ActivityIndicator size="large" animating={isLoading} />
      <Text style={styles.item}>{item.name}</Text>
      <Switch
        trackColor={{false: '#767577', true: '#81b0ff'}}
        thumbColor={item.isOn ? '#f5dd4b' : '#f4f3f4'}
        ios_backgroundColor="#3e3e3e"
        onValueChange={async (value) => {
          await toggleSwitch(index);
          setUpdateSingle(!updateSingle);
        }}
        value={item.isOn}
        style={styles.switch}
      />
    </View>
  );

  return (
    <>
      <SectionList
        sections={[source]}
        keyExtractor={(item, index) => item.name + index}
        renderItem={({item, index, section}) => (
          <Item item={item} index={index} section={section} />
        )}
        renderSectionHeader={({section: {title}}) => (
          <Text style={styles.header}>{title}</Text>
        )}
        extraData={updateSingle}
        style={styles.container}
      />
      <TextInput
        placeholder="New RSS Name"
        onChangeText={(value) => {
          console.log(value);
          setNewRSSName(value);
        }}
      />
      <TextInput
        placeholder="Input or Paste New RSS URL"
        onChangeText={(value) => {
          console.log(value);
          setNewRSS(value);
        }}
      />
      <Button title="ADD" onPress={AddRSSToSource} />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // marginTop: StatusBar.currentHeight || 0,
    // paddingTop: StatusBar.currentHeight || 0,
    // backgroundColor: '#fefae0'
  },
  item: {
    flex: 9,
    textAlignVertical: 'center',
  },
  switch: {
    flex: 1,
  },

  itemContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 10,
    marginVertical: 5,
    marginHorizontal: 5,
    borderRadius: 15,
  },
  header: {
    fontSize: 20,
    marginVertical: 10,
    marginHorizontal: 5,
  },
  title: {
    fontSize: 12,
  },
});

export default SectionListDemo;
