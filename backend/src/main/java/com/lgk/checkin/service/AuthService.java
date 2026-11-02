package com.lgk.checkin.service;

import com.lgk.checkin.common.ApiException;
import com.lgk.checkin.config.AppProperties;
import com.lgk.checkin.domain.Role;
import com.lgk.checkin.domain.User;
import com.lgk.checkin.dto.LoginRequest;
import com.lgk.checkin.dto.LoginResponse;
import com.lgk.checkin.dto.UserView;
import com.lgk.checkin.repo.UserRepository;
import com.lgk.checkin.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final WeChatService weChatService;
    private final JwtService jwtService;
    private final AppProperties properties;

    @Transactional
    public LoginResponse login(LoginRequest request) {
        String code = request.code().trim();
        boolean devAdminLogin = properties.isDevMode()
                && StringUtils.hasText(properties.getAdminCode())
                && properties.getAdminCode().equals(code);

        String openid;
        if (properties.isDevMode() && code.startsWith("dev-")) {
            // 开发调试登录：不调用微信接口，便于本地联调与管理端登录
            openid = code;
        } else {
            openid = weChatService.exchangeOpenid(code);
        }

        User user = userRepository.findByOpenid(openid).orElseGet(() -> {
            User created = new User();
            created.setOpenid(openid);
            created.setNickname(resolveNickname(request, openid));
            created.setAvatarUrl(request.avatarUrl());
            created.setRole(Role.USER);
            created.setCreatedAt(LocalDateTime.now());
            return created;
        });

        if (StringUtils.hasText(request.nickname())) {
            user.setNickname(request.nickname().trim());
        }
        if (StringUtils.hasText(request.avatarUrl())) {
            user.setAvatarUrl(request.avatarUrl());
        }
        if (devAdminLogin || (properties.getAdminOpenids() != null
                && properties.getAdminOpenids().contains(openid))) {
            user.setRole(Role.ADMIN);
        }

        userRepository.save(user);
        String token = jwtService.issueAccessToken(user);
        return new LoginResponse(token, UserView.from(user));
    }

    private String resolveNickname(LoginRequest request, String openid) {
        if (StringUtils.hasText(request.nickname())) {
            return request.nickname().trim();
        }
        if ("dev-admin".equals(openid)) {
            return "管理员";
        }
        return "微信用户";
    }

    @Transactional(readOnly = true)
    public UserView currentUser(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ApiException(401, "USER_NOT_FOUND", "用户不存在，请重新登录"));
        return UserView.from(user);
    }
}
