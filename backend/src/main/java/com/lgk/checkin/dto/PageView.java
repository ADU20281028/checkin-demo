package com.lgk.checkin.dto;

import java.util.List;

public record PageView<T>(List<T> list, long total, int page, int size) {
}
