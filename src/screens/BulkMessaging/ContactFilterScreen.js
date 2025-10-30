/* ContactFilterScreen.js
   Updated: Notifee scheduling + background auto-send fallback
*/

import React, {useCallback, useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import notifee, {
  TriggerType,
  TimestampTrigger,
  EventType,
} from '@notifee/react-native';

// Storage keys
const SETTINGS_KEYS = {
  WHATSAPP_PACKAGE: 'whatsapp_package',
  NEEDS_HELP: 'needs_help',
  SCHEDULED_MESSAGES_KEY: 'scheduled_messages_v1',
};

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

  // Scheduling UI state - Separate date and time pickers
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState(null);
  const [scheduledTime, setScheduledTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setHours(10, 0, 0, 0);
    defaultTime.setDate(defaultTime.getDate()); // today
    return defaultTime;
  });
  const pendingScheduleRef = useRef(null); // store pending payload while user picks date

  // Your actual ad unit IDs (replace with your own)
  const AD_UNIT_TOP = __DEV__ ? TestIds.BANNER : TestIds.BANNER;
  const AD_UNIT_BOTTOM = __DEV__ ? TestIds.BANNER : TestIds.BANNER;

  // Load settings from AsyncStorage
  const loadSettings = async () => {
    try {
      const [savedPackage, savedNeedsHelp] = await Promise.all([
        AsyncStorage.getItem(SETTINGS_KEYS.WHATSAPP_PACKAGE),
        AsyncStorage.getItem(SETTINGS_KEYS.NEEDS_HELP),
      ]);

      if (savedPackage) {
        setWhatsappPackage(savedPackage);
      }
      if (savedNeedsHelp !== null) {
        setNeedsHelp(JSON.parse(savedNeedsHelp));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveWhatsappPackage = async packageName => {
    try {
      setWhatsappPackage(packageName);
      await AsyncStorage.setItem(SETTINGS_KEYS.WHATSAPP_PACKAGE, packageName);
      console.log('WhatsApp package saved:', packageName);
    } catch (error) {
      console.error('Failed to save WhatsApp package:', error);
    }
  };

  const saveNeedsHelp = async value => {
    try {
      setNeedsHelp(value);
      await AsyncStorage.setItem(
        SETTINGS_KEYS.NEEDS_HELP,
        JSON.stringify(value),
      );
      console.log('Needs help setting saved:', value);
    } catch (error) {
      console.error('Failed to save needs help setting:', error);
    }
  };

  const openSettings = () => {
    try {
      AccessibilityHelper.openAccessibilitySettings();
    } catch (e) {
      console.warn('openSettings failed', e);
    }
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
      loadSettings();
      // ensure notifee channel exists
      (async () => {
        try {
          await notifee.createChannel({
            id: 'scheduled-messages',
            name: 'Scheduled Messages',
            importance: 4,
          });
        } catch (e) {
          console.warn('notifee channel create failed', e);
        }
      })();
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

  // Listen for foreground notification press events to handle fallback
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({type, detail}) => {
      // EventType.PRESS is numeric in older versions; use EventType.PRESS from notifee if needed
      if (
        type === EventType.PRESS &&
        detail.notification?.data?.scheduledJobId
      ) {
        // If notification contains scheduled job id, attempt to send now (fallback)
        handleNotificationSendFallback(detail.notification.data);
      }
    });
    return () => unsubscribe();
  }, []);

  // Helper: when user taps notification fallback, send messages now (in foreground)
  const handleNotificationSendFallback = async data => {
    try {
      const parsed =
        typeof data.payload === 'string'
          ? JSON.parse(data.payload)
          : data.payload;
      if (!parsed || !parsed.personalizedMessages) {
        Alert.alert('Scheduled job data missing');
        return;
      }

      const personalizedMessages = parsed.personalizedMessages;
      // try to send — this will use your existing logic (Accessibility / overlay checked inside launchWhatsappMessage)
      launchWhatsappMessage(personalizedMessages, whatsappPackage);
    } catch (e) {
      console.error('Fallback send failed', e);
      Alert.alert(
        'Send failed',
        'Could not send scheduled messages automatically.',
      );
    }
  };

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

  // Utility to replace placeholders
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
      Alert.alert('Error', 'Text is too long. Please reduce the message size.');
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

  // Schedule notification (Notifee) and save scheduled job to DB via insertSentMessage
  const scheduleNotificationAndSave = async (
    personalizedMessages,
    selectedIds,
    whenDate,
  ) => {
    // prepare payload
    const scheduledPayload = {
      isScheduled: true,
      scheduledTime: whenDate.toISOString(),
      campaignId: campaign.id,
      personalizedMessages, // array of {phone, message[], name, mediaPath}
      selectedIds,
    };

    try {
      // 1) create database record (store payload as data)

      const rowId = await insertSentMessage(
        [{...scheduledPayload, sent: false}],
        new Date().toISOString(),
      );
      // The insertSentMessage currently returns id of row
      // We attach that id to the notification data for reference
      const notificationId = `scheduled-${rowId || Date.now()}`;

      // 2) schedule notifee trigger
      const trigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: whenDate.getTime(),
      };

      await notifee.createTriggerNotification(
        {
          id: notificationId,
          title: 'Scheduled messages: ready to send',
          body: `Scheduled ${
            personalizedMessages.length
          } message(s) — sending at ${whenDate.toLocaleString()}`,
          android: {
            channelId: 'scheduled-messages',
            pressAction: {id: 'default'},
            // allow while idle for Doze (best-effort)
            allowWhileIdle: true,
          },
          // embed job data (stringify to be safe)
          data: {
            scheduledJobId: String(rowId || notificationId),
            payload: JSON.stringify(scheduledPayload),
          },
        },
        trigger,
      );

      return {rowId, notificationId};
    } catch (e) {
      console.error('scheduleNotificationAndSave failed', e);
      throw e;
    }
  };

  // Complete scheduling with both date and time
  const completeScheduling = async (date, time) => {
    const pending = pendingScheduleRef.current;
    if (!pending) {
      Alert.alert('Error', 'No scheduled job found.');
      return;
    }

    const {personalizedMessages, selectedIds} = pending;
    setIsSending(true);

    try {
      const when = new Date(date);
      when.setHours(time.getHours());
      when.setMinutes(time.getMinutes());
      when.setSeconds(0);
      when.setMilliseconds(0);

      const reserveResult = await reservePointsForMessagesByIds(selectedIds);
      if (reserveResult?.new_balance !== undefined)
        setPoints(reserveResult.new_balance);
      else if (typeof reserveResult === 'number') setPoints(reserveResult);

      await scheduleNotificationAndSave(
        personalizedMessages,
        selectedIds,
        when,
      );

      Alert.alert(
        'Scheduled',
        `Messages scheduled for ${when.toLocaleString()}`,
      );
    } catch (e) {
      console.error('Schedule error', e);

      // handle insufficient points
      if (e.code === 'INSUFFICIENT_POINTS') {
        setIsSending(false);
        return handleInsufficientPoints(e);
      }
      Alert.alert(
        'Schedule failed',
        'Could not schedule messages; please try again.',
      );
    } finally {
      pendingScheduleRef.current = null;
      setTempDate(null);
      setIsSending(false);
    }
  };

  // Date picked handler
  const onDatePicked = (event, date) => {
    setShowDatePicker(false);

    if (event.type === 'dismissed' || !date) {
      pendingScheduleRef.current = null;
      return;
    }

    setTempDate(date);
    setShowTimePicker(true);
  };

  // Time picked handler
  const onTimePicked = (event, time) => {
    setShowTimePicker(false);

    if (event.type === 'dismissed' || !time) {
      pendingScheduleRef.current = null;
      setTempDate(null);
      return;
    }

    completeScheduling(tempDate, time);
  };

  // Main send handler (keeps your original flow but integrates schedule)
  const handleSendMessages1 = async () => {
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

    // Build personalized messages now so we store/launch same payload later
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

    // Ask user whether to Send Now or Schedule
    Alert.alert(
      'Send Type',
      'Do you want to send messages now !',
      [
        {
          text: 'Dont Send',
          style: 'cancel',
          onPress: () => setIsSending(false),
        },
        {
          text: 'Send Now',
          onPress: async () => {
            // Send Now flow:
            try {
              // Permission checks
              if (needsHelp) {
                const enabled = await checkAccessibilityPermission();
                if (!enabled) {
                  Alert.alert(
                    'Permission Required',
                    'Accessibility is required for automated sending. Please enable it in settings.',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsSending(false),
                      },
                      {text: 'Go to Settings', onPress: openSettings},
                    ],
                  );
                  return;
                }
              } else {
                const overlayGranted = await checkOverlayPermission();
                if (!overlayGranted) {
                  Alert.alert(
                    'Overlay Permission Required',
                    'Overlay permission is required for manual sending. Enable it in settings.',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsSending(false),
                      },
                      {text: 'Go to Settings', onPress: openOverlaySettings},
                    ],
                  );
                  return;
                }
              }

              // Reserve / deduct points (immediately before actual send)
              try {
                const newBalance = await reservePointsForMessagesByIds(
                  selectedIds,
                );
                if (newBalance?.new_balance !== undefined) {
                  // some bridges return more complex object, but your JS wrapper returns a value
                  // update points using whatever shape you get
                  if (typeof newBalance === 'number') setPoints(newBalance);
                  else if (newBalance.new_balance)
                    setPoints(newBalance.new_balance);
                } else {
                  // if reserve returned a number
                  if (typeof newBalance === 'number') setPoints(newBalance);
                }
              } catch (reserveErr) {
                // handle insufficient points
                if (reserveErr && reserveErr.code === 'INSUFFICIENT_POINTS') {
                  setIsSending(false);
                  return handleInsufficientPoints(reserveErr);
                }
                throw reserveErr;
              }

              // Insert into sentmessages log (immediate send) - store payload for reporting
              try {
                await insertSentMessage(
                  [
                    {
                      isScheduled: false,
                      scheduledTime: null,
                      campaignId: campaign.id,
                      personalizedMessages,
                    },
                  ],
                  new Date().toISOString(),
                );
              } catch (e) {
                console.warn(
                  'Failed to insertSentMessage log for immediate send',
                  e,
                );
              }

              // Launch send (your existing function handles the details)
              launchWhatsappMessage(personalizedMessages, whatsappPackage);
              navigation.navigate('WhatsappResultScreen', {
                totalContacts: personalizedMessages,
                whatsappPackage,
              });
            } catch (e) {
              console.error('Send Now error', e);
              Alert.alert('Error', String(e.message || e));
            } finally {
              setIsSending(false);
            }
          },
        },
        // {
        //   text: 'Schedule',
        //   onPress: async () => {
        //     // Schedule flow:
        //     // We'll keep UI open for user to pick a date/time
        //     // Save the pending payload into a ref while user picks date
        //     pendingScheduleRef.current = {personalizedMessages, selectedIds};
        //     setShowDatePicker(true);
        //     setIsSending(false); // show button as idle while user chooses time
        //   },
        // },
      ],
      {cancelable: true},
    );
  };

  // Main send handler (keeps your original flow but integrates schedule)
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

    // Build personalized messages now so we store/launch same payload later
    const personalizedMessages = contactsToSend
      .map(contact => {
        const messages = replaceContactPlaceholders(
          templateList[contact.id] || message,
          contact,
        );
        if (!messages) return null;

        // FIX: Use bulk media.uri if available, else contact.mediaPath
        const mediaPath = media ? media.uri : contact.mediaPath;

        return {
          phone: contact.phone,
          message: messages,
          name: contact.name,
          mediaPath, // Now includes bulk media!
        };
      })
      .filter(msg => msg !== null);

    if (personalizedMessages.length === 0) {
      Alert.alert('Error', 'No valid messages could be generated.');
      setIsSending(false);
      return;
    }

    // NEW: Validate media URI if media is present
    if (
      media &&
      !media.uri.startsWith('file://') &&
      !media.uri.startsWith('content://')
    ) {
      Alert.alert('Invalid Media URI', 'Please select a valid image.');
      setIsSending(false); // Reset UI state
      return;
    }

    // Ask user whether to Send Now or Schedule
    Alert.alert(
      'Send Type',
      'Do you want to send messages now !',
      [
        {
          text: 'Dont Send',
          style: 'cancel',
          onPress: () => setIsSending(false),
        },
        {
          text: 'Send Now',
          onPress: async () => {
            // Send Now flow:
            try {
              // Permission checks
              if (needsHelp) {
                const enabled = await checkAccessibilityPermission();
                if (!enabled) {
                  Alert.alert(
                    'Permission Required',
                    'Accessibility is required for automated sending. Please enable it in settings.',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsSending(false),
                      },
                      {text: 'Go to Settings', onPress: openSettings},
                    ],
                  );
                  return;
                }
              } else {
                const overlayGranted = await checkOverlayPermission();
                if (!overlayGranted) {
                  Alert.alert(
                    'Overlay Permission Required',
                    'Overlay permission is required for manual sending. Enable it in settings.',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                        onPress: () => setIsSending(false),
                      },
                      {text: 'Go to Settings', onPress: openOverlaySettings},
                    ],
                  );
                  return;
                }
              }

              // Reserve / deduct points (immediately before actual send)
              try {
                const newBalance = await reservePointsForMessagesByIds(
                  selectedIds,
                );
                if (newBalance?.new_balance !== undefined) {
                  // some bridges return more complex object, but your JS wrapper returns a value
                  // update points using whatever shape you get
                  if (typeof newBalance === 'number') setPoints(newBalance);
                  else if (newBalance.new_balance)
                    setPoints(newBalance.new_balance);
                } else {
                  // if reserve returned a number
                  if (typeof newBalance === 'number') setPoints(newBalance);
                }
              } catch (reserveErr) {
                // handle insufficient points
                if (reserveErr && reserveErr.code === 'INSUFFICIENT_POINTS') {
                  setIsSending(false);
                  return handleInsufficientPoints(reserveErr);
                }
                throw reserveErr;
              }

              // Insert into sentmessages log (immediate send) - store payload for reporting
              try {
                await insertSentMessage(
                  [
                    {
                      isScheduled: false,
                      scheduledTime: null,
                      campaignId: campaign.id,
                      personalizedMessages,
                    },
                  ],
                  new Date().toISOString(),
                );
              } catch (e) {
                console.warn(
                  'Failed to insertSentMessage log for immediate send',
                  e,
                );
              }

              // Launch send (your existing function handles the details)
              launchWhatsappMessage(personalizedMessages, whatsappPackage);
              navigation.navigate('WhatsappResultScreen', {
                totalContacts: personalizedMessages,
                whatsappPackage,
              });
            } catch (e) {
              console.error('Send Now error', e);
              Alert.alert('Error', String(e.message || e));
            } finally {
              setIsSending(false);
            }
          },
        },
        // {
        //   text: 'Schedule',
        //   onPress: async () => {
        //     // Schedule flow:
        //     // We'll keep UI open for user to pick a date/time
        //     // Save the pending payload into a ref while user picks date
        //     pendingScheduleRef.current = {personalizedMessages, selectedIds};
        //     setShowDatePicker(true);
        //     setIsSending(false); // show button as idle while user chooses time
        //   },
        // },
      ],
      {cancelable: true},
    );
  };

  // Handle insufficient points flow (watch ad / earn)
  const handleInsufficientPoints = async err => {
    try {
      Alert.alert(
        'Not enough points',
        `${
          err.message || 'Insufficient points.'
        }\nWatch a rewarded ad to earn points and continue?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {},
          },
          {
            text: 'Watch Ad',
            onPress: async () => {
              try {
                const reward = await showRewardedAd();
                await fetchPoints();
                Alert.alert(
                  'Points earned!',
                  `You earned ${reward.amount} points. New balance: ${reward.balance}.`,
                );
              } catch (adErr) {
                if (adErr.code === 'REWARD_SAVE_ERR') {
                  Alert.alert(
                    'Error',
                    'Failed to save points to database. Please try again.',
                  );
                } else {
                  Alert.alert('Ad failed', String(adErr.message || adErr));
                }
              }
            },
          },
        ],
      );
    } catch (e) {
      console.error('handleInsufficientPoints error', e);
    }
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
          requestOptions={{requestNonPersonalizedAdsOnly: true}}
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
            onPress={() => saveWhatsappPackage('com.whatsapp')}>
            <Checkbox
              status={
                whatsappPackage === 'com.whatsapp' ? 'checked' : 'unchecked'
              }
              onPress={() => saveWhatsappPackage('com.whatsapp')}
              color={theme.colors.primary}
            />
            <Text style={[styles.optionText, {color: theme.colors.onSurface}]}>
              Normal WhatsApp
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => saveWhatsappPackage('com.whatsapp.w4b')}>
            <Checkbox
              status={
                whatsappPackage === 'com.whatsapp.w4b' ? 'checked' : 'unchecked'
              }
              onPress={() => saveWhatsappPackage('com.whatsapp.w4b')}
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
          onPress={() => saveNeedsHelp(!needsHelp)}
          color={theme.colors.primary}
        />
        <Text style={[styles.helpText, {color: theme.colors.onSurfaceVariant}]}>
          I need additional help with sending messages (automated mode)
        </Text>
      </View>

      {/* Separate Date and Time Pickers */}
      {showDatePicker && (
        <DateTimePicker
          value={scheduledTime}
          mode="date"
          display="default"
          minimumDate={new Date(Date.now() + 1000 * 30)}
          onChange={onDatePicked}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={scheduledTime}
          mode="time"
          display="default"
          onChange={onTimePicked}
        />
      )}

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
          requestOptions={{requestNonPersonalizedAdsOnly: true}}
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

// Styles remain the same (copied from your original)
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
