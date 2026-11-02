package com.lgk.checkin.security;

import com.lgk.checkin.domain.Role;

/**
 * 通过 JWT 解析得到的当前登录用户信息，不包含敏感字段。
 */
public record AuthUser(Long id, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
