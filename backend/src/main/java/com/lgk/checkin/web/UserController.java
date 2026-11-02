package com.lgk.checkin.web;

import com.lgk.checkin.dto.UserView;
import com.lgk.checkin.security.AuthUser;
import com.lgk.checkin.security.CurrentUser;
import com.lgk.checkin.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    @GetMapping("/me")
    public UserView me(@CurrentUser AuthUser authUser) {
        return authService.currentUser(authUser.id());
    }
}
