package com.mnemo.mobile;

import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int APP_PAPER_COLOR = Color.rgb(242, 243, 245);

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MnemoWebDavPlugin.class);
        setTheme(R.style.AppTheme_NoActionBar);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().getDecorView().setBackgroundColor(APP_PAPER_COLOR);
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(APP_PAPER_COLOR);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        getBridge().getWebView().setBackgroundColor(APP_PAPER_COLOR);
    }
}
