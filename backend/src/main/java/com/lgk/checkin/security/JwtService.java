package com.lgk.checkin.security;

import com.lgk.checkin.common.ApiException;
import com.lgk.checkin.config.AppProperties;
import com.lgk.checkin.domain.Role;
import com.lgk.checkin.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {

    private static final String TYPE_ACCESS = "access";
    private static final String TYPE_QR = "qr";

    private final SecretKey key;
    private final int accessTokenHours;

    public JwtService(AppProperties properties) {
        String secret = properties.getJwtSecret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("app.jwt-secret 至少需要 32 个字节");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenHours = properties.getAccessTokenHours();
    }

    public String issueAccessToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .setSubject(String.valueOf(user.getId()))
                .claim("typ", TYPE_ACCESS)
                .claim("role", user.getRole().name())
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(now.plus(accessTokenHours, ChronoUnit.HOURS)))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    public AuthUser parseAccessToken(String token) {
        try {
            Claims claims = parseClaims(token);
            if (!TYPE_ACCESS.equals(claims.get("typ", String.class))) {
                throw new ApiException(401, "TOKEN_INVALID", "登录凭证无效");
            }
            Role role = Role.valueOf(claims.get("role", String.class));
            return new AuthUser(Long.valueOf(claims.getSubject()), role);
        } catch (ExpiredJwtException e) {
            throw new ApiException(401, "TOKEN_EXPIRED", "登录已过期，请重新登录");
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(401, "TOKEN_INVALID", "登录凭证无效");
        }
    }

    /**
     * 签发与具体签到任务绑定的短时二维码令牌。
     * 有效期取 min(now + ttl, 任务结束时间)，任务结束后不再签发。
     */
    public QrToken issueQrToken(Long taskId, LocalDateTime taskEndTime, int ttlSeconds) {
        Instant now = Instant.now();
        Instant expiration = now.plusSeconds(Math.max(30, ttlSeconds));
        Instant taskEnd = taskEndTime.atZone(ZoneId.systemDefault()).toInstant();
        if (taskEnd.isBefore(now)) {
            throw new ApiException(409, "TASK_ENDED", "签到已结束，无法生成二维码");
        }
        if (expiration.isAfter(taskEnd)) {
            expiration = taskEnd;
        }
        String tokenId = UUID.randomUUID().toString();
        String token = Jwts.builder()
                .setId(tokenId)
                .setSubject(String.valueOf(taskId))
                .claim("typ", TYPE_QR)
                .claim("task", taskId)
                .setIssuedAt(Date.from(now))
                .setExpiration(Date.from(expiration))
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
        LocalDateTime expiresAt = LocalDateTime.ofInstant(expiration, ZoneId.systemDefault());
        return new QrToken(taskId, token, tokenId, expiresAt);
    }

    public QrToken parseQrToken(String token) {
        try {
            Claims claims = parseClaims(token);
            if (!TYPE_QR.equals(claims.get("typ", String.class))) {
                throw new ApiException(400, "QR_INVALID", "签到二维码无效");
            }
            Long taskId = claims.get("task", Number.class).longValue();
            LocalDateTime expiresAt = LocalDateTime.ofInstant(claims.getExpiration().toInstant(),
                    ZoneId.systemDefault());
            return new QrToken(taskId, token, claims.getId(), expiresAt);
        } catch (ExpiredJwtException e) {
            throw new ApiException(400, "QR_EXPIRED", "二维码已过期，请扫描最新生成的二维码");
        } catch (JwtException | IllegalArgumentException e) {
            throw new ApiException(400, "QR_INVALID", "签到二维码无效");
        }
    }

    private Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}
