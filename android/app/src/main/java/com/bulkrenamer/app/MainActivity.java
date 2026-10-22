package com.bulkrenamer.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
