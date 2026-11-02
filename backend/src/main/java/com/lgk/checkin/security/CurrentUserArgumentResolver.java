package com.lgk.checkin.security;

import com.lgk.checkin.common.ApiException;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    public static final String ATTR_NAME = "authUser";

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentUser.class)
                && parameter.getParameterType().equals(AuthUser.class);
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        Object authUser = webRequest.getAttribute(ATTR_NAME, NativeWebRequest.SCOPE_REQUEST);
        if (authUser == null) {
            throw new ApiException(401, "UNAUTHORIZED", "请先登录");
        }
        return authUser;
    }
}
