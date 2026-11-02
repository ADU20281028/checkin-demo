package com.lgk.checkin.domain;

import java.time.LocalDateTime;

public enum TaskStatus {
    PENDING,
    ONGOING,
    ENDED;

    public static TaskStatus of(LocalDateTime startTime, LocalDateTime endTime, LocalDateTime now) {
        if (now.isBefore(startTime)) {
            return PENDING;
        }
        return now.isAfter(endTime) ? ENDED : ONGOING;
    }
}
