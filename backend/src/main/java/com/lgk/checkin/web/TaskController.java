package com.lgk.checkin.web;

import com.lgk.checkin.dto.CreateTaskRequest;
import com.lgk.checkin.dto.QrView;
import com.lgk.checkin.dto.TaskStatsView;
import com.lgk.checkin.dto.TaskView;
import com.lgk.checkin.security.AuthUser;
import com.lgk.checkin.security.CurrentUser;
import com.lgk.checkin.service.QrService;
import com.lgk.checkin.service.StatsService;
import com.lgk.checkin.service.TaskService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final StatsService statsService;
    private final QrService qrService;

    @GetMapping
    public List<TaskView> list(@CurrentUser AuthUser authUser) {
        return taskService.list(authUser);
    }

    @GetMapping("/{taskId}")
    public TaskView detail(@PathVariable Long taskId, @CurrentUser AuthUser authUser) {
        return taskService.get(taskId, authUser);
    }

    @PostMapping
    public ResponseEntity<TaskView> create(@Valid @RequestBody CreateTaskRequest request,
                                          @CurrentUser AuthUser authUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.create(request, authUser));
    }

    @GetMapping("/{taskId}/stats")
    public TaskStatsView stats(@PathVariable Long taskId, @CurrentUser AuthUser authUser) {
        return statsService.taskStats(taskId, authUser);
    }

    @GetMapping("/{taskId}/qr")
    public QrView qr(@PathVariable Long taskId, @CurrentUser AuthUser authUser,
                     HttpServletRequest request) {
        return qrService.create(taskId, authUser, request);
    }
}
