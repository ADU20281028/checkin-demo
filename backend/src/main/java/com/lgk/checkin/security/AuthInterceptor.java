package com.lgk.checkin.security;

import com.lgk.checkin.common.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class AuthInterceptor implements HandlerInterceptor {

    private final JwtService jwtService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String header = request.getHeader("Authorization");
        if (!StringUtils.hasText(header) || !header.startsWith("Bearer ")) {
            throw new ApiException(401, "UNAUTHORIZED", "请先登录");
        }
        String token = header.substring("Bearer ".length()).trim();
        AuthUser authUser = jwtService.parseAccessToken(token);
        request.setAttribute(CurrentUserArgumentResolver.ATTR_NAME, authUser);
        return true;
    }
}
