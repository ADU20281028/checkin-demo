package com.lgk.checkin.dto;

import jakarta.validation.constraints.NotBlank;

public record CheckinRequest(
        @NotBlank(message = "签到二维码不能为空")
        String qrToken
) {
}
