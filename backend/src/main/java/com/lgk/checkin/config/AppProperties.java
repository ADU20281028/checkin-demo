package com.lgk.checkin.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    /** 开发模式：允许 dev- 开头的模拟登录，生产环境必须关闭 */
    private boolean devMode = false;

    /** 管理端登录码，仅在开发模式生效 */
    private String adminCode = "dev-admin";

    /** JWT 签名密钥，长度至少 32 字节 */
    private String jwtSecret;

    /** 登录令牌有效期（小时） */
    private int accessTokenHours = 168;

    /** 二维码默认有效期（秒） */
    private int qrTtlSeconds = 60;

    /** 管理员 openid 白名单 */
    private List<String> adminOpenids = new ArrayList<>();

    private Wechat wechat = new Wechat();

    @Getter
    @Setter
    public static class Wechat {
        private String appId = "";
        private String secret = "";
    }
}
