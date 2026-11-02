package com.lgk.checkin.dto;

import com.lgk.checkin.domain.TaskStatus;

import java.time.LocalDateTime;

public record TaskView(
        Long id,
        String title,
        String description,
        String location,
        LocalDateTime startTime,
        LocalDateTime endTime,
        TaskStatus status,
        int expectedCount,
        long checkedCount,
        boolean myChecked,
        LocalDateTime myCheckinTime,
        String createdByName
) {
}
