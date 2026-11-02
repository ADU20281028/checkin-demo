package com.lgk.checkin.service;

import com.lgk.checkin.common.ApiException;
import com.lgk.checkin.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class WeChatService {

    private final AppProperties properties;
    private final RestClient restClient = RestClient.create();

    /**
     * 调用微信 jscode2session 接口换取用户 openid。
     */
    public String exchangeOpenid(String code) {
        String appId = properties.getWechat().getAppId();
        String secret = properties.getWechat().getSecret();
        if (!StringUtils.hasText(appId) || !StringUtils.hasText(secret)) {
            throw new ApiException(503, "WECHAT_NOT_CONFIGURED",
                    "后端未配置微信 AppID/Secret，请在开发模式下使用模拟登录或完善配置");
        }
        try {
            Map<String, Object> body = restClient.get()
                    .uri("https://api.weixin.qq.com/sns/jscode2session?appid={appid}&secret={secret}&js_code={code}&grant_type=authorization_code",
                            appId, secret, code)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {
                    });
            if (body == null) {
                throw new ApiException(502, "WECHAT_LOGIN_FAILED", "微信登录失败，请稍后重试");
            }
            Object errcode = body.get("errcode");
            if (errcode != null && !Objects.equals(0, ((Number) errcode).intValue())) {
                log.warn("微信登录失败: errcode={}, errmsg={}", errcode, body.get("errmsg"));
                throw new ApiException(401, "WECHAT_LOGIN_FAILED", "微信登录失败：" + body.get("errmsg"));
            }
            Object openid = body.get("openid");
            if (openid == null || !StringUtils.hasText(openid.toString())) {
                throw new ApiException(401, "WECHAT_LOGIN_FAILED", "未能获取微信身份标识");
            }
            return openid.toString();
        } catch (RestClientException e) {
            log.error("请求微信接口异常", e);
            throw new ApiException(502, "WECHAT_UNAVAILABLE", "微信服务暂时不可用");
        }
    }
}
