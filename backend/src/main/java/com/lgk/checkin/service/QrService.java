package com.lgk.checkin.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import com.lgk.checkin.common.ApiException;
import com.lgk.checkin.common.Guards;
import com.lgk.checkin.domain.CheckinTask;
import com.lgk.checkin.dto.QrView;
import com.lgk.checkin.security.AuthUser;
import com.lgk.checkin.security.JwtService;
import com.lgk.checkin.security.QrToken;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class QrService {

    private final JwtService jwtService;
    private final TaskService taskService;

    /**
     * 生成短期有效的签到二维码。二维码令牌与任务绑定，并会自动轮换。
     */
    @Transactional(readOnly = true)
    public QrView create(Long taskId, AuthUser authUser, HttpServletRequest request) {
        Guards.requireAdmin(authUser);
        CheckinTask task = taskService.getEntity(taskId);
        if (LocalDateTime.now().isAfter(task.getEndTime())) {
            throw new ApiException(409, "TASK_ENDED", "签到已结束，无法生成二维码");
        }
        int ttl = Math.min(600, Math.max(30, task.getQrTtlSeconds()));
        QrToken token = jwtService.issueQrToken(taskId, task.getEndTime(), ttl);
        String imageUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/qr/{token}")
                .buildAndExpand(token.token())
                .toUriString();
        return new QrView(taskId, token.token(), imageUrl, token.expiresAt(), ttl);
    }

    public byte[] renderPng(String content, int size) {
        try {
            QRCodeWriter writer = new QRCodeWriter();
            Map<EncodeHintType, Object> hints = Map.of(
                    EncodeHintType.CHARACTER_SET, "UTF-8",
                    EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M,
                    EncodeHintType.MARGIN, 1
            );
            BitMatrix matrix = writer.encode(content, BarcodeFormat.QR_CODE, size, size, hints);
            BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
            for (int x = 0; x < size; x++) {
                for (int y = 0; y < size; y++) {
                    image.setRGB(x, y, matrix.get(x, y) ? 0xFF12313D : 0xFFFFFFFF);
                }
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        } catch (IOException e) {
            throw new ApiException(500, "QR_RENDER_FAILED", "二维码生成失败");
        } catch (com.google.zxing.WriterException e) {
            throw new ApiException(500, "QR_RENDER_FAILED", "二维码内容过长，生成失败");
        }
    }
}
