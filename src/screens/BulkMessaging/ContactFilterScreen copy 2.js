import React, {useCallback, useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Checkbox,
  DataTable,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {
  checkAccessibilityPermission,
  checkOverlayPermission,
  launchWhatsappMessage,
  openOverlaySettings,
} from '../../util/WhatsappHelper';
import {
  getContactsByCampaignId,
  getPoints,
  insertSentMessage,
  preloadRewardedAd,
  reservePointsForMessagesByIds,
  showRewardedAd,
} from '../../util/data';
import {NativeModules} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import MessageEditorModal from '../../components/MessageEditor';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';

const ContactFilterScreen = ({navigation, route, toggleTheme}) => {
  const theme = useTheme();
  const {campaign, message, media} = route.params;
  const [isSending, setIsSending] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState({});
  const [templateList, setTemplateList] = useState({});
  const [selectedEditorContacts, setSelectedEditorContacts] = useState([]);
  const [editingMessages, setEditingMessages] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const {AccessibilityHelper} = NativeModules;
  const [needsHelp, setNeedsHelp] = useState(false);
  const [whatsappPackage, setWhatsappPackage] = useState('com.whatsapp');
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);

  // Your actual ad unit IDs (replace with your own)
  const AD_UNIT_TOP = __DEV__ ? TestIds.BANNER : TestIds.BANNER;
  const AD_UNIT_BOTTOM = __DEV__ ? TestIds.BANNER : TestIds.BANNER;

  const openSettings = () => {
    AccessibilityHelper.openAccessibilitySettings();
  };

  const openEditorForContacts = contactsToEdit => {
    const baseMessages = templateList[contactsToEdit[0]] || message;
    setEditingMessages(baseMessages);
    setSelectedEditorContacts(contactsToEdit);
    setIsModalVisible(true);
  };

  const fetchPoints = async () => {
    try {
      const currentPoints = await getPoints();
      setPoints(currentPoints);
    } catch (e) {
      console.warn('Failed to fetch points', e);
      setPoints(0);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPoints();
      preloadRewardedAd();
    }, []),
  );

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        const loadedContacts = await getContactsByCampaignId(campaign.id);
        setContacts(loadedContacts);
        const selectedMap = loadedContacts.reduce((acc, contact) => {
          acc[contact.id] = true;
          return acc;
        }, {});
        setSelectedContacts(selectedMap);
      } catch (e) {
        Alert.alert('Error', 'Failed to load contacts');
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, [campaign.id]);

  const toggleSelect = useCallback(contactId => {
    if (!contactId) return;

    try {
      setSelectedContacts(prev => ({
        ...prev,
        [contactId]: !prev[contactId],
      }));
    } catch (error) {
      console.error('Error in toggleSelect:', error);
      Alert.alert('Toggle Error', error.message || 'Unknown error');
    }
  }, []);

  const handleSendMessages = async () => {
    if (isSending) return;
    setIsSending(true);

    const contactsToSend = contacts.filter(
      contact => selectedContacts[contact.id],
    );

    if (contactsToSend.length === 0) {
      Alert.alert('No Contacts', 'Please select at least one contact.');
      setIsSending(false);
      return;
    }

    const selectedIds = contactsToSend.map(c => c.id);

    const tryReserveAndSend = async () => {
      try {
        const messageId = await insertSentMessage(
          [{message}],
          new Date().toISOString(),
        );

        function replaceContactPlaceholders(template, contact) {
          const replacements = {
            '{{name}}': contact.name || '',
            '{{phone}}': contact.phone || '',
          };

          if (contact.extra_field) {
            try {
              const extrafield = JSON.parse(contact.extra_field);
              Object.keys(extrafield).forEach(key => {
                replacements[`{{${key}}}`] = extrafield[key] || '';
              });
            } catch (e) {
              console.warn('Failed to parse extra_field:', e);
            }
          }

          const delimiter = '$@#__DELIMITER__#@%';
          const joinedString = template.join(delimiter);

          if (joinedString.length > 1000) {
            Alert.alert(
              'Error',
              'Text is too long. Please reduce the message size.',
            );
            setIsSending(false);
            return null;
          }

          let replacedString = joinedString;
          Object.keys(replacements).forEach(placeholder => {
            replacedString = replacedString.replaceAll(
              placeholder,
              replacements[placeholder],
            );
          });

          return replacedString.split(delimiter).map(segment => segment.trim());
        }

        const personalizedMessages = contactsToSend
          .map(contact => {
            const messages = replaceContactPlaceholders(
              templateList[contact.id] || message,
              contact,
            );
            if (!messages) return null;
            return {
              phone: contact.phone,
              message: messages,
              name: contact.name,
              mediaPath: contact.mediaPath,
            };
          })
          .filter(msg => msg !== null);

        if (personalizedMessages.length === 0) {
          Alert.alert('Error', 'No valid messages could be generated.');
          setIsSending(false);
          return;
        }

        const goToResultScreen = () => {
          navigation.navigate('WhatsappResultScreen', {
            totalContacts: personalizedMessages,
            whatsappPackage,
          });
        };

        if (needsHelp) {
          const enabled = await checkAccessibilityPermission();
          if (!enabled) {
            Alert.alert(
              'Permission Required',
              'To use this assistive tool, Accessibility feature is required. Kindly enable in settings.',
              [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Go to Settings', onPress: openSettings},
              ],
              {cancelable: true},
            );
            setIsSending(false);
            return;
          }
          const newBalance = await reservePointsForMessagesByIds(selectedIds);
          setPoints(newBalance);
          launchWhatsappMessage(personalizedMessages, whatsappPackage);
          goToResultScreen();
          setIsSending(false);
        } else {
          const overlayGranted = await checkOverlayPermission();
          if (!overlayGranted) {
            Alert.alert(
              'Overlay Permission Required',
              'This feature requires overlay permission to show the floating button and control message delivery. Enable it in settings.',
              [
                {text: 'Cancel', style: 'cancel'},
                {text: 'Go to Settings', onPress: openOverlaySettings},
              ],
              {cancelable: true},
            );
            setIsSending(false);
            return;
          }

          Alert.alert(
            'Manual Mode',
            'You will have to tap "Send" manually for each message. Tick the checkbox above to get help.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => setIsSending(false),
              },
              {
                text: 'Send Manually',
                onPress: async () => {
                  const newBalance = await reservePointsForMessagesByIds(
                    selectedIds,
                  );
                  setPoints(newBalance);
                  launchWhatsappMessage(personalizedMessages, whatsappPackage);
                  goToResultScreen();
                  setIsSending(false);
                },
              },
            ],
          );
        }
      } catch (e) {
        if (e.code === 'INSUFFICIENT_POINTS') {
          Alert.alert(
            'Not enough points',
            `${e.message} Watch a rewarded ad to earn points and continue?`,
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => setIsSending(false),
              },
              {
                text: 'Watch Ad',
                onPress: async () => {
                  try {
                    const reward = await showRewardedAd();
                    Alert.alert(
                      'Points earned!',
                      `You earned ${reward.amount} points. New balance: ${reward.balance}. Retrying...`,
                    );
                    await fetchPoints();
                  } catch (adErr) {
                    if (adErr.code === 'REWARD_SAVE_ERR') {
                      Alert.alert(
                        'Error',
                        'Failed to save points to database. Please try again.',
                      );
                    } else {
                      Alert.alert('Ad failed', String(adErr.message || adErr));
                    }
                    setIsSending(false);
                  }
                },
              },
            ],
          );
        } else {
          console.error('Error in tryReserveAndSend:', e);
          Alert.alert('Error', String(e.message || e));
          setIsSending(false);
        }
      }
    };

    await tryReserveAndSend();
  };

  const areAllSelected =
    contacts.length > 0 && contacts.every(c => selectedContacts[c.id]);
  const toggleSelectAll = () => {
    const updated = {};
    contacts.forEach(contact => {
      updated[contact.id] = !areAllSelected;
    });
    setSelectedContacts(updated);
  };

  const saveEditedMessages = input => {
    const updated = {...templateList};
    selectedEditorContacts.forEach(id => {
      updated[id] = input;
    });
    setTemplateList(updated);
    setEditingMessages([]);
  };

  if (loading) {
    return (
      <View
        style={[styles.container, {backgroundColor: theme.colors.background}]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, {color: theme.colors.onBackground}]}>
          Loading contacts...
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, {backgroundColor: theme.colors.background}]}>
      {/* Top Banner Ad */}
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={AD_UNIT_TOP}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => console.log('Top banner ad loaded')}
          onAdFailedToLoad={error =>
            console.log('Top banner ad failed to load: ', error)
          }
        />
      </View>

      <Text style={[styles.header, {color: theme.colors.onBackground}]}>
        Select Contacts
      </Text>

      <View
        style={[
          styles.pointsContainer,
          {backgroundColor: theme.colors.surfaceVariant},
        ]}>
        <Text
          style={[styles.pointsText, {color: theme.colors.onSurfaceVariant}]}>
          💰 Points: {points}
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <DataTable>
          <DataTable.Header
            style={[
              styles.tableHeader,
              {backgroundColor: theme.colors.surfaceVariant},
            ]}>
            <DataTable.Title style={{flex: 0.5, justifyContent: 'center'}}>
              <View style={styles.checkboxContainer}>
                <Checkbox
                  status={areAllSelected ? 'checked' : 'unchecked'}
                  onPress={toggleSelectAll}
                  color={theme.colors.primary}
                />
              </View>
            </DataTable.Title>
            <DataTable.Title style={{flex: 1}}>
              <Text
                style={[styles.tableTitle, {color: theme.colors.onSurface}]}>
                👤 Name
              </Text>
            </DataTable.Title>
            <DataTable.Title style={{flex: 2}}>
              <Text
                style={[styles.tableTitle, {color: theme.colors.onSurface}]}>
                📱 Number
              </Text>
            </DataTable.Title>
            <DataTable.Title style={{flex: 1.5}}>
              <Text
                style={[styles.tableTitle, {color: theme.colors.onSurface}]}>
                💬 Edit Message
              </Text>
            </DataTable.Title>
          </DataTable.Header>

          {contacts.map(contact => {
            const isChecked = !!selectedContacts[contact.id];
            return (
              <DataTable.Row
                key={contact.id}
                onPress={() => toggleSelect(contact.id)}
                style={[styles.row, {borderBottomColor: theme.colors.outline}]}>
                <DataTable.Cell style={{flex: 0.5}}>
                  <Checkbox
                    status={isChecked ? 'checked' : 'unchecked'}
                    onPress={() => toggleSelect(contact.id)}
                    color={theme.colors.primary}
                  />
                </DataTable.Cell>
                <DataTable.Cell style={{flex: 1}}>
                  <Text
                    style={[
                      styles.contactText,
                      {color: theme.colors.onSurface},
                    ]}>
                    {contact.name}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell style={{flex: 2}}>
                  <Text
                    style={[
                      styles.contactText,
                      {color: theme.colors.onSurface},
                    ]}>
                    {contact.phone}
                  </Text>
                </DataTable.Cell>
                <DataTable.Cell style={{flex: 1.5}}>
                  <TouchableOpacity
                    onPress={() => openEditorForContacts([contact.id])}
                    style={styles.editButton}>
                    <Text
                      style={[
                        styles.editButtonText,
                        {color: theme.colors.primary},
                      ]}>
                      ✏️ Edit
                    </Text>
                  </TouchableOpacity>
                </DataTable.Cell>
              </DataTable.Row>
            );
          })}
        </DataTable>
      </ScrollView>

      {/* Edit Selected Messages Button */}
      <TouchableOpacity
        style={[
          styles.secondaryButton,
          {backgroundColor: theme.colors.secondaryContainer},
        ]}
        onPress={() =>
          openEditorForContacts(
            Object.entries(selectedContacts)
              .filter(([_, value]) => value === true)
              .map(([key]) => key),
          )
        }>
        <Text
          style={[
            styles.secondaryButtonText,
            {color: theme.colors.onSecondaryContainer},
          ]}>
          ✏️ Edit Selected Messages
        </Text>
      </TouchableOpacity>

      {/* WhatsApp Type Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {color: theme.colors.onBackground}]}>
          Select WhatsApp Type
        </Text>
        <View style={styles.whatsappOptions}>
          <TouchableOpacity
            style={styles.option}
            onPress={() => setWhatsappPackage('com.whatsapp')}>
            <Checkbox
              status={
                whatsappPackage === 'com.whatsapp' ? 'checked' : 'unchecked'
              }
              onPress={() => setWhatsappPackage('com.whatsapp')}
              color={theme.colors.primary}
            />
            <Text style={[styles.optionText, {color: theme.colors.onSurface}]}>
              Normal WhatsApp
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => setWhatsappPackage('com.whatsapp.w4b')}>
            <Checkbox
              status={
                whatsappPackage === 'com.whatsapp.w4b' ? 'checked' : 'unchecked'
              }
              onPress={() => setWhatsappPackage('com.whatsapp.w4b')}
              color={theme.colors.primary}
            />
            <Text style={[styles.optionText, {color: theme.colors.onSurface}]}>
              WhatsApp Business
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Help Option */}
      <View
        style={[
          styles.helpSection,
          {backgroundColor: theme.colors.surfaceVariant},
        ]}>
        <Checkbox
          status={needsHelp ? 'checked' : 'unchecked'}
          onPress={() => setNeedsHelp(!needsHelp)}
          color={theme.colors.primary}
        />
        <Text style={[styles.helpText, {color: theme.colors.onSurfaceVariant}]}>
          I need additional help with sending messages (automated mode)
        </Text>
      </View>

      {/* Main Send Button */}
      <TouchableOpacity
        style={[styles.sendButton, {backgroundColor: theme.colors.primary}]}
        onPress={handleSendMessages}
        disabled={isSending}>
        <Text style={[styles.sendButtonText, {color: theme.colors.onPrimary}]}>
          {isSending
            ? 'Sending...'
            : needsHelp
            ? 'Send Messages Automatically'
            : 'Send Messages Manually'}
        </Text>
      </TouchableOpacity>

      {/* Bottom Banner Ad */}
      <View style={styles.bannerContainer}>
        <BannerAd
          unitId={AD_UNIT_BOTTOM}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => console.log('Bottom banner ad loaded')}
          onAdFailedToLoad={error =>
            console.log('Bottom banner ad failed to load: ', error)
          }
        />
      </View>

      {/* Message Editor Modal */}
      {isModalVisible && (
        <MessageEditorModal
          isModalVisible={isModalVisible}
          setIsModalVisible={setIsModalVisible}
          setMessages={setEditingMessages}
          handleSave={saveEditedMessages}
          campaign={campaign}
          initialMessages={editingMessages}
          templateList={templateList}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  bannerContainer: {
    marginBottom: 6,
    alignItems: 'center',
  },
  header: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  pointsContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    maxHeight: 400,
    marginBottom: 16,
  },
  tableHeader: {
    height: 56,
    alignItems: 'center',
    paddingVertical: 0,
  },
  tableTitle: {
    fontWeight: '600',
    fontSize: 14,
  },
  checkboxContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  row: {
    borderBottomWidth: 1,
  },
  contactText: {
    fontSize: 14,
  },
  editButton: {
    padding: 4,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  secondaryButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  whatsappOptions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  optionText: {
    marginLeft: 4,
    fontSize: 14,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  helpText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  sendButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  sendButtonText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ContactFilterScreen;
