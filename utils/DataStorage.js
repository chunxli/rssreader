import AsyncStorage from '@react-native-async-storage/async-storage';
import RSSSource from '../data/RSSSource.json';
const key = '@rss_source';

export const getData = async (storage_key) => {
  try {
    const jsonValue = await AsyncStorage.getItem(storage_key);
    if (jsonValue != null) {
      return JSON.parse(jsonValue);
    } else {
      storeInitData();
      return RSSSource;
    }
  } catch (e) {
    // error reading value
    console.log(e);
  }
};

export const storeData = async (storage_key, value) => {
  try {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(storage_key, jsonValue);
  } catch (e) {
    // saving error
    console.log(e);
  }
};

export const storeInitData = async () => {
  try {
    const jsonValue = JSON.stringify(RSSSource);
    await AsyncStorage.setItem(key, jsonValue);
  } catch (e) {
    // saving error
  }
};

export const AddANewRSSData = async (title, rss_url) => {
  try {
    let jsonData = await getData(key);
    jsonData.data.push({
      name: title,
      isOn: true,
      feed: rss_url,
    });

    console.log('Add New');
    console.log(title + rss_url);

    const jsonValue = JSON.stringify(jsonData);
    await AsyncStorage.setItem(key, jsonValue);

    console.log('Add finished');
  } catch (e) {
    // saving error
    console.log(e);
  }
};

export const toggleSwitch = async (index) => {
  try {
    let jsonData = await getData(key);
    console.log(jsonData);

    jsonData.data[index].isOn = !jsonData.data[index].isOn;
    console.log(jsonData);

    const jsonValue = JSON.stringify(jsonData);
    await AsyncStorage.setItem(key, jsonValue);

    console.log('Update isOn finished');
  } catch (e) {
    // saving error
    console.log(e);
  }
};
