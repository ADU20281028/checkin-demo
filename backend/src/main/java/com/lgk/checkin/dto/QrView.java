package com.lgk.checkin.dto;

import java.time.LocalDateTime;

public record QrView(
        Long taskId,
        String token,
        String imageUrl,
        LocalDateTime expiresAt,
        int ttlSeconds
) {
}
