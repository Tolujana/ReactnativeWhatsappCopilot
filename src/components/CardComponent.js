import {View, Text, TouchableOpacity} from 'react-native';
import {Card, Title} from 'react-native-paper'; // Import Card and Title components from React Native Paper

import React from 'react';

export default function CardComponent(
  item,
  handleMenuItemPress,
  handleMenuLoad,
) {
  return (
    <TouchableOpacity
      key={item.id}
      onPress={() => handleMenuItemPress(item.screen)}
      onLoad={handleMenuLoad}
      style={{
        width: '40%',
        aspectRatio: 1,
        margin: 10,
      }}>
      <View
        style={{
          borderRadius: 10,
          flex: 1,
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.2,
          shadowRadius: 4,
          backgroundColor: 'white',
        }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 10,
          }}>
          <Title
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              textAlign: 'center',
            }}>
            {item.title}
          </Title>
        </View>
      </View>
    </TouchableOpacity>
  );
}
