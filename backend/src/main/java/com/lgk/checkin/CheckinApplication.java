package com.lgk.checkin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

import java.util.TimeZone;

@SpringBootApplication
@ConfigurationPropertiesScan
public class CheckinApplication {

    public static void main(String[] args) {
        // 业务时间统一按北京时间处理，避免服务器时区差异导致签到窗口判断错误
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Shanghai"));
        SpringApplication.run(CheckinApplication.class, args);
    }
}
