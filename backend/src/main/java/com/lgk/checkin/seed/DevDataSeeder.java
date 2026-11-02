package com.lgk.checkin.seed;

import com.lgk.checkin.domain.*;
import com.lgk.checkin.repo.CheckinRecordRepository;
import com.lgk.checkin.repo.CheckinTaskRepository;
import com.lgk.checkin.repo.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 开发环境演示数据：方便本地直接体验签到、统计与缺勤数据。
 */
@Slf4j
@Component
@Profile({"dev", "win"})
@RequiredArgsConstructor
public class DevDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CheckinTaskRepository taskRepository;
    private final CheckinRecordRepository recordRepository;

    @Override
    @Transactional
    public void run(String... args) {
        User admin = ensureUser("dev-admin", "蓝老师", Role.ADMIN);
        User demo = ensureUser("dev-user", "蓝功凯", Role.USER);
        User zhang = ensureUser("dev-user-2", "张同学", Role.USER);
        User li = ensureUser("dev-user-3", "李同学", Role.USER);

        if (taskRepository.count() > 0) {
            return;
        }
        LocalDateTime now = LocalDateTime.now().withNano(0);

        CheckinTask ongoing = new CheckinTask();
        ongoing.setTitle("数据结构课程签到");
        ongoing.setDescription("第三章 栈与队列 · 课堂签到，请在规定时间内扫码");
        ongoing.setLocation("东教学楼 A302");
        ongoing.setStartTime(now.minusMinutes(10));
        ongoing.setEndTime(now.plusMinutes(50));
        ongoing.setExpectedCount(3);
        ongoing.setQrTtlSeconds(60);
        ongoing.setCreatedBy(admin);
        ongoing.setCreatedAt(now);

        CheckinTask upcoming = new CheckinTask();
        upcoming.setTitle("社团招新宣讲会");
        upcoming.setDescription("面向全体同学的社团招新活动签到");
        upcoming.setLocation("大学生活动中心报告厅");
        upcoming.setStartTime(now.plusHours(3));
        upcoming.setEndTime(now.plusHours(4));
        upcoming.setExpectedCount(0);
        upcoming.setQrTtlSeconds(60);
        upcoming.setCreatedBy(admin);
        upcoming.setCreatedAt(now);

        CheckinTask ended = new CheckinTask();
        ended.setTitle("期中动员会");
        ended.setDescription("期中考试动员与学风建设会议");
        ended.setLocation("图书馆报告厅");
        ended.setStartTime(now.minusDays(1).toLocalDate().atTime(19, 0));
        ended.setEndTime(now.minusDays(1).toLocalDate().atTime(20, 30));
        ended.setExpectedCount(3);
        ended.setQrTtlSeconds(60);
        ended.setCreatedBy(admin);
        ended.setCreatedAt(now.minusDays(1));

        taskRepository.save(ongoing);
        taskRepository.save(upcoming);
        taskRepository.save(ended);

        CheckinRecord record = new CheckinRecord();
        record.setTask(ongoing);
        record.setUser(zhang);
        record.setCheckinTime(now.minusMinutes(5));
        record.setMethod(CheckinMethod.QR);
        record.setClientIp("127.0.0.1");
        record.setQrId("seed-demo");
        recordRepository.save(record);

        log.info("演示数据初始化完成：管理员={}，普通用户={}，{}", admin.getNickname(),
                demo.getNickname(), LocalDate.now());
    }

    private User ensureUser(String openid, String nickname, Role role) {
        return userRepository.findByOpenid(openid).orElseGet(() -> {
            User user = new User();
            user.setOpenid(openid);
            user.setNickname(nickname);
            user.setRole(role);
            user.setCreatedAt(LocalDateTime.now());
            return userRepository.save(user);
        });
    }
}
