package com.lgk.checkin.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "redirect:/admin/index.html";
    }

    @GetMapping({"/admin", "/admin/"})
    public String admin() {
        return "redirect:/admin/index.html";
    }

    @GetMapping({"/m", "/m/"})
    public String mobile() {
        return "redirect:/m/index.html";
    }
}
