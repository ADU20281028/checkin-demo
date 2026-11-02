package com.lgk.checkin.web;

import com.lgk.checkin.dto.OverviewView;
import com.lgk.checkin.security.AuthUser;
import com.lgk.checkin.security.CurrentUser;
import com.lgk.checkin.service.StatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/stats")
@RequiredArgsConstructor
public class StatsController {

    private final StatsService statsService;

    @GetMapping("/overview")
    public OverviewView overview(@CurrentUser AuthUser authUser) {
        return statsService.overview(authUser);
    }
}
