import {useEffect} from 'react';
import {DeviceEventEmitter} from 'react-native';

export default function useWhatsappReportListener(
  shouldListen,
  onReportReceived,
) {
  useEffect(() => {
    if (!shouldListen) return;

    const subscription = DeviceEventEmitter.addListener(
      'onMessageSendReport',
      report => {
        console.log('🔥 WhatsApp Report received:', report);
        if (report?.sent_count !== undefined) {
          console.log('✅ sent_count:', report.sent_count);
        } else {
          console.log('⚠️ sent_count missing in report:', report);
        }

        if (onReportReceived) {
          onReportReceived(report);
        }
      },
    );

    return () => subscription.remove();
  }, [shouldListen, onReportReceived]);
}
