package com.lgk.checkin.dto;

public record LoginResponse(String token, UserView user) {
}
