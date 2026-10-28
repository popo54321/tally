package com.bodyandiron.traininglog;

import android.app.Activity;
import android.webkit.ValueCallback;

final class BackResult implements ValueCallback<String> {

    private final Activity act;

    BackResult(Activity act) {
        this.act = act;
    }

    @Override
    public void onReceiveValue(String handled) {
        if (!"true".equals(handled)) act.moveTaskToBack(true);
    }
}
