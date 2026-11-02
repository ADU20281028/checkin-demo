package com.lgk.checkin.service;

import com.lgk.checkin.common.ApiException;
import com.lgk.checkin.domain.CheckinMethod;
import com.lgk.checkin.domain.CheckinRecord;
import com.lgk.checkin.domain.CheckinTask;
import com.lgk.checkin.domain.User;
import com.lgk.checkin.dto.CheckinRequest;
import com.lgk.checkin.dto.CheckinResult;
import com.lgk.checkin.dto.PageView;
import com.lgk.checkin.dto.RecordView;
import com.lgk.checkin.repo.CheckinRecordRepository;
import com.lgk.checkin.repo.CheckinTaskRepository;
import com.lgk.checkin.repo.UserRepository;
import com.lgk.checkin.security.AuthUser;
import com.lgk.checkin.security.JwtService;
import com.lgk.checkin.security.QrToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Slf4j
@Service
@RequiredArgsConstructor
public class CheckinService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final JwtService jwtService;
    private final CheckinTaskRepository taskRepository;
    private final CheckinRecordRepository recordRepository;
    private final UserRepository userRepository;
    private final TaskService taskService;

    @Transactional
    public CheckinResult checkin(CheckinRequest request, AuthUser authUser, String clientIp) {
        QrToken qrToken = jwtService.parseQrToken(request.qrToken().trim());
        CheckinTask task = taskService.getEntity(qrToken.taskId());
        LocalDateTime now = LocalDateTime.now();

        if (now.isBefore(task.getStartTime())) {
            throw new ApiException(409, "TASK_NOT_STARTED",
                    "签到尚未开始，开始时间为 " + task.getStartTime().format(TIME_FORMAT));
        }
        if (now.isAfter(task.getEndTime())) {
            throw new ApiException(409, "TASK_ENDED",
                    "签到已结束，截止时间为 " + task.getEndTime().format(TIME_FORMAT));
        }
        if (recordRepository.existsByTaskIdAndUserId(task.getId(), authUser.id())) {
            throw new ApiException(409, "DUPLICATE_CHECKIN", "您已完成该任务签到，请勿重复提交");
        }

        User user = userRepository.findById(authUser.id())
                .orElseThrow(() -> new ApiException(401, "USER_NOT_FOUND", "用户不存在，请重新登录"));

        CheckinRecord record = new CheckinRecord();
        record.setTask(task);
        record.setUser(user);
        record.setCheckinTime(now);
        record.setMethod(CheckinMethod.QR);
        record.setClientIp(clientIp);
        record.setQrId(qrToken.tokenId());
        try {
            recordRepository.saveAndFlush(record);
        } catch (DataIntegrityViolationException e) {
            // 并发重复提交由数据库唯一索引兜底
            throw new ApiException(409, "DUPLICATE_CHECKIN", "您已完成该任务签到，请勿重复提交");
        }

        long checked = recordRepository.countByTaskId(task.getId());
        log.info("用户 {} 完成签到，任务 {}，IP {}", user.getId(), task.getId(), clientIp);
        return new CheckinResult(record.getId(), task.getId(), task.getTitle(), now, checked,
                taskService.expectedCountOf(task));
    }

    @Transactional(readOnly = true)
    public PageView<RecordView> myRecords(AuthUser authUser, int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(50, Math.max(1, size));
        Page<CheckinRecord> result = recordRepository.findByUserIdOrderByCheckinTimeDesc(
                authUser.id(), PageRequest.of(safePage - 1, safeSize));
        return new PageView<>(result.getContent().stream().map(RecordView::from).toList(),
                result.getTotalElements(), safePage, safeSize);
    }

    public String clientIp(String forwardedFor, String realIp, String remoteAddr) {
        String ip = null;
        if (StringUtils.hasText(forwardedFor)) {
            ip = forwardedFor.split(",")[0].trim();
        } else if (StringUtils.hasText(realIp)) {
            ip = realIp.trim();
        } else {
            ip = remoteAddr;
        }
        if (ip == null) {
            return null;
        }
        return ip.length() > 45 ? ip.substring(0, 45) : ip;
    }
}
