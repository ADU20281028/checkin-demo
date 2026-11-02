package com.lgk.checkin.service;

import com.lgk.checkin.common.ApiException;
import com.lgk.checkin.common.Guards;
import com.lgk.checkin.config.AppProperties;
import com.lgk.checkin.domain.CheckinRecord;
import com.lgk.checkin.domain.CheckinTask;
import com.lgk.checkin.domain.Role;
import com.lgk.checkin.domain.TaskStatus;
import com.lgk.checkin.domain.User;
import com.lgk.checkin.dto.CreateTaskRequest;
import com.lgk.checkin.dto.TaskView;
import com.lgk.checkin.repo.CheckinRecordRepository;
import com.lgk.checkin.repo.CheckinTaskRepository;
import com.lgk.checkin.repo.UserRepository;
import com.lgk.checkin.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TaskService {

    private final CheckinTaskRepository taskRepository;
    private final CheckinRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final AppProperties properties;

    public List<TaskView> list(AuthUser authUser) {
        List<CheckinTask> tasks = taskRepository.findAllByOrderByStartTimeDesc();
        Map<Long, Long> checkedCounts = checkedCounts();
        Map<Long, LocalDateTime> myCheckins = myCheckins(authUser.id());
        return tasks.stream()
                .map(task -> buildView(task, checkedCounts, myCheckins))
                .toList();
    }

    public TaskView get(Long taskId, AuthUser authUser) {
        CheckinTask task = getEntity(taskId);
        Map<Long, Long> counts = new HashMap<>();
        counts.put(taskId, recordRepository.countByTaskId(taskId));
        Map<Long, LocalDateTime> mine = myCheckins(authUser.id());
        return buildView(task, counts, mine);
    }

    @Transactional
    public TaskView create(CreateTaskRequest request, AuthUser authUser) {
        Guards.requireAdmin(authUser);
        if (!request.endTime().isAfter(request.startTime())) {
            throw new ApiException(400, "TIME_RANGE_INVALID", "签到结束时间必须晚于开始时间");
        }
        User creator = userRepository.findById(authUser.id())
                .orElseThrow(() -> new ApiException(401, "USER_NOT_FOUND", "用户不存在，请重新登录"));

        CheckinTask task = new CheckinTask();
        task.setTitle(request.title().trim());
        task.setDescription(trimToNull(request.description()));
        task.setLocation(trimToNull(request.location()));
        task.setStartTime(request.startTime());
        task.setEndTime(request.endTime());
        task.setExpectedCount(request.expectedCount() == null ? 0 : request.expectedCount());
        task.setQrTtlSeconds(request.qrTtlSeconds() == null
                ? properties.getQrTtlSeconds() : request.qrTtlSeconds());
        task.setCreatedBy(creator);
        task.setCreatedAt(LocalDateTime.now());
        CheckinTask saved = taskRepository.save(task);
        return buildView(saved, Map.of(), Map.of());
    }

    public CheckinTask getEntity(Long taskId) {
        return taskRepository.findById(taskId)
                .orElseThrow(() -> new ApiException(404, "TASK_NOT_FOUND", "签到任务不存在"));
    }

    /**
     * 应到人数：管理员填写的值优先；未填写时按系统内普通用户总数计算。
     */
    public int expectedCountOf(CheckinTask task) {
        if (task.getExpectedCount() > 0) {
            return task.getExpectedCount();
        }
        return (int) userRepository.countByRole(Role.USER);
    }

    public TaskView buildView(CheckinTask task, Map<Long, Long> checkedCounts,
                              Map<Long, LocalDateTime> myCheckins) {
        LocalDateTime now = LocalDateTime.now();
        Long checked = checkedCounts.getOrDefault(task.getId(), 0L);
        LocalDateTime myTime = myCheckins.get(task.getId());
        return new TaskView(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getLocation(),
                task.getStartTime(),
                task.getEndTime(),
                TaskStatus.of(task.getStartTime(), task.getEndTime(), now),
                expectedCountOf(task),
                checked,
                myTime != null,
                myTime,
                task.getCreatedBy().getNickname()
        );
    }

    public Map<Long, Long> checkedCounts() {
        Map<Long, Long> result = new HashMap<>();
        for (Object[] row : recordRepository.countGroupByTask()) {
            result.put((Long) row[0], (Long) row[1]);
        }
        return result;
    }

    public Map<Long, LocalDateTime> myCheckins(Long userId) {
        Map<Long, LocalDateTime> result = new HashMap<>();
        for (CheckinRecord record : recordRepository.findByUserIdOrderByCheckinTimeDesc(userId)) {
            result.putIfAbsent(record.getTask().getId(), record.getCheckinTime());
        }
        return result;
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
