import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  StyleSheet,
  Dimensions,
} from 'react-native';

const screenWidth = Dimensions.get('window').width;
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MenuCard = ({title, iconName, onPress}) => (
  <TouchableOpacity onPress={onPress} style={styles.menuCard}>
    <View style={styles.menuCardIconContainer}>
      <Icon name={iconName} size={30} color="#4B5563" />
    </View>
    <Text style={styles.menuCardText}>{title}</Text>
  </TouchableOpacity>
);

const CategorySection = ({title, items}) => {
  const [visible, setVisible] = useState(true);
  const navigation = useNavigation();

  const toggleVisibility = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setVisible(!visible);
  };

  return (
    <View style={styles.categorySection}>
      <View style={styles.categorySectionHeader}>
        <Text style={styles.categorySectionTitle}>{title}</Text>
        <TouchableOpacity onPress={toggleVisibility}>
          <Icon name={visible ? 'eye' : 'eye-off'} size={20} color="#4B5563" />
        </TouchableOpacity>
      </View>

      {visible && (
        <View style={styles.categorySectionItems}>
          {items.map((item, idx) => (
            <MenuCard
              key={idx}
              title={item.title}
              iconName={item.icon}
              onPress={() =>
                navigation.navigate(item.screen, {
                  title: item.title,
                })
              }
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  menuCard: {
    alignItems: 'center',
    padding: 8,
    margin: 4,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    aspectRatio: 1,
    width: screenWidth * 0.2,
    minHeight: screenWidth * 0.22,
  },
  menuCardIconContainer: {
    marginBottom: 4,
  },
  menuCardText: {
    fontSize: 12,
    textAlign: 'center',
  },
  categorySection: {
    marginBottom: 16,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categorySectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  categorySectionItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    padding: 8,
    borderColor: '#ccc',
    borderWidth: 2,
    borderRadius: 12,
    flex: 1,
  },
});

export default CategorySection;
