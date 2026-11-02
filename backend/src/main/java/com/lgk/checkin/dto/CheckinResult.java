package com.lgk.checkin.dto;

import java.time.LocalDateTime;

public record CheckinResult(
        Long recordId,
        Long taskId,
        String taskTitle,
        LocalDateTime checkinTime,
        long checkedCount,
        int expectedCount
) {
}
