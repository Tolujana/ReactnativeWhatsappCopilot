package com.copilot3;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.provider.Settings;
import android.widget.Toast;

public class OverlayService extends Service {
    private WindowManager windowManager;
    private View overlayView;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            // Permission not granted, stop the service to avoid crash
            Toast.makeText(this, "Overlay permission not granted", Toast.LENGTH_SHORT).show();
            stopSelf();
            return;
        }

        overlayView = LayoutInflater.from(this).inflate(R.layout.overlay_button, null);

        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.END;
        params.x = 20;
        params.y = 100;

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        windowManager.addView(overlayView, params);

        Button nextButton = overlayView.findViewById(R.id.btn_next);
        nextButton.setOnClickListener(v -> {
            ManualWhatsAppSendService.openNextFromOverlay();
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (overlayView != null) windowManager.removeView(overlayView);
    }
}
