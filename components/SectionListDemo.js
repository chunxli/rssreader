import React, { useState,useEffect } from 'react'
import { StyleSheet,View, SectionList, SafeAreaView, Text,Switch, Button } from 'react-native';
import codePush from "react-native-code-push";

const SectionListDemo = ({source, toggleSwitch}) => {
  const [updateSingle,setUpdateSingle] = useState(false);
  // const [data, setData] = useState([
  //   {
  //     title: "RSS Source",
  //     data: [
  //       {name: "App Center Dev Blog", isOn: false}, 
  //       {name:"Apple Developer", isOn: true}, 
  //       {name:"Xamarin Dev Blog", isOn: false}
  //     ]
  //   },
    
  // ]);
  
  const onButtonPress = () => {
    codePush.sync({
        updateDialog: true,
        installMode: codePush.InstallMode.IMMEDIATE
    });
  }

  const Item = ({ index,section,item }) => 
  (
      <View style={styles.itemContainer}>
        <Text style={styles.item}>{item.name}</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={item.isOn ? "#f5dd4b" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={(value) => {
              toggleSwitch(index,section)
              setUpdateSingle(!updateSingle)
            }
          }
          value={item.isOn}
          style={styles.switch}
        />
      </View>
  );

  return (
      <>
        <SectionList 
          sections = {[source]}
          keyExtractor = {(item, index) => item.name + index}
          renderItem = {({item,index,section})=> <Item item={item} index={index} section={section}  />  }
          renderSectionHeader = { ({section: {title}}) => (
              <Text style={styles.header}>{title}</Text>
            )
          }
          extraData = {updateSingle}
          style={styles.container}
        />
        <Button title='Check for update!' onPress={onButtonPress} />
        <Text>eee</Text>
      </>
  )
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      // marginTop: StatusBar.currentHeight || 0,
      // paddingTop: StatusBar.currentHeight || 0,
      // backgroundColor: '#fefae0'
    },
    item: {
      flex:9,
      textAlignVertical: 'center',
  
    },
    switch: {
      flex:1
    },
    
    itemContainer: {
      flexDirection: 'row',
      backgroundColor: "white",
      padding:10,
      marginVertical: 5,
      marginHorizontal: 5,
      borderRadius: 15,
      // borderWidth:1,
    },
    header: {
      fontSize: 20,
      // backgroundColor: "#fff",
      marginVertical:10,
      marginHorizontal: 5
    },
    title: {
      fontSize: 12
    }

  }
);


export default SectionListDemo
