package com.lgk.checkin.dto;

import com.lgk.checkin.domain.CheckinRecord;

import java.time.LocalDateTime;

public record RecordView(
        Long id,
        Long taskId,
        String taskTitle,
        Long userId,
        String nickname,
        String avatarUrl,
        LocalDateTime checkinTime,
        String method,
        String clientIp
) {

    public static RecordView from(CheckinRecord record) {
        return new RecordView(
                record.getId(),
                record.getTask().getId(),
                record.getTask().getTitle(),
                record.getUser().getId(),
                record.getUser().getNickname(),
                record.getUser().getAvatarUrl(),
                record.getCheckinTime(),
                record.getMethod().name(),
                record.getClientIp()
        );
    }
}
