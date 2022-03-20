import React, {useState, useEffect} from 'react';
import SectionListDemo from './components/SettingsPage';
import FlatListDemo from './components/HomePage';
import WebViewDemo from './components/WebViewDemo';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import {StyleSheet} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import codePush from 'react-native-code-push';
import {getData, storeData} from './utils/DataStorage';
import RSSSource from './data/RSSSource.json';

const Tab = createBottomTabNavigator();

const App = () => {
  // Apple Developer RSS: https://developer.apple.com/news/rss/news.rss
  // App Center Dev Blog RSS: https://devblogs.microsoft.com/appcenter/feed/
  // Xamarin Dev Blog RSS: https://devblogs.microsoft.com/xamarin/feed/

  const [source, setSource] = useState({
    title: RSSSource.title,
    data: RSSSource.data,
  });

  useEffect(() => {
    getData('@rss_source').then((value) => {
      setSource({
        title: value.title,
        data: value.data,
      });
      console.log(value);
    });
  }, []);

  const FlatListDemoStack = () => {
    const FLStack = createStackNavigator();
    return (
      <FLStack.Navigator style={styles.navigator} initialRouteName="Home">
        <FLStack.Screen name="Home">
          {(props) => <FlatListDemo {...props} source={source} />}
        </FLStack.Screen>

        <FLStack.Screen name="Details" component={WebViewDemo} />
      </FLStack.Navigator>
    );
  };

  const SectionListDemoStack = () => {
    const SLStack = createStackNavigator();
    return (
      <SLStack.Navigator style={styles.navigator}>
        <SLStack.Screen name="Settings">
          {(props) => (
            <SectionListDemo
              {...props}
              source={source}
            />
          )}
        </SLStack.Screen>
      </SLStack.Navigator>
    );
  };

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({route}) => ({
          tabBarIcon: ({focused, color, size}) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Settings') {
              iconName = focused ? 'settings' : 'settings-outline';
            }

            // You can return any component that you like here!
            return <Ionicons name={iconName} size={size} color={color} />;
          },
        })}
        tabBarOptions={{
          activeTintColor: 'tomato',
          inactiveTintColor: 'gray',
        }}>
        <Tab.Screen name="Home" component={FlatListDemoStack} />
        <Tab.Screen name="Settings" component={SectionListDemoStack} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  navigator: {
    // flex: 1,
    // marginTop: StatusBar.currentHeight || 0,
    // paddingTop: StatusBar.currentHeight || 0,
    backgroundColor: '#faedcd',
  },
});

export default codePush(App);
