package com.lgk.checkin.security;

import java.time.LocalDateTime;

public record QrToken(Long taskId, String token, String tokenId, LocalDateTime expiresAt) {
}
