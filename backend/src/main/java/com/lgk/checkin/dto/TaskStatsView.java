package com.lgk.checkin.dto;

import com.lgk.checkin.domain.TaskStatus;

import java.time.LocalDateTime;
import java.util.List;

public record TaskStatsView(
        Long taskId,
        String title,
        TaskStatus status,
        LocalDateTime startTime,
        LocalDateTime endTime,
        int expectedCount,
        long checkedCount,
        int absentCount,
        double attendanceRate,
        List<RecordView> records
) {
}
