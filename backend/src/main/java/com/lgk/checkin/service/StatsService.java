package com.lgk.checkin.service;

import com.lgk.checkin.common.Guards;
import com.lgk.checkin.domain.CheckinRecord;
import com.lgk.checkin.domain.CheckinTask;
import com.lgk.checkin.domain.TaskStatus;
import com.lgk.checkin.dto.OverviewView;
import com.lgk.checkin.dto.RecordView;
import com.lgk.checkin.dto.TaskStatsView;
import com.lgk.checkin.dto.TaskView;
import com.lgk.checkin.repo.CheckinRecordRepository;
import com.lgk.checkin.repo.CheckinTaskRepository;
import com.lgk.checkin.repo.UserRepository;
import com.lgk.checkin.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StatsService {

    private final CheckinTaskRepository taskRepository;
    private final CheckinRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final TaskService taskService;

    public TaskStatsView taskStats(Long taskId, AuthUser authUser) {
        Guards.requireAdmin(authUser);
        CheckinTask task = taskService.getEntity(taskId);
        List<CheckinRecord> records = recordRepository.findByTaskIdOrderByCheckinTimeAsc(taskId);
        int expected = taskService.expectedCountOf(task);
        long checked = records.size();
        int absent = Math.max(0, expected - (int) checked);
        double rate = expected == 0 ? 0.0
                : Math.round(checked * 1000.0 / expected) / 10.0;
        return new TaskStatsView(
                task.getId(),
                task.getTitle(),
                TaskStatus.of(task.getStartTime(), task.getEndTime(), LocalDateTime.now()),
                task.getStartTime(),
                task.getEndTime(),
                expected,
                checked,
                absent,
                rate,
                records.stream().map(RecordView::from).toList()
        );
    }

    public OverviewView overview(AuthUser authUser) {
        Guards.requireAdmin(authUser);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        List<CheckinTask> tasks = taskRepository.findAllByOrderByStartTimeDesc();
        Map<Long, Long> counts = taskService.checkedCounts();
        List<TaskView> recentTasks = tasks.stream()
                .limit(6)
                .map(task -> taskService.buildView(task, counts, Map.of()))
                .toList();
        return new OverviewView(
                userRepository.count(),
                taskRepository.count(),
                taskRepository.countOngoing(now),
                recordRepository.count(),
                recordRepository.countByCheckinTimeBetween(todayStart, todayStart.plusDays(1)),
                recentTasks
        );
    }
}
