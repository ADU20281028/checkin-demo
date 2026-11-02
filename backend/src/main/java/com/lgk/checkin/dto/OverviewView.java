package com.lgk.checkin.dto;

import java.util.List;

public record OverviewView(
        long totalUsers,
        long totalTasks,
        long ongoingTasks,
        long totalCheckins,
        long todayCheckins,
        List<TaskView> recentTasks
) {
}
