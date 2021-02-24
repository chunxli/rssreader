import React from 'react'
import SectionListDemo from './components/SectionListDemo'
import FlatListDemo from './components/FlatListDemo'
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StyleSheet } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons';

const Tab = createBottomTabNavigator();

const FlatListDemoStack = () => {
  const FLStack = createStackNavigator();
  return (

    <FLStack.Navigator style={styles.navigator}>
      <FLStack.Screen name="Home" component={FlatListDemo} />
    </FLStack.Navigator>
  )
}

const SectionListDemoStack = () => {
  const SLStack = createStackNavigator();
  return (

    <SLStack.Navigator style={styles.navigator}>
      <SLStack.Screen name="Settings" component={SectionListDemo} />
    </SLStack.Navigator>
  )
}

const App = () => {
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

export default App
