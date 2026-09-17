package io.github.maftyuc0105.abinhouse;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 边到边显示，状态栏和导航栏区域由网页用安全区变量留白
        EdgeToEdge.enable(this);
    }
}
