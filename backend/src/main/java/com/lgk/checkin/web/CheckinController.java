package com.lgk.checkin.web;

import com.lgk.checkin.dto.CheckinRequest;
import com.lgk.checkin.dto.CheckinResult;
import com.lgk.checkin.dto.PageView;
import com.lgk.checkin.dto.RecordView;
import com.lgk.checkin.security.AuthUser;
import com.lgk.checkin.security.CurrentUser;
import com.lgk.checkin.service.CheckinService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/checkins")
@RequiredArgsConstructor
public class CheckinController {

    private final CheckinService checkinService;

    @PostMapping
    public CheckinResult checkin(@Valid @RequestBody CheckinRequest request,
                                 @CurrentUser AuthUser authUser,
                                 HttpServletRequest servletRequest) {
        String ip = checkinService.clientIp(
                servletRequest.getHeader("X-Forwarded-For"),
                servletRequest.getHeader("X-Real-IP"),
                servletRequest.getRemoteAddr());
        return checkinService.checkin(request, authUser, ip);
    }

    @GetMapping("/my")
    public PageView<RecordView> myRecords(@CurrentUser AuthUser authUser,
                                          @RequestParam(defaultValue = "1") int page,
                                          @RequestParam(defaultValue = "20") int size) {
        return checkinService.myRecords(authUser, page, size);
    }
}
