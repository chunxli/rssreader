import React, {useState,useEffect} from 'react'
import SectionListDemo from './components/SectionListDemo'
import FlatListDemo from './components/FlatListDemo'
import WebViewDemo from './components/WebViewDemo'
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons';
import codePush from "react-native-code-push";

const Tab = createBottomTabNavigator();

const App = () => {

  // Apple Developer RSS: https://developer.apple.com/news/rss/news.rss
  // App Center Dev Blog RSS: https://devblogs.microsoft.com/appcenter/feed/
  // Xamarin Dev Blog RSS: https://devblogs.microsoft.com/xamarin/feed/

  const [source, setSource] = useState({
      title: "RSS Sources",
        data: [
          {name: "App Center Dev Blog", isOn: true, feed: "https://devblogs.microsoft.com/appcenter/feed/" }, 
          {name:"Apple Developer", isOn: false, feed: "https://developer.apple.com/news/rss/news.rss"}, 
          {name:"Xamarin Dev Blog", isOn: false, feed: "https://devblogs.microsoft.com/xamarin/feed/"}
        ]
      }
    );

  const toggleSwitch = (index) => {
    console.log(index)
    const newSource = source;
    newSource.data[index].isOn = !newSource.data[index].isOn
    setSource({
      title: newSource.title,
      data: newSource.data
    })
  };

  const FlatListDemoStack = () => {
    const FLStack = createStackNavigator();
    return (
  
      <FLStack.Navigator style={styles.navigator} initialRouteName='Home'>
        <FLStack.Screen name="Home" >
          {props => <FlatListDemo {...props} source={source} />}
        </FLStack.Screen>
                
        <FLStack.Screen name="Details" component={WebViewDemo} />
        
      </FLStack.Navigator>
    )
  }

  const SectionListDemoStack = () => {
    const SLStack = createStackNavigator();
    return (
  
      <SLStack.Navigator style={styles.navigator}>
        <SLStack.Screen name="Settings">
          {props => <SectionListDemo {...props} source={source} toggleSwitch={toggleSwitch} />}
        </SLStack.Screen>
      </SLStack.Navigator>
    )
  }

  

  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;

            if (route.name === 'Home') {
              iconName = focused
                ? 'home'
                : 'home-outline';
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
        }}
      >
        <Tab.Screen name="Home" component={FlatListDemoStack} />
        <Tab.Screen name="Settings" component={SectionListDemoStack} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  navigator: {
    // flex: 1,
    // marginTop: StatusBar.currentHeight || 0,
    // paddingTop: StatusBar.currentHeight || 0,
    backgroundColor: '#faedcd'
  },
  
});

export default codePush(App)
