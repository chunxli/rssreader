import React, { useState,useEffect } from 'react'
import { StyleSheet,View, SectionList, SafeAreaView, Text,Switch } from 'react-native';

const SectionListDemo = () => {
  const [updateSingle,setUpdateSingle] = useState(false);
  const [data, setData] = useState([
    {
      title: "RSS Source",
      data: [
        {name: "App Center", isOn: false}, 
        {name:"Apple Developer", isOn: true}, 
        {name:"Android Developer", isOn: false}
      ]
    },
    
  ]);
  const toggleSwitch = (index,section) => {
    const arr = data;
    arr.map((item)=>{
      if (item.title === section.title) {
        item.data[index].isOn = !item.data[index].isOn
        return item
      }
      return item
    });
    console.log(arr)
    setData(arr)
    setUpdateSingle(!updateSingle)
  };

  const Item = ({ index,section,item }) => 
  (
      <View style={styles.item}>
        <Text style={styles.item}>{item.name}</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={item.isOn ? "#f5dd4b" : "#f4f3f4"}
          ios_backgroundColor="#3e3e3e"
          onValueChange={(value) => {
              // console.log(value?"true":"false")
              toggleSwitch(index,section)
            }
          }
          value={item.isOn}
          
        />
      </View>
  );

  return (
      <SectionList 
        sections = {data}
        keyExtractor = {(item, index) => item.name + index}
        renderItem = {({item,index,section})=> <Item item={item} index={index} section={section}  />  }
        renderSectionHeader = { ({section: {title}}) => (
            <Text style={styles.header}>{title}</Text>
          )
        }
        extraData = {updateSingle}
        style={styles.container}
      />

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
      // backgroundColor: "white",
      // padding:10,
      // marginVertical: 10,
      // fontSize: 20
      
    },
    header: {
      fontSize: 20,
      // backgroundColor: "#fff",
      margin: 10, 
    },
    title: {
      fontSize: 12
    }

  }
);


export default SectionListDemo
