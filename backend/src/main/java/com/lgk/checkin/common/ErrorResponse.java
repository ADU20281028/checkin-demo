package com.lgk.checkin.common;

import java.time.LocalDateTime;

public record ErrorResponse(String code, String message, LocalDateTime time) {
}
