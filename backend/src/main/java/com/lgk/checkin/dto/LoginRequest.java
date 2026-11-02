package com.lgk.checkin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "登录凭证不能为空")
        String code,

        @Size(max = 40, message = "昵称长度不能超过 40 个字符")
        String nickname,

        @Size(max = 512, message = "头像地址过长")
        String avatarUrl
) {
}
