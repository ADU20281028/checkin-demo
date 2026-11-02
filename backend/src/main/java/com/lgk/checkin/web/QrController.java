package com.lgk.checkin.web;

import com.lgk.checkin.security.JwtService;
import com.lgk.checkin.service.QrService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class QrController {

    private final JwtService jwtService;
    private final QrService qrService;

    /**
     * 二维码图片本身由签名令牌保护，可通过投屏或小程序展示。
     */
    @GetMapping(value = "/api/qr/{token}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> image(@PathVariable String token) {
        jwtService.parseQrToken(token);
        byte[] png = qrService.renderPng(token, 560);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.noStore())
                .body(png);
    }
}
