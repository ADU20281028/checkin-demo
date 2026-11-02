package com.lgk.checkin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record CreateTaskRequest(
        @NotBlank(message = "签到主题不能为空")
        @Size(max = 80, message = "签到主题不能超过 80 个字符")
        String title,

        @Size(max = 500, message = "签到说明不能超过 500 个字符")
        String description,

        @Size(max = 120, message = "签到地点不能超过 120 个字符")
        String location,

        @NotNull(message = "签到开始时间不能为空")
        LocalDateTime startTime,

        @NotNull(message = "签到结束时间不能为空")
        LocalDateTime endTime,

        @Min(value = 0, message = "应到人数不能为负数")
        @Max(value = 10000, message = "应到人数过大")
        Integer expectedCount,

        @Min(value = 30, message = "二维码有效期不能少于 30 秒")
        @Max(value = 600, message = "二维码有效期不能超过 600 秒")
        Integer qrTtlSeconds
) {
}
