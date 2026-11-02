package com.lgk.checkin.dto;

import com.lgk.checkin.domain.Role;
import com.lgk.checkin.domain.User;

public record UserView(Long id, String nickname, String avatarUrl, Role role) {

    public static UserView from(User user) {
        return new UserView(user.getId(), user.getNickname(), user.getAvatarUrl(), user.getRole());
    }
}
